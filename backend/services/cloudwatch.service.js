import { GetMetricStatisticsCommand, DescribeAlarmsCommand } from '@aws-sdk/client-cloudwatch';
import { cloudWatchClient, getExecutionMode, checkAwsConfigured } from '../config/aws.js';
import { getEc2Instances } from './ec2.service.js';
import { getDemoMetrics, getDemoAlerts } from './demo.data.js';

/**
 * Retrieves CPU utilization metrics for a specific EC2 instance from CloudWatch.
 * 
 * @param {string} instanceId
 * @param {string} instanceName
 * @param {number} lookbackHours
 * @param {number} periodSeconds
 * @returns {Promise<object>}
 */
export async function getInstanceCpuMetrics(instanceId, instanceName = '', lookbackHours = 24, periodSeconds = 3600) {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - lookbackHours * 3600 * 1000);

  // AWS CloudWatch requires period in multiples of 60
  const adjustedPeriod = Math.max(60, Math.floor(periodSeconds / 60) * 60);

  try {
    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/EC2',
      MetricName: 'CPUUtilization',
      Dimensions: [
        {
          Name: 'InstanceId',
          Value: instanceId
        }
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: adjustedPeriod,
      Statistics: ['Average', 'Maximum', 'Minimum'],
      Unit: 'Percent'
    });

    const response = await cloudWatchClient.send(command);
    const rawPoints = response.Datapoints || [];

    // Sort chronologically
    const datapoints = rawPoints
      .sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp))
      .map((dp) => ({
        timestamp: new Date(dp.Timestamp).toISOString(),
        average: dp.Average !== undefined ? parseFloat(dp.Average.toFixed(2)) : 0,
        maximum: dp.Maximum !== undefined ? parseFloat(dp.Maximum.toFixed(2)) : 0,
        minimum: dp.Minimum !== undefined ? parseFloat(dp.Minimum.toFixed(2)) : 0
      }));

    const avgVal = datapoints.length > 0
      ? parseFloat((datapoints.reduce((sum, d) => sum + d.average, 0) / datapoints.length).toFixed(2))
      : 0;
    const maxVal = datapoints.length > 0
      ? Math.max(...datapoints.map((d) => d.maximum))
      : 0;
    const minVal = datapoints.length > 0
      ? Math.min(...datapoints.map((d) => d.minimum))
      : 0;

    return {
      instanceId,
      instanceName: instanceName || instanceId,
      metricName: 'CPUUtilization',
      unit: 'Percent',
      average: avgVal,
      maximum: maxVal,
      minimum: minVal,
      datapoints
    };
  } catch (error) {
    console.warn(`[CloudWatch Service] Failed to get metrics for ${instanceId}: ${error.message}`);
    // Graceful handling of missing/inaccessible metrics
    return {
      instanceId,
      instanceName: instanceName || instanceId,
      metricName: 'CPUUtilization',
      unit: 'Percent',
      average: 0,
      maximum: 0,
      minimum: 0,
      datapoints: [],
      error: error.message
    };
  }
}

/**
 * Retrieves CPU metrics for all instances or a target instance.
 * 
 * @param {object} options
 * @param {number} [options.lookbackHours=24]
 * @param {number} [options.period=3600]
 * @param {string} [options.instanceId]
 * @returns {Promise<{ metrics: Array<object>, mode: 'live' | 'demo', warning?: string }>}
 */
export async function getAllMetrics(options = {}) {
  const isConfigured = await checkAwsConfigured();
  const executionMode = getExecutionMode(isConfigured);

  const lookbackHours = parseInt(options.lookbackHours, 10) || 24;
  const period = parseInt(options.period, 10) || 3600;

  if (executionMode === 'demo' && (process.env.DEMO_MODE === 'demo' || process.env.DEMO_MODE === 'true')) {
    return {
      metrics: getDemoMetrics(lookbackHours),
      mode: 'demo'
    };
  }

  try {
    let instancesToQuery = [];

    if (options.instanceId) {
      instancesToQuery = [{ instanceId: options.instanceId, name: options.instanceId }];
    } else {
      const ec2Result = await getEc2Instances();
      // If EC2 service fell back to demo, use demo metrics as well
      if (ec2Result.mode === 'demo') {
        return {
          metrics: getDemoMetrics(lookbackHours),
          mode: 'demo',
          warning: ec2Result.warning || 'AWS live metrics unavailable. Showing simulated demo data.'
        };
      }
      instancesToQuery = ec2Result.instances;
    }

    if (instancesToQuery.length === 0) {
      return {
        metrics: [],
        mode: 'live'
      };
    }

    // Query metrics in parallel with bounded concurrency
    const metricPromises = instancesToQuery.map((inst) =>
      getInstanceCpuMetrics(inst.instanceId, inst.name, lookbackHours, period)
    );

    const metrics = await Promise.all(metricPromises);

    return {
      metrics,
      mode: 'live'
    };
  } catch (error) {
    console.warn(`[CloudWatch Service] Live metrics query failed: ${error.message}`);

    if (process.env.DEMO_MODE === 'live' || process.env.DEMO_MODE === 'false') {
      const err = new Error(`AWS CloudWatch Error: ${error.message}`);
      err.code = error.name || 'AWS_CLOUDWATCH_ERROR';
      err.statusCode = error.$metadata?.httpStatusCode || 500;
      throw err;
    }

    return {
      metrics: getDemoMetrics(lookbackHours),
      mode: 'demo',
      warning: `AWS live metrics unavailable (${error.name || error.message}). Showing simulated demo data.`
    };
  }
}

/**
 * Retrieves CloudWatch alarms and active alerts.
 * 
 * @returns {Promise<{ alerts: Array<object>, mode: 'live' | 'demo', warning?: string }>}
 */
export async function getCloudWatchAlerts() {
  const isConfigured = await checkAwsConfigured();
  const executionMode = getExecutionMode(isConfigured);

  if (executionMode === 'demo' && (process.env.DEMO_MODE === 'demo' || process.env.DEMO_MODE === 'true')) {
    return {
      alerts: getDemoAlerts(),
      mode: 'demo'
    };
  }

  try {
    const command = new DescribeAlarmsCommand({
      StateValue: 'ALARM'
    });

    const response = await cloudWatchClient.send(command);
    const metricAlarms = response.MetricAlarms || [];

    const alerts = metricAlarms.map((alarm) => {
      let resourceId = 'Unknown';
      let resourceType = 'CloudWatch';

      if (alarm.Dimensions && alarm.Dimensions.length > 0) {
        resourceId = alarm.Dimensions[0].Value;
        resourceType = alarm.Dimensions[0].Name;
      }

      return {
        id: alarm.AlarmArn || alarm.AlarmName,
        name: alarm.AlarmName,
        type: 'error',
        resourceId,
        resourceType,
        message: alarm.AlarmDescription || `${alarm.AlarmName} is in ALARM state: ${alarm.StateReason}`,
        timestamp: alarm.StateUpdatedTimestamp ? new Date(alarm.StateUpdatedTimestamp).toISOString() : new Date().toISOString(),
        severity: 'high'
      };
    });

    return {
      alerts,
      mode: 'live'
    };
  } catch (error) {
    console.warn(`[CloudWatch Service] CloudWatch alarms query failed: ${error.message}`);

    if (process.env.DEMO_MODE === 'live' || process.env.DEMO_MODE === 'false') {
      const err = new Error(`AWS CloudWatch Alarms Error: ${error.message}`);
      err.code = error.name || 'AWS_CLOUDWATCH_ERROR';
      err.statusCode = error.$metadata?.httpStatusCode || 500;
      throw err;
    }

    return {
      alerts: getDemoAlerts(),
      mode: 'demo',
      warning: `AWS live alarms unavailable (${error.name || error.message}). Showing simulated demo data.`
    };
  }
}
