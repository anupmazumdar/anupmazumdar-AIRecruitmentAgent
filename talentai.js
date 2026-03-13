/**
 * talentai.js
 * Multi-model AI routing engine for TalentAI using OpenRouter.
 */

const { trackCost, getCostReport, getCostRecords, resetCostTracker } = require('./costTracker');
const { runABTest, getABTestResults, resetABTestResults, abTestResults } = require('./abTest');
const { recordModelPerformance, getModelStats, resetModelStats } = require('./modelStats');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const TASK_MODES = {
  RESUME_PARSING: 'RESUME_PARSING',
  CANDIDATE_SCORING: 'CANDIDATE_SCORING',
  INTERVIEW_EVAL: 'INTERVIEW_EVAL',
  QUIZ_GRADING: 'QUIZ_GRADING',
  FEEDBACK_GENERATION: 'FEEDBACK_GENERATION',
  BIAS_DETECTION: 'BIAS_DETECTION',
  JD_MATCHING: 'JD_MATCHING'
};

const MODEL_CONFIG = {
  RESUME_PARSING: {
    primary: 'google/gemini-pro',
    fallback: 'meta-llama/llama-3-70b-instruct',
    temperature: 0.1,
    max_tokens: 2000,
    costPerToken: 0.000001
  },
  CANDIDATE_SCORING: {
    primary: 'openai/gpt-4o',
    fallback: 'anthropic/claude-3-sonnet',
    temperature: 0.1,
    max_tokens: 1000,
    costPerToken: 0.000005
  },
  INTERVIEW_EVAL: {
    primary: 'anthropic/claude-3-sonnet',
    fallback: 'openai/gpt-4o',
    temperature: 0.2,
    max_tokens: 1500,
    costPerToken: 0.000003
  },
  QUIZ_GRADING: {
    primary: 'openai/gpt-4o-mini',
    fallback: 'google/gemini-pro',
    temperature: 0.1,
    max_tokens: 1000,
    costPerToken: 0.0000001
  },
  FEEDBACK_GENERATION: {
    primary: 'mistralai/mixtral-8x7b-instruct',
    fallback: 'meta-llama/llama-3-70b-instruct',
    temperature: 0.4,
    max_tokens: 1500,
    costPerToken: 0.0000006
  },
  BIAS_DETECTION: {
    primary: 'anthropic/claude-3-sonnet',
    fallback: 'openai/gpt-4o',
    temperature: 0.1,
    max_tokens: 1000,
    costPerToken: 0.000003
  },
  JD_MATCHING: {
    primary: 'meta-llama/llama-3-70b-instruct',
    fallback: 'mistralai/mixtral-8x7b-instruct',
    temperature: 0.1,
    max_tokens: 2000,
    costPerToken: 0.0000009
  }
};

const CHEAP_MODEL_MAP = {
  RESUME_PARSING: { primary: 'meta-llama/llama-3-70b-instruct', fallback: 'google/gemini-pro' },
  CANDIDATE_SCORING: { primary: 'openai/gpt-4o-mini', fallback: 'anthropic/claude-3-sonnet' },
  INTERVIEW_EVAL: { primary: 'openai/gpt-4o-mini', fallback: 'anthropic/claude-3-sonnet' },
  QUIZ_GRADING: { primary: 'openai/gpt-4o-mini', fallback: 'google/gemini-pro' },
  FEEDBACK_GENERATION: { primary: 'mistralai/mixtral-8x7b-instruct', fallback: 'meta-llama/llama-3-70b-instruct' },
  BIAS_DETECTION: { primary: 'openai/gpt-4o-mini', fallback: 'anthropic/claude-3-sonnet' },
  JD_MATCHING: { primary: 'mistralai/mixtral-8x7b-instruct', fallback: 'meta-llama/llama-3-70b-instruct' }
};

/**
 * Resolves OpenRouter API key from environment.
 * @returns {string}
 */
function getApiKey() {
  try {
    return process.env.OPENROUTER_API_KEY || process.env.REACT_APP_OPENROUTER_API_KEY || '';
  } catch (error) {
    console.error('[TalentAI][MODEL][INTERNAL] Failed to resolve API key:', error.message);
    return '';
  }
}

/**
 * Checks if a task mode is valid.
 * @param {string} taskMode
 * @returns {boolean}
 */
function isValidTaskMode(taskMode) {
  try {
    return Boolean(MODEL_CONFIG[String(taskMode || '').toUpperCase()]);
  } catch (error) {
    console.error('[TalentAI][MODEL][INTERNAL] Failed task mode validation:', error.message);
    return false;
  }
}

/**
 * Estimates confidence score from parsed output shape.
 * @param {string} taskMode
 * @param {object|Array|any} parsedOutput
 * @returns {number}
 */
function estimateConfidence(taskMode, parsedOutput) {
  try {
    if (!parsedOutput || typeof parsedOutput !== 'object') return 0.5;

    const mode = String(taskMode || '').toUpperCase();

    if (mode === TASK_MODES.RESUME_PARSING) {
      const fields = ['atsScore', 'projectScore', 'projects', 'strengths', 'improvements'];
      const present = fields.filter((f) => parsedOutput[f]).length;
      return Number((0.45 + (present / fields.length) * 0.5).toFixed(4));
    }

    if (mode === TASK_MODES.CANDIDATE_SCORING) {
      return parsedOutput.overallScore !== undefined ? 0.88 : 0.64;
    }

    if (mode === TASK_MODES.INTERVIEW_EVAL) {
      return parsedOutput.totalScore !== undefined || parsedOutput.clarityScore !== undefined ? 0.84 : 0.62;
    }

    if (mode === TASK_MODES.QUIZ_GRADING) {
      return parsedOutput.totalScore !== undefined || Array.isArray(parsedOutput.answers) ? 0.86 : 0.66;
    }

    if (mode === TASK_MODES.FEEDBACK_GENERATION) {
      const hasExpected = Array.isArray(parsedOutput.strengths) && Array.isArray(parsedOutput.improvements);
      return hasExpected ? 0.82 : 0.63;
    }

    if (mode === TASK_MODES.BIAS_DETECTION) {
      return parsedOutput.biasDetected !== undefined ? 0.87 : 0.61;
    }

    if (mode === TASK_MODES.JD_MATCHING) {
      return Array.isArray(parsedOutput.rankings) ? 0.85 : 0.6;
    }

    return 0.7;
  } catch (error) {
    console.error(`[TalentAI][MODEL][${String(taskMode || 'UNKNOWN')}] Failed confidence estimation:`, error.message);
    return 0.5;
  }
}

/**
 * Builds JSON-only output contract for each task mode.
 * @param {string} taskMode
 * @returns {string}
 */
function getOutputSchemaInstruction(taskMode) {
  try {
    const mode = String(taskMode || '').toUpperCase();

    if (mode === TASK_MODES.RESUME_PARSING) {
      return 'Return only valid JSON with fields: atsScore (0-100 integer), projectScore (0-100 integer), projects (array of {name, description, technologies, impact}), strengths (array), improvements (array), projectAnalysis (string).';
    }

    if (mode === TASK_MODES.CANDIDATE_SCORING) {
      return 'Return only valid JSON with fields: overallScore (0-100), technicalScore, communicationScore, cultureFitScore, strengths (array), risks (array), recommendation.';
    }

    if (mode === TASK_MODES.INTERVIEW_EVAL) {
      return 'Return only valid JSON with fields: clarityScore (0-25 integer), relevanceScore (0-25 integer), confidenceScore (0-25 integer), communicationScore (0-25 integer), totalScore (0-100 integer), strengths (array), improvements (array), summary (string).';
    }

    if (mode === TASK_MODES.QUIZ_GRADING) {
      return 'Return only valid JSON with fields: totalScore (0-100), answers (array of {question, awardedScore, maxScore, rationale}), summary.';
    }

    if (mode === TASK_MODES.FEEDBACK_GENERATION) {
      return 'Return only valid JSON with fields: strengths (array), improvements (array), overallFeedback (string), hiringRecommendation (string), nextSteps (array).';
    }

    if (mode === TASK_MODES.BIAS_DETECTION) {
      return 'Return only valid JSON with fields: biasDetected (boolean), biasTypes (array), affectedFields (array), severity (low|medium|high), recommendations (array).';
    }

    if (mode === TASK_MODES.JD_MATCHING) {
      return 'Return only valid JSON with fields: rankings (array of {candidateId, matchScore, keyMatches, gaps}), topCandidate (string), summary (string).';
    }

    return 'Return only valid JSON.';
  } catch (error) {
    console.error('[TalentAI][MODEL][INTERNAL] Failed output schema instruction:', error.message);
    return 'Return only valid JSON.';
  }
}

/**
 * Builds task-specific user prompt payload.
 * @param {string} taskMode
 * @param {object} input
 * @returns {string}
 */
function buildTaskPrompt(taskMode, input) {
  try {
    const mode = String(taskMode || '').toUpperCase();

    if (mode === TASK_MODES.RESUME_PARSING) {
      return `Analyze this resume for ATS compatibility and project depth. Return structured scoring and improvements only.\n${JSON.stringify(input || {})}`;
    }

    if (mode === TASK_MODES.CANDIDATE_SCORING) {
      return `Score this candidate based on profile, resume, tests, and interviews:\n${JSON.stringify(input || {})}`;
    }

    if (mode === TASK_MODES.INTERVIEW_EVAL) {
      return `Evaluate this spoken interview transcript and return component communication scores with practical strengths and improvements.\n${JSON.stringify(input || {})}`;
    }

    if (mode === TASK_MODES.QUIZ_GRADING) {
      return `Grade this technical quiz with rubric-based scoring:\n${JSON.stringify(input || {})}`;
    }

    if (mode === TASK_MODES.FEEDBACK_GENERATION) {
      return `Generate candidate feedback from evaluation outputs and scores:\n${JSON.stringify(input || {})}`;
    }

    if (mode === TASK_MODES.BIAS_DETECTION) {
      return `Detect potential bias in this job description, candidate profile, and scoring context:\n${JSON.stringify(input || {})}`;
    }

    if (mode === TASK_MODES.JD_MATCHING) {
      return `Match candidates to this job description and provide ranking:\n${JSON.stringify(input || {})}`;
    }

    return `Analyze this payload:\n${JSON.stringify(input || {})}`;
  } catch (error) {
    console.error(`[TalentAI][MODEL][${String(taskMode || 'UNKNOWN')}] Failed task prompt build:`, error.message);
    return JSON.stringify(input || {});
  }
}

/**
 * Builds OpenRouter chat messages.
 * @param {string} taskMode
 * @param {object} input
 * @returns {Array<{role:string,content:string}>}
 */
function buildMessages(taskMode, input) {
  try {
    return [
      {
        role: 'system',
        content: `You are TalentAI evaluation engine. ${getOutputSchemaInstruction(taskMode)} Do not include markdown fences or prose.`
      },
      {
        role: 'user',
        content: buildTaskPrompt(taskMode, input)
      }
    ];
  } catch (error) {
    console.error(`[TalentAI][MODEL][${String(taskMode || 'UNKNOWN')}] Failed to build messages:`, error.message);
    return [
      { role: 'system', content: 'Return only valid JSON.' },
      { role: 'user', content: JSON.stringify(input || {}) }
    ];
  }
}

/**
 * Returns model plan per task including cheap-mode routing.
 * @param {string} taskMode
 * @param {{useCheapMode?:boolean,bulkCount?:number}} options
 * @returns {{primary:string,fallback:string,temperature:number,max_tokens:number,costPerToken:number,useCheapMode:boolean}}
 */
function getModelForTask(taskMode, options = {}) {
  try {
    const mode = String(taskMode || '').toUpperCase();
    const config = MODEL_CONFIG[mode];

    if (!config) {
      throw new Error(`Unsupported task mode: ${mode}`);
    }

    const bulkCount = Number(options?.bulkCount || 0);
    const isBulk = bulkCount > 10;
    const forceCheap = Boolean(options?.useCheapMode);
    const cheapEnabled = forceCheap || isBulk;
    const cheapMap = CHEAP_MODEL_MAP[mode] || {};

    const primary = cheapEnabled && cheapMap.primary ? cheapMap.primary : config.primary;
    const fallback = cheapEnabled && cheapMap.fallback ? cheapMap.fallback : config.fallback;

    return {
      primary,
      fallback,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      costPerToken: config.costPerToken,
      useCheapMode: cheapEnabled
    };
  } catch (error) {
    console.error(`[TalentAI][MODEL][${String(taskMode || 'UNKNOWN')}] Failed model routing:`, error.message);
    throw error;
  }
}

/**
 * Parses JSON safely from model output.
 * @param {string} text
 * @returns {object|Array}
 */
function parseJsonOutput(text) {
  try {
    const raw = String(text || '').trim();
    if (!raw) throw new Error('Empty response content');

    const firstBrace = raw.indexOf('{');
    const firstBracket = raw.indexOf('[');
    const startIndexCandidates = [firstBrace, firstBracket].filter((idx) => idx >= 0);
    const startIndex = startIndexCandidates.length > 0 ? Math.min(...startIndexCandidates) : -1;

    if (startIndex < 0) {
      throw new Error('Model response is not JSON');
    }

    const candidate = raw.slice(startIndex);
    return JSON.parse(candidate);
  } catch (error) {
    throw new Error(`JSON parsing failed: ${error.message}`);
  }
}

/**
 * Executes a single OpenRouter request.
 * @param {{model:string,messages:Array<object>,temperature:number,max_tokens:number,taskMode:string,timeoutMs?:number}} request
 * @returns {Promise<{content:string,usage:object,model:string,raw:object}>}
 */
async function callOpenRouter(request) {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY or REACT_APP_OPENROUTER_API_KEY.');
    }

    const controller = new AbortController();
    const timeoutMs = Number(request?.timeoutMs || 30000);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.APP_BASE_URL || 'http://localhost:3000',
          'X-Title': 'TalentAI Recruitment'
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.max_tokens,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data?.error?.message || `OpenRouter request failed (${response.status})`;
        const err = new Error(message);
        err.status = response.status;
        throw err;
      }

      return {
        content: data?.choices?.[0]?.message?.content || '{}',
        usage: data?.usage || {},
        model: request.model,
        raw: data
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error(`[TalentAI][MODEL][${String(request?.taskMode || 'UNKNOWN')}] OpenRouter call failed with ${request?.model}:`, error.message);
    throw error;
  }
}

/**
 * Decides whether an error should trigger retry/fallback.
 * @param {Error & {status?:number}} error
 * @returns {boolean}
 */
function isRetryableError(error) {
  try {
    const status = Number(error?.status || 0);
    if ([408, 409, 425, 429, 500, 502, 503, 504].includes(status)) return true;
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('rate') ||
      message.includes('temporar') ||
      message.includes('network') ||
      message.includes('aborted')
    );
  } catch (err) {
    console.error('[TalentAI][MODEL][INTERNAL] Retry check failed:', err.message);
    return false;
  }
}

/**
 * Executes model call with automatic fallback and retries.
 * @param {string} taskMode
 * @param {Array<object>} messages
 * @param {{primary:string,fallback:string,temperature:number,max_tokens:number,costPerToken:number,useCheapMode:boolean}} route
 * @param {{maxAttempts?:number}} options
 * @returns {Promise<{parsed:object|Array,modelUsed:string,rawText:string,usage:object,attempts:number,confidenceScore:number,latencyMs:number,estimatedCost:number}>}
 */
async function executeWithFallback(taskMode, messages, route, options = {}) {
  const mode = String(taskMode || '').toUpperCase();
  const maxAttempts = Math.max(1, Math.min(3, Number(options?.maxAttempts || 3)));
  const models = [route.primary, route.fallback];

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const model = models[(attempt - 1) % models.length];
    const startedAt = Date.now();

    try {
      console.log(`[TalentAI][${model}][${mode}] Attempt ${attempt}/${maxAttempts} started`);

      const response = await callOpenRouter({
        model,
        messages,
        temperature: route.temperature,
        max_tokens: route.max_tokens,
        taskMode: mode
      });

      const parsed = parseJsonOutput(response.content);
      const latencyMs = Date.now() - startedAt;
      const promptTokens = Number(response.usage?.prompt_tokens || 0);
      const completionTokens = Number(response.usage?.completion_tokens || 0);
      const estimatedCost = Number(((promptTokens + completionTokens) * route.costPerToken).toFixed(8));
      const confidenceScore = estimateConfidence(mode, parsed);

      trackCost({
        taskMode: mode,
        model,
        promptTokens,
        completionTokens,
        costPerToken: route.costPerToken,
        latencyMs,
        success: true,
        metadata: { attempt, useCheapMode: route.useCheapMode }
      });

      recordModelPerformance({
        taskMode: mode,
        model,
        latencyMs,
        confidenceScore,
        success: true,
        cost: estimatedCost
      });

      console.log(`[TalentAI][${model}][${mode}] Success in ${latencyMs}ms`);

      return {
        parsed,
        modelUsed: model,
        rawText: response.content,
        usage: response.usage,
        attempts: attempt,
        confidenceScore,
        latencyMs,
        estimatedCost
      };
    } catch (error) {
      lastError = error;
      const latencyMs = Date.now() - startedAt;

      trackCost({
        taskMode: mode,
        model,
        promptTokens: 0,
        completionTokens: 0,
        costPerToken: route.costPerToken,
        latencyMs,
        success: false,
        metadata: { attempt, error: error.message, useCheapMode: route.useCheapMode }
      });

      recordModelPerformance({
        taskMode: mode,
        model,
        latencyMs,
        confidenceScore: 0,
        success: false,
        cost: 0
      });

      console.warn(`[TalentAI][${model}][${mode}] Attempt ${attempt}/${maxAttempts} failed: ${error.message}`);

      if (!isRetryableError(error) && attempt >= 1) {
        break;
      }
    }
  }

  throw new Error(`All model attempts failed for ${mode}: ${lastError?.message || 'unknown error'}`);
}

/**
 * Executes task through primary/fallback or A/B flow.
 * @param {string} taskMode
 * @param {object} input
 * @param {{useCheapMode?:boolean,abTest?:boolean,bulkCount?:number,maxAttempts?:number}} options
 * @returns {Promise<{taskMode:string,modelUsed:string,fallbackUsed:boolean,attempts:number,confidenceScore:number,latencyMs:number,estimatedCost:number,useCheapMode:boolean,abTest:boolean,result:object|Array,rawText:string,comparison?:object}>}
 */
async function evaluateTask(taskMode, input, options = {}) {
  try {
    const mode = String(taskMode || '').toUpperCase();

    if (!isValidTaskMode(mode)) {
      throw new Error(`Unsupported task mode: ${mode}`);
    }

    const inferredBulkCount = Array.isArray(input?.candidateProfiles) ? input.candidateProfiles.length : Number(options?.bulkCount || 0);
    const route = getModelForTask(mode, {
      useCheapMode: Boolean(options?.useCheapMode),
      bulkCount: inferredBulkCount
    });

    const messages = buildMessages(mode, input);

    if (Boolean(options?.abTest)) {
      const abResult = await runABTest({
        taskMode: mode,
        primaryModel: route.primary,
        alternativeModel: route.fallback,
        messages,
        requestOptions: { temperature: route.temperature, max_tokens: route.max_tokens },
        confidenceFn: (content) => {
          try {
            return estimateConfidence(mode, parseJsonOutput(content));
          } catch {
            return 0.5;
          }
        },
        invokeModel: async ({ model, messages: m, requestOptions }) => {
          const startedAt = Date.now();
          const response = await callOpenRouter({
            model,
            messages: m,
            temperature: requestOptions.temperature,
            max_tokens: requestOptions.max_tokens,
            taskMode: mode
          });
          const latencyMs = Date.now() - startedAt;
          const parsed = parseJsonOutput(response.content);
          const promptTokens = Number(response.usage?.prompt_tokens || 0);
          const completionTokens = Number(response.usage?.completion_tokens || 0);
          const estimatedCost = Number(((promptTokens + completionTokens) * route.costPerToken).toFixed(8));
          const confidenceScore = estimateConfidence(mode, parsed);

          trackCost({
            taskMode: mode,
            model,
            promptTokens,
            completionTokens,
            costPerToken: route.costPerToken,
            latencyMs,
            success: true,
            metadata: { abTest: true, useCheapMode: route.useCheapMode }
          });

          recordModelPerformance({
            taskMode: mode,
            model,
            latencyMs,
            confidenceScore,
            success: true,
            cost: estimatedCost
          });

          return {
            content: response.content,
            usage: response.usage,
            parsed,
            confidenceScore,
            latencyMs,
            estimatedCost
          };
        }
      });

      const selectedParsed = abResult.selectedResult.parsed || parseJsonOutput(abResult.selectedResult.content || '{}');

      console.log(`[TalentAI][${abResult.selectedModel}][${mode}] A/B test selected result`);

      return {
        taskMode: mode,
        modelUsed: abResult.selectedModel,
        fallbackUsed: abResult.selectedModel === route.fallback,
        attempts: 1,
        confidenceScore: Number(abResult.selectedResult.confidenceScore || estimateConfidence(mode, selectedParsed)),
        latencyMs: Number(abResult.selectedResult.latencyMs || 0),
        estimatedCost: Number(abResult.selectedResult.estimatedCost || 0),
        useCheapMode: route.useCheapMode,
        abTest: true,
        result: selectedParsed,
        rawText: abResult.selectedResult.content || JSON.stringify(selectedParsed),
        comparison: abResult.comparison
      };
    }

    const execution = await executeWithFallback(mode, messages, route, {
      maxAttempts: options?.maxAttempts
    });

    return {
      taskMode: mode,
      modelUsed: execution.modelUsed,
      fallbackUsed: execution.modelUsed === route.fallback,
      attempts: execution.attempts,
      confidenceScore: execution.confidenceScore,
      latencyMs: execution.latencyMs,
      estimatedCost: execution.estimatedCost,
      useCheapMode: route.useCheapMode,
      abTest: false,
      result: execution.parsed,
      rawText: execution.rawText
    };
  } catch (error) {
    console.error(`[TalentAI][MODEL][${String(taskMode || 'UNKNOWN')}] Task evaluation failed:`, error.message);
    throw error;
  }
}

/**
 * Resume parsing evaluation mode.
 * @param {object} payload
 * @param {{useCheapMode?:boolean,abTest?:boolean,bulkCount?:number,maxAttempts?:number}} [options]
 * @returns {Promise<object>}
 */
async function evaluateResumeParsing(payload, options = {}) {
  try {
    return await evaluateTask(TASK_MODES.RESUME_PARSING, payload, options);
  } catch (error) {
    console.error('[TalentAI][MODEL][RESUME_PARSING] Evaluation failed:', error.message);
    throw error;
  }
}

/**
 * Candidate scoring evaluation mode.
 * @param {object} payload
 * @param {{useCheapMode?:boolean,abTest?:boolean,bulkCount?:number,maxAttempts?:number}} [options]
 * @returns {Promise<object>}
 */
async function evaluateCandidateScoring(payload, options = {}) {
  try {
    return await evaluateTask(TASK_MODES.CANDIDATE_SCORING, payload, options);
  } catch (error) {
    console.error('[TalentAI][MODEL][CANDIDATE_SCORING] Evaluation failed:', error.message);
    throw error;
  }
}

/**
 * Interview evaluation mode.
 * @param {object} payload
 * @param {{useCheapMode?:boolean,abTest?:boolean,bulkCount?:number,maxAttempts?:number}} [options]
 * @returns {Promise<object>}
 */
async function evaluateInterview(payload, options = {}) {
  try {
    return await evaluateTask(TASK_MODES.INTERVIEW_EVAL, payload, options);
  } catch (error) {
    console.error('[TalentAI][MODEL][INTERVIEW_EVAL] Evaluation failed:', error.message);
    throw error;
  }
}

/**
 * Quiz grading mode.
 * @param {object} payload
 * @param {{useCheapMode?:boolean,abTest?:boolean,bulkCount?:number,maxAttempts?:number}} [options]
 * @returns {Promise<object>}
 */
async function gradeQuiz(payload, options = {}) {
  try {
    return await evaluateTask(TASK_MODES.QUIZ_GRADING, payload, options);
  } catch (error) {
    console.error('[TalentAI][MODEL][QUIZ_GRADING] Evaluation failed:', error.message);
    throw error;
  }
}

/**
 * Feedback generation mode.
 * @param {object} payload
 * @param {{useCheapMode?:boolean,abTest?:boolean,bulkCount?:number,maxAttempts?:number}} [options]
 * @returns {Promise<object>}
 */
async function generateFeedback(payload, options = {}) {
  try {
    return await evaluateTask(TASK_MODES.FEEDBACK_GENERATION, payload, options);
  } catch (error) {
    console.error('[TalentAI][MODEL][FEEDBACK_GENERATION] Evaluation failed:', error.message);
    throw error;
  }
}

/**
 * Bias detection mode.
 * @param {object} payload
 * @param {{useCheapMode?:boolean,abTest?:boolean,bulkCount?:number,maxAttempts?:number}} [options]
 * @returns {Promise<object>}
 */
async function detectBias(payload, options = {}) {
  try {
    return await evaluateTask(TASK_MODES.BIAS_DETECTION, payload, options);
  } catch (error) {
    console.error('[TalentAI][MODEL][BIAS_DETECTION] Evaluation failed:', error.message);
    throw error;
  }
}

/**
 * JD matching mode.
 * @param {{jobDescription:string,candidateProfiles:Array<object>}} payload
 * @param {{useCheapMode?:boolean,abTest?:boolean,bulkCount?:number,maxAttempts?:number}} [options]
 * @returns {Promise<object>}
 */
async function matchJobDescription(payload, options = {}) {
  try {
    const mergedOptions = {
      ...options,
      bulkCount: Array.isArray(payload?.candidateProfiles)
        ? payload.candidateProfiles.length
        : Number(options?.bulkCount || 0)
    };

    return await evaluateTask(TASK_MODES.JD_MATCHING, payload, mergedOptions);
  } catch (error) {
    console.error('[TalentAI][MODEL][JD_MATCHING] Evaluation failed:', error.message);
    throw error;
  }
}

/**
 * Returns full diagnostics including cost and performance stats.
 * @returns {{modelStats:object,costReport:object,abTests:Array<object>}}
 */
function getDiagnostics() {
  try {
    return {
      modelStats: getModelStats(),
      costReport: getCostReport(),
      abTests: getABTestResults()
    };
  } catch (error) {
    console.error('[TalentAI][MODEL][INTERNAL] Diagnostics retrieval failed:', error.message);
    return {
      modelStats: { generatedAt: new Date().toISOString(), taskStats: {} },
      costReport: { generatedAt: new Date().toISOString(), totalCalls: 0, totalTokens: 0, totalEstimatedCost: 0, byTask: {}, byModel: {} },
      abTests: []
    };
  }
}

/**
 * Resets all in-memory analytics trackers.
 * @returns {{ok:boolean}}
 */
function resetDiagnostics() {
  try {
    resetModelStats();
    resetCostTracker();
    resetABTestResults();
    return { ok: true };
  } catch (error) {
    console.error('[TalentAI][MODEL][INTERNAL] Diagnostics reset failed:', error.message);
    return { ok: false };
  }
}

module.exports = {
  TASK_MODES,
  MODEL_CONFIG,
  abTestResults,
  getModelForTask,
  evaluateTask,
  evaluateResumeParsing,
  evaluateCandidateScoring,
  evaluateInterview,
  gradeQuiz,
  generateFeedback,
  detectBias,
  matchJobDescription,
  getModelStats,
  getCostReport,
  getCostRecords,
  getABTestResults,
  getDiagnostics,
  resetDiagnostics
};
