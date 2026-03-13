/**
 * costTracker.js
 * Tracks estimated token usage and spend per task/model.
 */

const usageRecords = [];

/**
 * Adds a usage record for one model call.
 * @param {{taskMode:string,model:string,promptTokens?:number,completionTokens?:number,costPerToken?:number,latencyMs?:number,success?:boolean,metadata?:object}} payload
 * @returns {{ok:boolean,record:object|null}}
 */
function trackCost(payload) {
  try {
    const promptTokens = Math.max(0, Number(payload?.promptTokens || 0));
    const completionTokens = Math.max(0, Number(payload?.completionTokens || 0));
    const totalTokens = promptTokens + completionTokens;
    const costPerToken = Math.max(0, Number(payload?.costPerToken || 0));
    const estimatedCost = Number((totalTokens * costPerToken).toFixed(8));

    const record = {
      timestamp: new Date().toISOString(),
      taskMode: String(payload?.taskMode || 'UNKNOWN').toUpperCase(),
      model: String(payload?.model || 'unknown').toLowerCase(),
      promptTokens,
      completionTokens,
      totalTokens,
      costPerToken,
      estimatedCost,
      latencyMs: Math.max(0, Number(payload?.latencyMs || 0)),
      success: Boolean(payload?.success),
      metadata: payload?.metadata || {}
    };

    usageRecords.push(record);
    return { ok: true, record };
  } catch (error) {
    console.error('[TalentAI][COST][INTERNAL] Failed to track cost:', error.message);
    return { ok: false, record: null };
  }
}

/**
 * Summarizes total and grouped cost metrics.
 * @returns {{generatedAt:string,totalCalls:number,totalTokens:number,totalEstimatedCost:number,byTask:Record<string,object>,byModel:Record<string,object>}}
 */
function getCostReport() {
  try {
    const byTask = {};
    const byModel = {};

    for (const row of usageRecords) {
      if (!byTask[row.taskMode]) {
        byTask[row.taskMode] = { calls: 0, tokens: 0, estimatedCost: 0 };
      }

      if (!byModel[row.model]) {
        byModel[row.model] = { calls: 0, tokens: 0, estimatedCost: 0 };
      }

      byTask[row.taskMode].calls += 1;
      byTask[row.taskMode].tokens += row.totalTokens;
      byTask[row.taskMode].estimatedCost += row.estimatedCost;

      byModel[row.model].calls += 1;
      byModel[row.model].tokens += row.totalTokens;
      byModel[row.model].estimatedCost += row.estimatedCost;
    }

    for (const key of Object.keys(byTask)) {
      byTask[key].estimatedCost = Number(byTask[key].estimatedCost.toFixed(8));
    }

    for (const key of Object.keys(byModel)) {
      byModel[key].estimatedCost = Number(byModel[key].estimatedCost.toFixed(8));
    }

    const totalTokens = usageRecords.reduce((sum, r) => sum + r.totalTokens, 0);
    const totalEstimatedCost = Number(
      usageRecords.reduce((sum, r) => sum + r.estimatedCost, 0).toFixed(8)
    );

    return {
      generatedAt: new Date().toISOString(),
      totalCalls: usageRecords.length,
      totalTokens,
      totalEstimatedCost,
      byTask,
      byModel
    };
  } catch (error) {
    console.error('[TalentAI][COST][INTERNAL] Failed to build cost report:', error.message);
    return {
      generatedAt: new Date().toISOString(),
      totalCalls: 0,
      totalTokens: 0,
      totalEstimatedCost: 0,
      byTask: {},
      byModel: {}
    };
  }
}

/**
 * Returns all raw cost records.
 * @returns {Array<object>}
 */
function getCostRecords() {
  try {
    return usageRecords.slice();
  } catch (error) {
    console.error('[TalentAI][COST][INTERNAL] Failed to fetch cost records:', error.message);
    return [];
  }
}

/**
 * Clears all tracked cost data.
 * @returns {{ok:boolean}}
 */
function resetCostTracker() {
  try {
    usageRecords.length = 0;
    return { ok: true };
  } catch (error) {
    console.error('[TalentAI][COST][INTERNAL] Failed to reset cost tracker:', error.message);
    return { ok: false };
  }
}

module.exports = {
  trackCost,
  getCostReport,
  getCostRecords,
  resetCostTracker
};
