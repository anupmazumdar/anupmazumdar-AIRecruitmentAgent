/**
 * abTest.js
 * A/B testing engine for comparing model outputs by task.
 */

const abTestResults = [];

/**
 * Randomly picks A or B with 50/50 split.
 * @returns {'A'|'B'}
 */
function pickArm() {
  try {
    return Math.random() < 0.5 ? 'A' : 'B';
  } catch (error) {
    console.error('[TalentAI][ABTEST][INTERNAL] Failed to pick arm:', error.message);
    return 'A';
  }
}

/**
 * Runs an A/B test for a task by invoking both models and selecting one result as active output.
 * @param {{taskMode:string,primaryModel:string,alternativeModel:string,invokeModel:function,messages:Array<object>,requestOptions?:object,confidenceFn?:function}} payload
 * @returns {Promise<{selectedArm:'A'|'B',selectedModel:string,selectedResult:object,comparison:{modelA:object|null,modelB:object|null},record:object}>}
 */
async function runABTest(payload) {
  try {
    const taskMode = String(payload?.taskMode || 'UNKNOWN').toUpperCase();
    const primaryModel = String(payload?.primaryModel || '').trim();
    const alternativeModel = String(payload?.alternativeModel || '').trim();
    const invokeModel = payload?.invokeModel;
    const messages = Array.isArray(payload?.messages) ? payload.messages : [];
    const requestOptions = payload?.requestOptions || {};
    const confidenceFn = typeof payload?.confidenceFn === 'function' ? payload.confidenceFn : () => 0.7;

    if (!primaryModel || !alternativeModel) {
      throw new Error('A/B test requires both primaryModel and alternativeModel');
    }

    if (typeof invokeModel !== 'function') {
      throw new Error('A/B test requires invokeModel function');
    }

    const selectedArm = pickArm();
    console.log(`[TalentAI][ABTEST][${taskMode}] Running A/B test with models A=${primaryModel}, B=${alternativeModel}, selectedArm=${selectedArm}`);

    const [resultA, resultB] = await Promise.allSettled([
      invokeModel({
        model: primaryModel,
        messages,
        requestOptions,
        taskMode
      }),
      invokeModel({
        model: alternativeModel,
        messages,
        requestOptions,
        taskMode
      })
    ]);

    const modelA = resultA.status === 'fulfilled'
      ? { ...resultA.value, model: primaryModel, confidenceScore: confidenceFn(resultA.value?.content) }
      : { model: primaryModel, error: resultA.reason?.message || 'Model A failed' };

    const modelB = resultB.status === 'fulfilled'
      ? { ...resultB.value, model: alternativeModel, confidenceScore: confidenceFn(resultB.value?.content) }
      : { model: alternativeModel, error: resultB.reason?.message || 'Model B failed' };

    const selectedResult = selectedArm === 'A' ? modelA : modelB;
    const fallbackResult = selectedArm === 'A' ? modelB : modelA;

    if (selectedResult?.error && !fallbackResult?.error) {
      console.warn(`[TalentAI][ABTEST][${taskMode}] Selected arm failed, falling back to other arm`);
    }

    const effectiveResult = selectedResult?.error ? fallbackResult : selectedResult;

    if (!effectiveResult || effectiveResult.error) {
      throw new Error(effectiveResult?.error || 'Both A/B models failed');
    }

    const record = {
      timestamp: new Date().toISOString(),
      taskMode,
      selectedArm,
      selectedModel: effectiveResult.model,
      modelA,
      modelB
    };

    abTestResults.push(record);

    console.log(`[TalentAI][ABTEST][${taskMode}] Completed A/B test. Selected model=${effectiveResult.model}`);

    return {
      selectedArm,
      selectedModel: effectiveResult.model,
      selectedResult: effectiveResult,
      comparison: {
        modelA,
        modelB
      },
      record
    };
  } catch (error) {
    console.error('[TalentAI][ABTEST][INTERNAL] A/B test failed:', error.message);
    throw error;
  }
}

/**
 * Returns all A/B test records.
 * @returns {Array<object>}
 */
function getABTestResults() {
  try {
    return abTestResults.slice();
  } catch (error) {
    console.error('[TalentAI][ABTEST][INTERNAL] Failed to read A/B test results:', error.message);
    return [];
  }
}

/**
 * Clears A/B test records.
 * @returns {{ok:boolean}}
 */
function resetABTestResults() {
  try {
    abTestResults.length = 0;
    return { ok: true };
  } catch (error) {
    console.error('[TalentAI][ABTEST][INTERNAL] Failed to reset A/B test results:', error.message);
    return { ok: false };
  }
}

module.exports = {
  runABTest,
  getABTestResults,
  resetABTestResults,
  abTestResults
};
