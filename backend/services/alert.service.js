import { getEc2Instances } from './ec2.service.js';
import { getAllMetrics, getCloudWatchAlerts } from './cloudwatch.service.js';
import { getAwsCosts } from './cost.service.js';
import { getDemoAlerts } from './demo.data.js';

/**
 * Default configurable thresholds for infrastructure alerts
 */
export const DEFAULT_ALERT_THRESHOLDS = {
  highCpuWarningThreshold: 80,   // % CPU
  criticalCpuThreshold: 95,      // % CPU
  lowCpuThreshold: 5,            // % CPU
  minDatapointsForLowCpu: 3      // minimum observation points
};

/**
 * Pure rule evaluation function to generate infrastructure alerts.
 * 
 * @param {object} params
 * @param {Array<object>} params.instances - List of EC2 instances
 * @param {Array<object>} params.metrics - List of CloudWatch instance metrics
 * @param {object} [params.costData] - Cost Explorer result or error info
 * @param {Array<object>} [params.cloudWatchAlarms] - Native CloudWatch alarms
 * @param {object} [params.options] - Custom threshold overrides
 * @returns {Array<object>} Evaluated alerts
 */
export function evaluateInfrastructureAlertRules({
  instances = [],
  metrics = [],
  costData = null,
  cloudWatchAlarms = [],
  options = {}
}) {
  const alerts = [];
  const thresholds = {
    ...DEFAULT_ALERT_THRESHOLDS,
    ...options
  };

  const metricsMap = new Map();
  for (const m of metrics) {
    if (m && m.instanceId) {
      metricsMap.set(m.instanceId, m);
    }
  }

  // RULE 1: EC2 instance stopped
  // Explanation: Do not mark every stopped instance as critical; explain it may be intentional/scheduled.
  for (const inst of instances) {
    if (inst.state && inst.state.toLowerCase() === 'stopped') {
      const alertId = `alert-ec2-stopped-${inst.instanceId}`;
      const desc = `EC2 instance ${inst.name || inst.instanceId} (${inst.instanceId}) is stopped. Note: Stopped instances may be intentional or scheduled, but provisioned EBS storage charges persist.`;
      const now = new Date().toISOString();

      alerts.push({
        id: alertId,
        title: 'EC2 Instance Stopped',
        severity: 'info',
        description: desc,
        resourceId: inst.instanceId,
        source: 'EC2',
        createdAt: now,
        // Backward-compatibility properties
        type: 'info',
        message: desc,
        resourceType: 'EC2',
        timestamp: now
      });
    }
  }

  // RULE 2, 3 & 4: Metric-based rules (for running instances)
  for (const inst of instances) {
    const isRunning = (inst.state || '').toLowerCase() === 'running';
    if (!isRunning) continue;

    const metric = metricsMap.get(inst.instanceId);

    // RULE 4: Required metrics are unavailable for running instance
    if (!metric || !metric.datapoints || metric.datapoints.length === 0 || metric.error) {
      const alertId = `alert-metric-missing-${inst.instanceId}`;
      const desc = `CloudWatch CPU utilization metrics are currently unavailable for running instance ${inst.name || inst.instanceId}.`;
      const now = new Date().toISOString();

      alerts.push({
        id: alertId,
        title: 'CloudWatch Metrics Unavailable',
        severity: 'info',
        description: desc,
        resourceId: inst.instanceId,
        source: 'CloudWatch',
        createdAt: now,
        type: 'info',
        message: desc,
        resourceType: 'CloudWatch',
        timestamp: now
      });
      continue;
    }

    const avgCpu = typeof metric.average === 'number' ? metric.average : 0;
    const maxCpu = typeof metric.maximum === 'number' ? metric.maximum : avgCpu;

    // RULE 2: CPU utilization exceeds configurable threshold
    if (maxCpu >= thresholds.criticalCpuThreshold) {
      const alertId = `alert-cpu-critical-${inst.instanceId}`;
      const desc = `Critical CPU utilization on ${inst.name || inst.instanceId}: peak observed at ${maxCpu.toFixed(1)}% (threshold: ${thresholds.criticalCpuThreshold}%).`;
      const now = new Date().toISOString();

      alerts.push({
        id: alertId,
        title: 'Critical CPU Utilization',
        severity: 'critical',
        description: desc,
        resourceId: inst.instanceId,
        source: 'CloudWatch',
        createdAt: now,
        type: 'error',
        message: desc,
        resourceType: 'CloudWatch',
        timestamp: now
      });
    } else if (avgCpu >= thresholds.highCpuWarningThreshold || maxCpu >= thresholds.highCpuWarningThreshold) {
      const alertId = `alert-cpu-high-${inst.instanceId}`;
      const desc = `High CPU utilization on ${inst.name || inst.instanceId}: average is ${avgCpu.toFixed(1)}%, peak observed at ${maxCpu.toFixed(1)}% (threshold: ${thresholds.highCpuWarningThreshold}%).`;
      const now = new Date().toISOString();

      alerts.push({
        id: alertId,
        title: 'High CPU Utilization',
        severity: 'warning',
        description: desc,
        resourceId: inst.instanceId,
        source: 'CloudWatch',
        createdAt: now,
        type: 'warning',
        message: desc,
        resourceType: 'CloudWatch',
        timestamp: now
      });
    }

    // RULE 3: CPU utilization remains consistently low over available observation period
    if (
      metric.datapoints.length >= thresholds.minDatapointsForLowCpu &&
      avgCpu <= thresholds.lowCpuThreshold
    ) {
      const alertId = `alert-cpu-low-${inst.instanceId}`;
      const desc = `Consistently low CPU utilization on ${inst.name || inst.instanceId}: average is ${avgCpu.toFixed(1)}% over ${metric.datapoints.length} data points (underutilization threshold: ${thresholds.lowCpuThreshold}%).`;
      const now = new Date().toISOString();

      alerts.push({
        id: alertId,
        title: 'Consistently Low CPU Utilization',
        severity: 'info',
        description: desc,
        resourceId: inst.instanceId,
        source: 'CloudWatch',
        createdAt: now,
        type: 'info',
        message: desc,
        resourceType: 'CloudWatch',
        timestamp: now
      });
    }
  }

  // RULE 5: AWS cost data could not be retrieved
  if (costData && (costData.error || (costData.warning && costData.totalCost === 0))) {
    const alertId = 'alert-cost-retrieval-failed';
    const desc = `AWS Cost Explorer spend data could not be retrieved: ${costData.error || costData.warning}`;
    const now = new Date().toISOString();

    alerts.push({
      id: alertId,
      title: 'Cost Explorer Data Unavailable',
      severity: 'warning',
      description: desc,
      resourceId: 'AWS-Cost-Explorer',
      source: 'CostExplorer',
      createdAt: now,
      type: 'warning',
      message: desc,
      resourceType: 'CostExplorer',
      timestamp: now
    });
  }

  // RULE 6: Native CloudWatch Alarms in ALARM state
  for (const alarm of cloudWatchAlarms) {
    if (alarm.id && !alerts.some((a) => a.id === alarm.id)) {
      alerts.push({
        id: alarm.id,
        title: alarm.name || 'CloudWatch Alarm Active',
        severity: 'critical',
        description: alarm.message || 'CloudWatch alarm triggered in ALARM state.',
        resourceId: alarm.resourceId || 'CloudWatch',
        source: 'CloudWatch',
        createdAt: alarm.timestamp || new Date().toISOString(),
        type: 'error',
        message: alarm.message,
        resourceType: alarm.resourceType || 'CloudWatch',
        timestamp: alarm.timestamp || new Date().toISOString()
      });
    }
  }

  return alerts;
}

/**
 * Orchestrator service to retrieve infrastructure alerts.
 * Uses existing EC2, CloudWatch, and Cost services.
 * Keeps demo mode completely separate from live mode.
 * 
 * @param {object} [options]
 * @returns {Promise<{ alerts: Array<object>, mode: 'live' | 'demo', warning?: string }>}
 */
export async function getInfrastructureAlerts(options = {}) {
  // Check if forced demo mode
  if (process.env.DEMO_MODE === 'demo' || process.env.DEMO_MODE === 'true') {
    return {
      alerts: getDemoAlerts(),
      mode: 'demo'
    };
  }

  try {
    const [ec2Result, metricsResult, costsResult, nativeAlarmsResult] = await Promise.all([
      getEc2Instances(),
      getAllMetrics(options),
      getAwsCosts(),
      getCloudWatchAlerts()
    ]);

    // If any core service fell back to demo mode, serve demo alerts with explicit label
    if (
      ec2Result.mode === 'demo' ||
      metricsResult.mode === 'demo' ||
      costsResult.mode === 'demo'
    ) {
      return {
        alerts: getDemoAlerts(),
        mode: 'demo',
        warning: ec2Result.warning || costsResult.warning || 'AWS live services unavailable. Showing simulated demo alerts.'
      };
    }

    // Live Mode: evaluate alerts using pure rule engine on real AWS data
    const alerts = evaluateInfrastructureAlertRules({
      instances: ec2Result.instances || [],
      metrics: metricsResult.metrics || [],
      costData: costsResult,
      cloudWatchAlarms: nativeAlarmsResult.alerts || [],
      options
    });

    return {
      alerts,
      mode: 'live'
    };
  } catch (error) {
    console.warn(`[Alert Service] Failed to evaluate live alerts: ${error.message}`);

    if (process.env.DEMO_MODE === 'live' || process.env.DEMO_MODE === 'false') {
      const err = new Error(`Infrastructure Alert Error: ${error.message}`);
      err.statusCode = 500;
      throw err;
    }

    return {
      alerts: getDemoAlerts(),
      mode: 'demo',
      warning: `AWS live query failed (${error.message}). Showing simulated demo alerts.`
    };
  }
}
