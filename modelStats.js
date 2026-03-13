/**
 * modelStats.js
 * Standalone performance tracker for TalentAI model routing.
 */

const modelPerformance = new Map();

/**
 * Builds a storage key for task and model pair.
 * @param {string} taskMode
 * @param {string} model
 * @returns {string}
 */
function getKey(taskMode, model) {
  try {
    return `${String(taskMode || '').toUpperCase()}::${String(model || '').toLowerCase()}`;
  } catch (error) {
    console.error('[TalentAI][STATS][INTERNAL] Failed to build stats key:', error.message);
    return 'UNKNOWN::unknown';
  }
}

/**
 * Returns a default stats bucket.
 * @returns {{taskMode:string,model:string,totalCalls:number,successCount:number,errorCount:number,totalLatencyMs:number,totalConfidence:number,totalCost:number,lastUsedAt:string|null}}
 */
function createEmptyStats() {
  try {
    return {
      taskMode: 'UNKNOWN',
      model: 'unknown',
      totalCalls: 0,
      successCount: 0,
      errorCount: 0,
      totalLatencyMs: 0,
      totalConfidence: 0,
      totalCost: 0,
      lastUsedAt: null
    };
  } catch (error) {
    console.error('[TalentAI][STATS][INTERNAL] Failed to create empty stats:', error.message);
    return {
      taskMode: 'UNKNOWN',
      model: 'unknown',
      totalCalls: 0,
      successCount: 0,
      errorCount: 0,
      totalLatencyMs: 0,
      totalConfidence: 0,
      totalCost: 0,
      lastUsedAt: null
    };
  }
}

/**
 * Records per-model performance metrics.
 * @param {{taskMode:string,model:string,latencyMs?:number,confidenceScore?:number,success?:boolean,cost?:number}} payload
 * @returns {{ok:boolean,key:string}}
 */
function recordModelPerformance(payload) {
  try {
    const taskMode = String(payload?.taskMode || 'UNKNOWN').toUpperCase();
    const model = String(payload?.model || 'unknown').toLowerCase();
    const latencyMs = Number(payload?.latencyMs || 0);
    const confidenceScore = Number(payload?.confidenceScore || 0);
    const success = Boolean(payload?.success);
    const cost = Number(payload?.cost || 0);

    const key = getKey(taskMode, model);
    const current = modelPerformance.get(key) || createEmptyStats();

    current.taskMode = taskMode;
    current.model = model;
    current.totalCalls += 1;
    current.successCount += success ? 1 : 0;
    current.errorCount += success ? 0 : 1;
    current.totalLatencyMs += latencyMs > 0 ? latencyMs : 0;
    current.totalConfidence += confidenceScore > 0 ? confidenceScore : 0;
    current.totalCost += cost > 0 ? cost : 0;
    current.lastUsedAt = new Date().toISOString();

    modelPerformance.set(key, current);
    return { ok: true, key };
  } catch (error) {
    console.error('[TalentAI][STATS][INTERNAL] Failed to record performance:', error.message);
    return { ok: false, key: 'UNKNOWN::unknown' };
  }
}

/**
 * Computes aggregate metrics for a single stats bucket.
 * @param {{totalCalls:number,successCount:number,totalLatencyMs:number,totalConfidence:number,totalCost:number,taskMode:string,model:string,errorCount:number,lastUsedAt:string|null}} bucket
 * @returns {{taskMode:string,model:string,totalCalls:number,successCount:number,errorCount:number,successRate:number,avgLatencyMs:number,avgConfidence:number,totalCost:number,avgCostPerCall:number,lastUsedAt:string|null}}
 */
function toAggregate(bucket) {
  try {
    const totalCalls = Number(bucket.totalCalls || 0);
    return {
      taskMode: bucket.taskMode,
      model: bucket.model,
      totalCalls,
      successCount: Number(bucket.successCount || 0),
      errorCount: Number(bucket.errorCount || 0),
      successRate: totalCalls > 0 ? Number((bucket.successCount / totalCalls).toFixed(4)) : 0,
      avgLatencyMs: totalCalls > 0 ? Number((bucket.totalLatencyMs / totalCalls).toFixed(2)) : 0,
      avgConfidence: totalCalls > 0 ? Number((bucket.totalConfidence / totalCalls).toFixed(4)) : 0,
      totalCost: Number((bucket.totalCost || 0).toFixed(8)),
      avgCostPerCall: totalCalls > 0 ? Number((bucket.totalCost / totalCalls).toFixed(8)) : 0,
      lastUsedAt: bucket.lastUsedAt || null
    };
  } catch (error) {
    console.error('[TalentAI][STATS][INTERNAL] Failed to aggregate bucket:', error.message);
    return {
      taskMode: 'UNKNOWN',
      model: 'unknown',
      totalCalls: 0,
      successCount: 0,
      errorCount: 0,
      successRate: 0,
      avgLatencyMs: 0,
      avgConfidence: 0,
      totalCost: 0,
      avgCostPerCall: 0,
      lastUsedAt: null
    };
  }
}

/**
 * Scores a model for best-per-task selection.
 * @param {{successRate:number,avgConfidence:number,avgLatencyMs:number,avgCostPerCall:number,totalCalls:number}} metric
 * @returns {number}
 */
function scoreMetric(metric) {
  try {
    const successScore = Math.min(1, Number(metric.successRate || 0));
    const confidenceScore = Math.min(1, Number(metric.avgConfidence || 0));
    const speedScore = 1 / (1 + Math.max(0, Number(metric.avgLatencyMs || 0)) / 2000);
    const costScore = 1 / (1 + Math.max(0, Number(metric.avgCostPerCall || 0)) * 100000);
    const sampleScore = Math.min(1, Number(metric.totalCalls || 0) / 25);

    return Number((
      successScore * 0.45 +
      confidenceScore * 0.2 +
      speedScore * 0.2 +
      costScore * 0.1 +
      sampleScore * 0.05
    ).toFixed(6));
  } catch (error) {
    console.error('[TalentAI][STATS][INTERNAL] Failed to score metric:', error.message);
    return 0;
  }
}

/**
 * Returns best performing model per task and detailed metrics.
 * @returns {{generatedAt:string,taskStats:Record<string,{bestModel:string|null,bestScore:number,models:Array<object>}>}}
 */
function getModelStats() {
  try {
    const aggregates = Array.from(modelPerformance.values()).map(toAggregate);
    const grouped = {};

    for (const row of aggregates) {
      if (!grouped[row.taskMode]) grouped[row.taskMode] = [];
      grouped[row.taskMode].push(row);
    }

    const taskStats = {};

    for (const taskMode of Object.keys(grouped)) {
      const models = grouped[taskMode].map((metric) => ({
        ...metric,
        score: scoreMetric(metric)
      }));

      models.sort((a, b) => b.score - a.score);

      taskStats[taskMode] = {
        bestModel: models[0]?.model || null,
        bestScore: models[0]?.score || 0,
        models
      };
    }

    return {
      generatedAt: new Date().toISOString(),
      taskStats
    };
  } catch (error) {
    console.error('[TalentAI][STATS][INTERNAL] Failed to get model stats:', error.message);
    return {
      generatedAt: new Date().toISOString(),
      taskStats: {}
    };
  }
}

/**
 * Clears all recorded model stats.
 * @returns {{ok:boolean}}
 */
function resetModelStats() {
  try {
    modelPerformance.clear();
    return { ok: true };
  } catch (error) {
    console.error('[TalentAI][STATS][INTERNAL] Failed to reset model stats:', error.message);
    return { ok: false };
  }
}

module.exports = {
  recordModelPerformance,
  getModelStats,
  resetModelStats
};
