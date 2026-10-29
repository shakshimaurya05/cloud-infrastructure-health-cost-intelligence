import { getAwsCosts } from './cost.service.js';

/**
 * Calculates the highest-cost service from a service breakdown list.
 * 
 * @param {Array<{ service: string, amount: number, percentage: number }>} serviceBreakdown
 * @returns {{ service: string, amount: number, percentage: number } | null}
 */
export function calculateHighestCostService(serviceBreakdown = []) {
  if (!Array.isArray(serviceBreakdown) || serviceBreakdown.length === 0) {
    return null;
  }

  let highest = serviceBreakdown[0];
  for (let i = 1; i < serviceBreakdown.length; i++) {
    if (serviceBreakdown[i].amount > highest.amount) {
      highest = serviceBreakdown[i];
    }
  }

  return {
    service: highest.service,
    amount: highest.amount,
    percentage: highest.percentage
  };
}

/**
 * Computes daily expenditure trend metrics and direction.
 * 
 * @param {Array<{ date: string, amount: number }>} dailyCosts
 * @returns {{
 *   direction: 'increasing' | 'decreasing' | 'stable' | 'insufficient-data',
 *   averageDailySpend: number,
 *   minDailySpend: number,
 *   maxDailySpend: number
 * }}
 */
export function calculateDailyCostTrend(dailyCosts = []) {
  if (!Array.isArray(dailyCosts) || dailyCosts.length === 0) {
    return {
      direction: 'insufficient-data',
      averageDailySpend: 0,
      minDailySpend: 0,
      maxDailySpend: 0
    };
  }

  const amounts = dailyCosts.map((d) => (typeof d.amount === 'number' ? d.amount : 0));
  const sum = amounts.reduce((acc, v) => acc + v, 0);
  const averageDailySpend = parseFloat((sum / amounts.length).toFixed(2));
  const minDailySpend = Math.min(...amounts);
  const maxDailySpend = Math.max(...amounts);

  if (dailyCosts.length < 3) {
    return {
      direction: 'insufficient-data',
      averageDailySpend,
      minDailySpend,
      maxDailySpend
    };
  }

  // Compare first half to second half to identify spend direction
  const midpoint = Math.floor(amounts.length / 2);
  const firstHalf = amounts.slice(0, midpoint);
  const secondHalf = amounts.slice(midpoint);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);

  let direction = 'stable';
  if (firstAvg > 0) {
    const diffRatio = (secondAvg - firstAvg) / firstAvg;
    if (diffRatio > 0.05) {
      direction = 'increasing';
    } else if (diffRatio < -0.05) {
      direction = 'decreasing';
    }
  }

  return {
    direction,
    averageDailySpend,
    minDailySpend,
    maxDailySpend
  };
}

/**
 * Calculates percentage change between comparable sub-periods when sufficient data exists.
 * Requires at least 4 daily data points.
 * 
 * @param {Array<{ date: string, amount: number }>} dailyCosts
 * @returns {{
 *   previousPeriodTotal: number,
 *   currentPeriodTotal: number,
 *   percentageChange: number
 * } | null}
 */
export function calculatePeriodComparison(dailyCosts = []) {
  if (!Array.isArray(dailyCosts) || dailyCosts.length < 4) {
    return null;
  }

  const midpoint = Math.floor(dailyCosts.length / 2);
  const previousDays = dailyCosts.slice(0, midpoint);
  const currentDays = dailyCosts.slice(midpoint);

  const previousPeriodTotal = parseFloat(
    previousDays.reduce((sum, d) => sum + (d.amount || 0), 0).toFixed(2)
  );
  const currentPeriodTotal = parseFloat(
    currentDays.reduce((sum, d) => sum + (d.amount || 0), 0).toFixed(2)
  );

  let percentageChange = 0;
  if (previousPeriodTotal > 0) {
    percentageChange = parseFloat(
      (((currentPeriodTotal - previousPeriodTotal) / previousPeriodTotal) * 100).toFixed(2)
    );
  } else if (currentPeriodTotal > 0) {
    percentageChange = 100;
  }

  return {
    previousPeriodTotal,
    currentPeriodTotal,
    percentageChange
  };
}

/**
 * Pure analysis function analyzing raw Cost Explorer expenditure results.
 * Handles empty results and missing historical data without errors.
 * 
 * @param {object} rawCostData
 * @returns {object} Fully analyzed cost model
 */
export function analyzeCostData(rawCostData = {}) {
  const currency = rawCostData.currency || 'USD';
  const totalCost = typeof rawCostData.totalCost === 'number' ? rawCostData.totalCost : 0;
  const dailyCosts = Array.isArray(rawCostData.dailyCosts) ? rawCostData.dailyCosts : [];
  const serviceBreakdown = Array.isArray(rawCostData.serviceBreakdown) ? rawCostData.serviceBreakdown : [];
  const mode = rawCostData.mode || 'live';

  const highestCostService = calculateHighestCostService(serviceBreakdown);
  const dailyTrend = calculateDailyCostTrend(dailyCosts);
  const periodComparison = calculatePeriodComparison(dailyCosts);
  const percentageChange = periodComparison ? periodComparison.percentageChange : null;

  return {
    currency,
    totalCost,
    dailyCosts,
    serviceBreakdown,
    highestCostService,
    dailyTrend,
    percentageChange,
    periodComparison,
    mode,
    ...(rawCostData.warning && { warning: rawCostData.warning })
  };
}

/**
 * Orchestrator to retrieve and analyze AWS expenditures.
 * Uses existing cost.service.js to avoid duplicating AWS SDK interactions.
 * 
 * @param {string} [startDate]
 * @param {string} [endDate]
 * @returns {Promise<object>}
 */
export async function getAnalyzedCostData(startDate, endDate) {
  const rawData = await getAwsCosts(startDate, endDate);
  return analyzeCostData(rawData);
}
