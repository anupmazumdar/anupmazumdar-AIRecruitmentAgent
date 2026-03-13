'use strict';

const AI_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 25000);

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
          temperature: 0.4,
          max_tokens: 3000,
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
      `[FeedbackGenerator] Primary model ${primaryModel} failed: ${err.message}. Trying fallback.`
    );
    return await tryModel(fallbackModel);
  }
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a professional hiring manager writing comprehensive candidate feedback.
Generate detailed, constructive, and fair feedback based on all evaluation stages.
Return ONLY valid JSON with no markdown, no commentary.`;

function buildPrompt(evaluationData) {
  return `Generate a detailed feedback report for the following candidate evaluation.

Evaluation data:
${JSON.stringify(evaluationData, null, 2)}

Return JSON matching this schema exactly:
{
  "candidate_name": "string",
  "overall_grade": "string",
  "overall_score": number,
  "executive_summary": "string (2-3 sentences)",
  "strengths": [
    { "area": "string", "detail": "string", "evidence": "string" }
  ],
  "improvements": [
    { "area": "string", "detail": "string", "suggestion": "string" }
  ],
  "stage_breakdown": {
    "resume":    { "score": number, "feedback": "string" },
    "quiz":      { "score": number, "feedback": "string" },
    "interview": { "score": number, "feedback": "string" },
    "video":     { "score": number, "feedback": "string" }
  },
  "hiring_recommendation": "strong_yes|yes|maybe|no|strong_no",
  "recommended_role_level": "junior|mid|senior|not_suitable",
  "next_steps": ["string"],
  "recruiter_notes": "string"
}`;
}

// ---------------------------------------------------------------------------
// Parsing & normalisation
// ---------------------------------------------------------------------------
function parseResult(raw) {
  const text = String(raw || '').replace(/```json|```/gi, '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match)
    throw new Error('No JSON object found in feedback generator AI response');
  return JSON.parse(match[0]);
}

const VALID_RECOMMENDATIONS = ['strong_yes', 'yes', 'maybe', 'no', 'strong_no'];
const VALID_LEVELS = ['junior', 'mid', 'senior', 'not_suitable'];

function scoreToGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function clampStageScore(val) {
  return Math.max(0, Math.min(100, Number(val) || 0));
}

function normalizeResult(result, rawEval) {
  const overallScore = Math.max(
    0,
    Math.min(100, Number(result.overall_score) || 0)
  );

  return {
    candidate_name: String(
      result.candidate_name || rawEval?.name || 'Candidate'
    ),
    overall_grade:
      String(result.overall_grade || '').trim() || scoreToGrade(overallScore),
    overall_score: overallScore,
    executive_summary: String(result.executive_summary || ''),
    strengths: Array.isArray(result.strengths)
      ? result.strengths.map((s) => ({
          area: String(s?.area || ''),
          detail: String(s?.detail || ''),
          evidence: String(s?.evidence || ''),
        }))
      : [],
    improvements: Array.isArray(result.improvements)
      ? result.improvements.map((i) => ({
          area: String(i?.area || ''),
          detail: String(i?.detail || ''),
          suggestion: String(i?.suggestion || ''),
        }))
      : [],
    stage_breakdown: {
      resume: {
        score: clampStageScore(result.stage_breakdown?.resume?.score),
        feedback: String(result.stage_breakdown?.resume?.feedback || ''),
      },
      quiz: {
        score: clampStageScore(result.stage_breakdown?.quiz?.score),
        feedback: String(result.stage_breakdown?.quiz?.feedback || ''),
      },
      interview: {
        score: clampStageScore(result.stage_breakdown?.interview?.score),
        feedback: String(result.stage_breakdown?.interview?.feedback || ''),
      },
      video: {
        score: clampStageScore(result.stage_breakdown?.video?.score),
        feedback: String(result.stage_breakdown?.video?.feedback || ''),
      },
    },
    hiring_recommendation: VALID_RECOMMENDATIONS.includes(
      result.hiring_recommendation
    )
      ? result.hiring_recommendation
      : 'maybe',
    recommended_role_level: VALID_LEVELS.includes(result.recommended_role_level)
      ? result.recommended_role_level
      : 'not_suitable',
    next_steps: Array.isArray(result.next_steps)
      ? result.next_steps.map(String)
      : [],
    recruiter_notes: String(result.recruiter_notes || ''),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a detailed feedback report for a completed candidate evaluation.
 * @param {object} evaluationData — complete candidate evaluation object
 */
async function generateFeedback(evaluationData) {
  if (!evaluationData) throw new Error('Evaluation data is required');

  const prompt = buildPrompt(evaluationData);
  const raw = await callOpenRouter(
    prompt,
    SYSTEM_PROMPT,
    'mistralai/mixtral-8x7b-instruct',
    'meta-llama/llama-3-70b-instruct'
  );

  const parsed = parseResult(raw);
  return normalizeResult(parsed, evaluationData);
}

module.exports = { generateFeedback };
