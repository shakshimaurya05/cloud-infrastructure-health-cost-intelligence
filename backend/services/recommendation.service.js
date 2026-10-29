import { getEc2Instances } from './ec2.service.js';
import { getAllMetrics } from './cloudwatch.service.js';
import { getAnalyzedCostData } from './cost-analysis.service.js';
import { getDemoRecommendations } from './demo.data.js';

export const DEFAULT_RECOMMENDATION_THRESHOLDS = {
  lowCpuThreshold: 5,            // % CPU
  minDatapointsForLowCpu: 3,     // minimum observation points
  serviceDominanceThreshold: 40, // % of total expenditure
  significantSpendIncrease: 20   // % increase between periods
};

/**
 * Pure rule engine that evaluates cost optimization and rightsizing recommendations.
 * 
 * @param {object} params
 * @param {Array<object>} params.instances - EC2 instance list
 * @param {Array<object>} params.metrics - CloudWatch metrics list
 * @param {object} [params.costAnalysis] - Analyzed Cost Explorer results
 * @param {object} [params.options] - Custom threshold overrides
 * @returns {Array<object>} Evaluated recommendations
 */
export function evaluateRecommendationRules({
  instances = [],
  metrics = [],
  costAnalysis = null,
  options = {}
}) {
  const recommendations = [];
  const thresholds = {
    ...DEFAULT_RECOMMENDATION_THRESHOLDS,
    ...options
  };

  const metricsMap = new Map();
  for (const m of metrics) {
    if (m && m.instanceId) {
      metricsMap.set(m.instanceId, m);
    }
  }

  // RULE 1 & 4: Sizing and Monitoring recommendations for instances
  for (const inst of instances) {
    const isRunning = (inst.state || '').toLowerCase() === 'running';
    const isStopped = (inst.state || '').toLowerCase() === 'stopped';

    // RULE 1: Consistently low CPU utilization -> Rightsizing review
    if (isRunning) {
      const metric = metricsMap.get(inst.instanceId);

      if (
        metric &&
        Array.isArray(metric.datapoints) &&
        metric.datapoints.length >= thresholds.minDatapointsForLowCpu &&
        typeof metric.average === 'number' &&
        metric.average <= thresholds.lowCpuThreshold
      ) {
        recommendations.push({
          id: `rec-rightsize-${inst.instanceId}`,
          title: 'Review EC2 Instance Sizing',
          description: `Instance ${inst.name || inst.instanceId} (${inst.instanceId}, ${inst.instanceType}) has had consistently low CPU utilization (average: ${metric.average.toFixed(1)}%) during the observation period. Review for possible downsizing or switching to burstable instance family.`,
          resourceId: inst.instanceId,
          priority: 'medium',
          estimatedMonthlySavings: null, // As required: Do not invent savings estimates. Use null.
          currency: 'USD',
          status: 'review',
          // Backward compatibility
          category: 'Cost Optimization',
          impact: 'Medium'
        });
      }

      // RULE 4: Insufficient monitoring data
      if (!metric || !Array.isArray(metric.datapoints) || metric.datapoints.length === 0 || metric.error) {
        recommendations.push({
          id: `rec-monitoring-${inst.instanceId}`,
          title: 'Review Monitoring Data Coverage',
          description: `Instance ${inst.name || inst.instanceId} (${inst.instanceId}) has insufficient or unavailable CloudWatch monitoring data. Review CloudWatch agent installation and metrics collection to establish utilization baselines.`,
          resourceId: inst.instanceId,
          priority: 'low',
          estimatedMonthlySavings: null,
          currency: 'USD',
          status: 'review',
          category: 'Governance & Monitoring',
          impact: 'Low'
        });
      }
    }

    // RULE 2: Stopped instances check for ongoing storage & associated charges
    if (isStopped) {
      recommendations.push({
        id: `rec-storage-stopped-${inst.instanceId}`,
        title: 'Review Storage and Charges for Stopped Instance',
        description: `Instance ${inst.name || inst.instanceId} (${inst.instanceId}) is stopped but may continue to incur charges for attached EBS volumes, provisioned IOPS, or unassociated Elastic IPs. Verify if the instance and storage can be archived to snapshots or terminated.`,
        resourceId: inst.instanceId,
        priority: 'medium',
        estimatedMonthlySavings: null,
        currency: 'USD',
        status: 'review',
        category: 'Cost Optimization',
        impact: 'Medium'
      });
    }
  }

  // RULE 3: Services with large spending increases or dominance
  if (costAnalysis && typeof costAnalysis === 'object') {
    const highestService = costAnalysis.highestCostService;
    if (highestService && highestService.percentage >= thresholds.serviceDominanceThreshold) {
      recommendations.push({
        id: `rec-spend-dominant-${highestService.service.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        title: `Investigate Dominant Expenditure: ${highestService.service}`,
        description: `${highestService.service} accounts for ${highestService.percentage}% ($${highestService.amount}) of total expenditure for the period. Review architectural usage drivers, committed use discounts, or Savings Plans eligibility.`,
        resourceId: highestService.service,
        priority: 'high',
        estimatedMonthlySavings: null,
        currency: 'USD',
        status: 'review',
        category: 'Cost Optimization',
        impact: 'High'
      });
    }

    if (
      costAnalysis.periodComparison &&
      typeof costAnalysis.periodComparison.percentageChange === 'number' &&
      costAnalysis.periodComparison.percentageChange >= thresholds.significantSpendIncrease
    ) {
      recommendations.push({
        id: 'rec-spend-spike-trend',
        title: 'Investigate Recent Expenditure Spike',
        description: `Cloud expenditure increased by ${costAnalysis.periodComparison.percentageChange}% compared to the prior observation period (from $${costAnalysis.periodComparison.previousPeriodTotal} to $${costAnalysis.periodComparison.currentPeriodTotal}). Investigate recent resource deployments and traffic spikes.`,
        resourceId: 'AWS-Expenditure',
        priority: 'high',
        estimatedMonthlySavings: null,
        currency: 'USD',
        status: 'review',
        category: 'Cost Optimization',
        impact: 'High'
      });
    }
  }

  return recommendations;
}

/**
 * Orchestrator service to retrieve cost optimization recommendations.
 * Avoids duplicating AWS integration logic and separates demo from live mode.
 * 
 * @param {object} [options]
 * @returns {Promise<{ recommendations: Array<object>, mode: 'live' | 'demo', warning?: string }>}
 */
export async function getOptimizationRecommendations(options = {}) {
  // Forced demo mode
  if (process.env.DEMO_MODE === 'demo' || process.env.DEMO_MODE === 'true') {
    return {
      recommendations: getDemoRecommendations(),
      mode: 'demo'
    };
  }

  try {
    const [ec2Result, metricsResult, costAnalysis] = await Promise.all([
      getEc2Instances(),
      getAllMetrics(options),
      getAnalyzedCostData()
    ]);

    // If core services fell back to demo, return demo recommendations
    if (
      ec2Result.mode === 'demo' ||
      metricsResult.mode === 'demo' ||
      costAnalysis.mode === 'demo'
    ) {
      return {
        recommendations: getDemoRecommendations(),
        mode: 'demo',
        warning: ec2Result.warning || costAnalysis.warning || 'AWS live services unavailable. Showing simulated recommendations.'
      };
    }

    // Live mode: Evaluate rules on real AWS data
    const recommendations = evaluateRecommendationRules({
      instances: ec2Result.instances || [],
      metrics: metricsResult.metrics || [],
      costAnalysis,
      options
    });

    return {
      recommendations,
      mode: 'live'
    };
  } catch (error) {
    console.warn(`[Recommendation Service] Failed to evaluate live recommendations: ${error.message}`);

    if (process.env.DEMO_MODE === 'live' || process.env.DEMO_MODE === 'false') {
      const err = new Error(`Recommendation Error: ${error.message}`);
      err.statusCode = 500;
      throw err;
    }

    return {
      recommendations: getDemoRecommendations(),
      mode: 'demo',
      warning: `AWS live query failed (${error.message}). Showing simulated recommendations.`
    };
  }
}
