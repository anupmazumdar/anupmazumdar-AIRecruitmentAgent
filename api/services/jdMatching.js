'use strict';

const AI_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 25000);
const SHORTLIST_THRESHOLD = 68;

// ---------------------------------------------------------------------------
// Shared OpenRouter caller with primary + fallback model
// ---------------------------------------------------------------------------
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenRouter(prompt, systemPrompt, primaryModel, fallbackModel) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  async function tryModel(model) {
    const response = await fetchWithTimeout(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'TalentAI Recruitment',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1,
          max_tokens: 4000,
        }),
      },
      AI_TIMEOUT_MS
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        data.error?.message || `OpenRouter error ${response.status}`
      );
    }
    return data.choices[0]?.message?.content || '';
  }

  try {
    return await tryModel(primaryModel);
  } catch (err) {
    console.warn(
      `[JDMatching] Primary model ${primaryModel} failed: ${err.message}. Trying fallback.`
    );
    return await tryModel(fallbackModel);
  }
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a recruitment AI that matches candidates to job descriptions.
Rank candidates by fit score. Return ONLY valid JSON with no markdown, no commentary.`;

function buildPrompt(jobDescription, candidates) {
  return `Match these ${candidates.length} candidate(s) to the job description below.

Job Description:
${JSON.stringify(jobDescription, null, 2)}

Candidates:
${JSON.stringify(candidates, null, 2)}

Rules:
- shortlist = true when match_score >= ${SHORTLIST_THRESHOLD}
- grade: A (>=90), B (>=80), C (>=68), D (>=50), F (<50)
- experience_fit: "under" | "exact" | "over"

Return JSON matching this schema exactly:
{
  "job_title": "string",
  "total_candidates": number,
  "rankings": [
    {
      "rank": number,
      "candidate_id": "string",
      "candidate_name": "string",
      "match_score": number,
      "grade": "A|B|C|D|F",
      "key_matches": ["string"],
      "skill_gaps": ["string"],
      "experience_fit": "under|exact|over",
      "shortlist": boolean,
      "one_line_summary": "string"
    }
  ],
  "top_candidate": "string",
  "shortlisted_count": number,
  "insights": {
    "common_skill_gaps": ["string"],
    "best_qualified_percentage": number,
    "recommendation": "string"
  },
  "confidence": number
}`;
}

// ---------------------------------------------------------------------------
// Parsing & normalisation
// ---------------------------------------------------------------------------
function parseResult(raw) {
  const text = String(raw || '').replace(/```json|```/gi, '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in JD matching AI response');
  return JSON.parse(match[0]);
}

function scoreToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 68) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function normalizeResult(result, jobDescription, candidates) {
  const rankings = Array.isArray(result.rankings) ? [...result.rankings] : [];

  // Ensure every submitted candidate has a ranking entry
  const rankedIds = new Set(rankings.map((r) => String(r.candidate_id)));
  let nextRank = rankings.length + 1;
  for (const c of candidates) {
    if (!rankedIds.has(String(c.id))) {
      rankings.push({
        rank: nextRank++,
        candidate_id: String(c.id),
        candidate_name: c.name || 'Unknown',
        match_score: 0,
        grade: 'F',
        key_matches: [],
        skill_gaps: [],
        experience_fit: 'under',
        shortlist: false,
        one_line_summary: 'Not evaluated',
      });
    }
  }

  const normalized = rankings.map((r, i) => {
    const score = Math.max(0, Math.min(100, Number(r.match_score) || 0));
    const VALID_FIT = ['under', 'exact', 'over'];
    return {
      rank: Number(r.rank) || i + 1,
      candidate_id: String(r.candidate_id || ''),
      candidate_name: String(r.candidate_name || ''),
      match_score: score,
      grade: ['A', 'B', 'C', 'D', 'F'].includes(r.grade)
        ? r.grade
        : scoreToGrade(score),
      key_matches: Array.isArray(r.key_matches)
        ? r.key_matches.map(String)
        : [],
      skill_gaps: Array.isArray(r.skill_gaps) ? r.skill_gaps.map(String) : [],
      experience_fit: VALID_FIT.includes(r.experience_fit)
        ? r.experience_fit
        : 'under',
      shortlist: score >= SHORTLIST_THRESHOLD,
      one_line_summary: String(r.one_line_summary || ''),
    };
  });

  // Sort by descending score for the output
  const sorted = [...normalized].sort((a, b) => b.match_score - a.match_score);
  const shortlisted = sorted.filter((r) => r.shortlist);
  const top = sorted[0];

  return {
    job_title: String(
      result.job_title || jobDescription?.title || 'Position'
    ),
    total_candidates: candidates.length,
    rankings: sorted,
    top_candidate: String(result.top_candidate || top?.candidate_name || ''),
    shortlisted_count: shortlisted.length,
    insights: {
      common_skill_gaps: Array.isArray(result.insights?.common_skill_gaps)
        ? result.insights.common_skill_gaps.map(String)
        : [],
      best_qualified_percentage:
        candidates.length > 0
          ? Math.round((shortlisted.length / candidates.length) * 100)
          : 0,
      recommendation: String(result.insights?.recommendation || ''),
    },
    confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0.7)),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Match and rank candidates against a job description.
 * @param {{ job_description: object, candidates: object[] }} input
 */
async function matchCandidates({ job_description, candidates }) {
  if (!job_description) throw new Error('job_description is required');
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('candidates must be a non-empty array');
  }
  if (candidates.length > 50) {
    throw new Error('Maximum 50 candidates per request');
  }

  const prompt = buildPrompt(job_description, candidates);
  const raw = await callOpenRouter(
    prompt,
    SYSTEM_PROMPT,
    'meta-llama/llama-3-70b-instruct',
    'mistralai/mixtral-8x7b-instruct'
  );

  const parsed = parseResult(raw);
  return normalizeResult(parsed, job_description, candidates);
}

module.exports = { matchCandidates };
