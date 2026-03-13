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
          temperature: 0.1,
          max_tokens: 2000,
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
      `[BiasDetection] Primary model ${primaryModel} failed: ${err.message}. Trying fallback.`
    );
    return await tryModel(fallbackModel);
  }
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are an AI bias detection expert for recruitment.
Analyze job descriptions and candidate evaluations for discriminatory bias.
Respond ONLY in valid JSON with no markdown, no explanation, no extra text.`;

function buildPrompt(jobDescription, candidateProfile, evaluationScores) {
  return `Analyze the following for recruitment bias and return a single JSON object.

Job Description:
${jobDescription}

Candidate Profile:
${JSON.stringify(candidateProfile, null, 2)}

Evaluation Scores:
${JSON.stringify(evaluationScores, null, 2)}

Rules:
- Flag name-based bias (non-Western names scored lower)
- Flag age bias (penalizing < 2 yr or > 15 yr experience unfairly)
- Flag gender-coded language in the JD
- If bias detected, provide adjusted scores that remove the bias impact

Return JSON matching this schema exactly:
{
  "bias_detected": boolean,
  "bias_types": ["gender_bias", "age_bias", "education_bias", "name_bias", "experience_bias"],
  "affected_fields": ["field names"],
  "severity": "none|low|medium|high",
  "bias_indicators": [
    { "field": "string", "indicator": "string", "explanation": "string" }
  ],
  "adjusted_scores": {
    "skills_match": number,
    "experience": number,
    "education": number,
    "cultural_fit": number,
    "weighted_total": number
  },
  "recommendations": ["string"],
  "fairness_score": number,
  "confidence": number
}`;
}

// ---------------------------------------------------------------------------
// Parsing & normalisation
// ---------------------------------------------------------------------------
function parseResult(raw) {
  const text = String(raw || '').replace(/```json|```/gi, '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in bias detection AI response');
  return JSON.parse(match[0]);
}

function normalizeResult(result, evaluationScores) {
  const scores = evaluationScores || {};
  const VALID_SEVERITIES = ['none', 'low', 'medium', 'high'];

  return {
    bias_detected: Boolean(result.bias_detected),
    bias_types: Array.isArray(result.bias_types) ? result.bias_types : [],
    affected_fields: Array.isArray(result.affected_fields)
      ? result.affected_fields
      : [],
    severity: VALID_SEVERITIES.includes(result.severity)
      ? result.severity
      : 'none',
    bias_indicators: Array.isArray(result.bias_indicators)
      ? result.bias_indicators.map((b) => ({
          field: String(b.field || ''),
          indicator: String(b.indicator || ''),
          explanation: String(b.explanation || ''),
        }))
      : [],
    adjusted_scores: {
      skills_match: Number(
        result.adjusted_scores?.skills_match ?? scores.skills_match ?? 0
      ),
      experience: Number(
        result.adjusted_scores?.experience ?? scores.experience ?? 0
      ),
      education: Number(
        result.adjusted_scores?.education ?? scores.education ?? 0
      ),
      cultural_fit: Number(
        result.adjusted_scores?.cultural_fit ?? scores.cultural_fit ?? 0
      ),
      weighted_total: Number(
        result.adjusted_scores?.weighted_total ?? scores.weighted_total ?? 0
      ),
    },
    recommendations: Array.isArray(result.recommendations)
      ? result.recommendations.map(String)
      : [],
    fairness_score: Math.max(
      0,
      Math.min(100, Number(result.fairness_score) || 80)
    ),
    confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0.7)),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect bias in a job description + candidate evaluation.
 * @param {{ job_description: string, candidate_profile: object, evaluation_scores: object }} input
 */
async function detectBias({ job_description, candidate_profile, evaluation_scores }) {
  if (!job_description) throw new Error('job_description is required');
  if (!candidate_profile) throw new Error('candidate_profile is required');

  const prompt = buildPrompt(
    job_description,
    candidate_profile,
    evaluation_scores || {}
  );

  const raw = await callOpenRouter(
    prompt,
    SYSTEM_PROMPT,
    'anthropic/claude-3-sonnet',
    'openai/gpt-4o'
  );

  const parsed = parseResult(raw);
  return normalizeResult(parsed, evaluation_scores);
}

module.exports = { detectBias };
