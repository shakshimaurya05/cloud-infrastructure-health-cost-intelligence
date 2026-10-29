import { GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import { costExplorerClient, getExecutionMode, checkAwsConfigured } from '../config/aws.js';
import { getDemoCosts } from './demo.data.js';

/**
 * Formats a Date object to YYYY-MM-DD string.
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Calculates default date range for cost reporting (last 14 days up to today).
 * Note: Cost Explorer requires End date to be strictly greater than Start date.
 * @returns {{ startDate: string, endDate: string }}
 */
function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 14);

  return {
    startDate: formatDate(start),
    endDate: formatDate(end)
  };
}

/**
 * Retrieves AWS cost and usage data from AWS Cost Explorer or demo dataset.
 * Supports configurable date range and service-level breakdown.
 * 
 * @param {string} [customStart] - YYYY-MM-DD
 * @param {string} [customEnd] - YYYY-MM-DD
 * @returns {Promise<{
 *   currency: string,
 *   totalCost: number,
 *   dailyCosts: Array<{ date: string, amount: number, unit: string }>,
 *   serviceBreakdown: Array<{ service: string, amount: number, unit: string, percentage: number }>,
 *   mode: 'live' | 'demo',
 *   warning?: string
 * }>}
 */
export async function getAwsCosts(customStart, customEnd) {
  const isConfigured = await checkAwsConfigured();
  const executionMode = getExecutionMode(isConfigured);

  const defaults = getDefaultDateRange();
  const startDate = customStart || defaults.startDate;
  const endDate = customEnd || defaults.endDate;

  // Forced Demo Mode
  if (executionMode === 'demo' && (process.env.DEMO_MODE === 'demo' || process.env.DEMO_MODE === 'true')) {
    const demo = getDemoCosts(14);
    return {
      ...demo,
      mode: 'demo'
    };
  }

  try {
    const command = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate,
        End: endDate
      },
      Granularity: 'DAILY',
      Metrics: ['UnblendedCost'],
      GroupBy: [
        {
          Type: 'DIMENSION',
          Key: 'SERVICE'
        }
      ]
    });

    const response = await costExplorerClient.send(command);
    const resultsByTime = response.ResultsByTime || [];

    let detectedCurrency = 'USD';
    const dailyCosts = [];
    const serviceMap = new Map();
    let calculatedTotal = 0;

    for (const timeEntry of resultsByTime) {
      const date = timeEntry.TimePeriod?.Start || '';
      let daySum = 0;

      for (const group of (timeEntry.Groups || [])) {
        const serviceName = group.Keys?.[0] || 'Unknown Service';
        const costMetric = group.Metrics?.UnblendedCost;
        const amount = costMetric?.Amount ? parseFloat(costMetric.Amount) : 0;
        const unit = costMetric?.Unit || 'USD';

        if (unit && unit !== 'N/A') {
          detectedCurrency = unit;
        }

        daySum += amount;
        serviceMap.set(serviceName, (serviceMap.get(serviceName) || 0) + amount);
      }

      calculatedTotal += daySum;
      dailyCosts.push({
        date,
        amount: parseFloat(daySum.toFixed(2)),
        unit: detectedCurrency
      });
    }

    const totalCost = parseFloat(calculatedTotal.toFixed(2));

    const serviceBreakdown = Array.from(serviceMap.entries())
      .map(([service, amount]) => {
        const fixedAmount = parseFloat(amount.toFixed(2));
        const percentage = totalCost > 0 ? parseFloat(((fixedAmount / totalCost) * 100).toFixed(2)) : 0;
        return {
          service,
          amount: fixedAmount,
          unit: detectedCurrency,
          percentage
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return {
      currency: detectedCurrency,
      totalCost,
      dailyCosts,
      serviceBreakdown,
      mode: 'live'
    };
  } catch (error) {
    console.warn(`[Cost Service] Live Cost Explorer query failed: ${error.message}`);

    // If strict live mode is requested, propagate the error
    if (process.env.DEMO_MODE === 'live' || process.env.DEMO_MODE === 'false') {
      const err = new Error(`AWS Cost Explorer Error: ${error.message}`);
      err.code = error.name || 'AWS_COST_EXPLORER_ERROR';
      err.statusCode = error.$metadata?.httpStatusCode || 500;
      throw err;
    }

    // Graceful fallback to demo data
    const demo = getDemoCosts(14);
    return {
      ...demo,
      mode: 'demo',
      warning: `AWS Cost Explorer data unavailable (${error.name || error.message}). Cost Explorer may not be activated yet or billing permissions are restricted. Showing simulated demo data.`
    };
  }
}
