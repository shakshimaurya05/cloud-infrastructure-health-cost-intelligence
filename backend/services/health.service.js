import {
  DescribeInstanceStatusCommand,
  DescribeInstancesCommand
} from '@aws-sdk/client-ec2';
import { GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { ec2Client, cloudWatchClient, getExecutionMode, checkAwsConfigured } from '../config/aws.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_HEALTH_THRESHOLDS = {
  cpuWarning:  80,   // % — triggers "Warning" health status
  cpuCritical: 95    // % — triggers "Critical" health status
};

/**
 * Valid observation periods (in hours) the API accepts.
 * Each maps to a sensible CloudWatch granularity period.
 */
export const OBSERVATION_PERIODS = {
  1:  { label: 'Last 1 hour',   periodSeconds: 300  },  // 5-min points
  3:  { label: 'Last 3 hours',  periodSeconds: 300  },
  6:  { label: 'Last 6 hours',  periodSeconds: 600  },
  12: { label: 'Last 12 hours', periodSeconds: 900  },
  24: { label: 'Last 24 hours', periodSeconds: 3600 },
  72: { label: 'Last 3 days',   periodSeconds: 3600 }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPermissionError(err) {
  return (
    err.name === 'UnauthorizedOperation' ||
    err.name === 'AccessDeniedException' ||
    (err.Code === 'UnauthorizedOperation') ||
    (err.$metadata && err.$metadata.httpStatusCode === 403)
  );
}

// ─── Health Derivation (pure functions, fully testable) ───────────────────────

/**
 * Determines health status from CPU readings and EC2 status check results.
 *
 * IMPORTANT:
 *  - Stopped instances → "stopped", NEVER "unhealthy"
 *  - Missing metrics   → "unknown", NEVER treated as 0 or "healthy"
 *  - EC2 status-check failure is distinct from high CPU
 *  - Status-check failure takes priority over CPU thresholds for running instances
 *
 * @param {object} opts
 * @returns {'healthy'|'warning'|'critical'|'unknown'|'stopped'|'terminated'}
 */
export function deriveHealthStatus({
  instanceState,
  cpuAverage,         // null = no data; number = measured value
  cpuMaximum,         // null = no data
  hasStatusCheckFailed,
  thresholds = DEFAULT_HEALTH_THRESHOLDS
}) {
  const state = (instanceState || '').toLowerCase();

  if (state === 'terminated' || state === 'shutting-down') return 'terminated';
  if (state === 'stopped' || state === 'stopping')         return 'stopped';
  if (state !== 'running')                                 return 'unknown';

  // EC2 status check failure takes highest priority for running instances
  if (hasStatusCheckFailed === true) return 'critical';

  // Missing metrics → unknown (never healthy, never 0)
  if (cpuAverage == null) return 'unknown';

  const peak = cpuMaximum != null ? cpuMaximum : cpuAverage;

  if (peak >= thresholds.cpuCritical) return 'critical';
  if (peak >= thresholds.cpuWarning || cpuAverage >= thresholds.cpuWarning) return 'warning';

  return 'healthy';
}

/**
 * Builds a human-readable explanation of what triggered the current health status.
 * Distinguishes EC2 status checks from CPU-based alerts with exact metric values.
 */
export function buildHealthReason({
  instanceState,
  cpuAverage,
  cpuMaximum,
  hasStatusCheckFailed,
  statusCheckDetail,
  observationHours = 24,
  thresholds = DEFAULT_HEALTH_THRESHOLDS
}) {
  const state = (instanceState || '').toLowerCase();

  if (state === 'stopped')    return 'Instance is stopped. No health metrics are collected.';
  if (state === 'terminated') return 'Instance has been terminated.';
  if (state !== 'running')    return `Instance is in state: ${instanceState}.`;

  if (hasStatusCheckFailed) {
    const detail = statusCheckDetail || 'unknown failure';
    return `EC2 status check failed: ${detail}. This indicates a hardware or software issue at the hypervisor or OS level, not related to CPU load.`;
  }

  if (cpuAverage == null) {
    return `CPU utilization data is not available for the selected ${observationHours}h observation window. CloudWatch may not have published data points yet, or detailed monitoring may be disabled.`;
  }

  const peak = cpuMaximum != null ? cpuMaximum : cpuAverage;

  if (peak >= thresholds.cpuCritical) {
    return `Critical CPU utilization: peak reached ${peak.toFixed(1)}% during the ${observationHours}h window (threshold: ${thresholds.cpuCritical}%).`;
  }
  if (peak >= thresholds.cpuWarning || cpuAverage >= thresholds.cpuWarning) {
    return `Elevated CPU utilization: average ${cpuAverage.toFixed(1)}%, peak ${peak.toFixed(1)}% during the ${observationHours}h window (warning threshold: ${thresholds.cpuWarning}%).`;
  }

  return `CPU utilization normal: average ${cpuAverage.toFixed(1)}%, peak ${peak.toFixed(1)}% during the ${observationHours}h window.`;
}

// ─── AWS: EC2 Status Checks ───────────────────────────────────────────────────

/**
 * Fetches EC2 instance status checks for a list of instance IDs.
 * Returns a Map<instanceId, statusCheckResult>.
 * Only meaningful for running instances; stopped instances have no status data.
 *
 * @param {string[]} instanceIds
 * @returns {Promise<Map<string, object>>}
 */
export async function fetchEc2StatusChecks(instanceIds) {
  if (!instanceIds || instanceIds.length === 0) return new Map();

  const statusMap = new Map();

  try {
    let nextToken;
    do {
      const command = new DescribeInstanceStatusCommand({
        InstanceIds:        instanceIds.slice(0, 100), // AWS limit
        IncludeAllInstances: false,                    // running-only is correct
        MaxResults:         100,
        ...(nextToken ? { NextToken: nextToken } : {})
      });
      const resp = await ec2Client.send(command);
      nextToken = resp.NextToken;

      for (const s of (resp.InstanceStatuses || [])) {
        const instanceCheck = s.InstanceStatus && s.InstanceStatus.Status ? s.InstanceStatus.Status : 'unknown';
        const systemCheck   = s.SystemStatus   && s.SystemStatus.Status   ? s.SystemStatus.Status   : 'unknown';
        const failed = instanceCheck === 'impaired' || systemCheck === 'impaired';

        const failedChecks = [];
        for (const detail of (s.InstanceStatus && s.InstanceStatus.Details ? s.InstanceStatus.Details : [])) {
          if (detail.Status === 'failed') failedChecks.push(`Instance: ${detail.Name}`);
        }
        for (const detail of (s.SystemStatus && s.SystemStatus.Details ? s.SystemStatus.Details : [])) {
          if (detail.Status === 'failed') failedChecks.push(`System: ${detail.Name}`);
        }

        statusMap.set(s.InstanceId, {
          instanceStatus:     instanceCheck,
          systemStatus:       systemCheck,
          hasFailed:          failed,
          failedCheckDetails: failedChecks.join(', ') || null,
          availabilityZone:   s.AvailabilityZone,
          instanceState:      s.InstanceState ? s.InstanceState.Name : undefined
        });
      }
    } while (nextToken);
  } catch (err) {
    if (isPermissionError(err)) {
      console.warn(`[Health Service] No permission for DescribeInstanceStatus: ${err.message}`);
      // Return empty map — callers treat absent status as "unknown", not "healthy"
    } else {
      console.warn(`[Health Service] DescribeInstanceStatus failed: ${err.message}`);
    }
  }

  return statusMap;
}

// ─── AWS: CloudWatch CPU Metrics ─────────────────────────────────────────────

/**
 * Fetches CPU utilization for one instance.
 * CRITICAL: no datapoints → null averages (NEVER zero).
 *
 * @param {string} instanceId
 * @param {number} lookbackHours
 * @param {number} periodSeconds
 * @returns {Promise<object>}
 */
export async function fetchCpuMetricsForInstance(instanceId, lookbackHours, periodSeconds) {
  const endTime   = new Date();
  const startTime = new Date(endTime.getTime() - lookbackHours * 3600 * 1000);
  const period    = Math.max(60, Math.floor(periodSeconds / 60) * 60);

  try {
    const resp = await cloudWatchClient.send(new GetMetricStatisticsCommand({
      Namespace:  'AWS/EC2',
      MetricName: 'CPUUtilization',
      Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
      StartTime:  startTime,
      EndTime:    endTime,
      Period:     period,
      Statistics: ['Average', 'Maximum', 'Minimum'],
      Unit:       'Percent'
    }));

    const rawPoints = resp.Datapoints || [];

    if (rawPoints.length === 0) {
      // No data — do NOT substitute zero
      return {
        hasData:    false,
        average:    null,
        maximum:    null,
        minimum:    null,
        datapoints: [],
        unit:       'Percent',
        observedAt: new Date().toISOString()
      };
    }

    const sorted = rawPoints
      .sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp))
      .map((dp) => ({
        timestamp: new Date(dp.Timestamp).toISOString(),
        average:   dp.Average != null ? parseFloat(dp.Average.toFixed(2))   : null,
        maximum:   dp.Maximum != null ? parseFloat(dp.Maximum.toFixed(2))   : null,
        minimum:   dp.Minimum != null ? parseFloat(dp.Minimum.toFixed(2))   : null
      }));

    const validAvgs = sorted.map((d) => d.average).filter((v) => v !== null);
    const validMaxs = sorted.map((d) => d.maximum).filter((v) => v !== null);
    const validMins = sorted.map((d) => d.minimum).filter((v) => v !== null);

    return {
      hasData:    true,
      average:    validAvgs.length > 0 ? parseFloat((validAvgs.reduce((s, v) => s + v, 0) / validAvgs.length).toFixed(2)) : null,
      maximum:    validMaxs.length > 0 ? Math.max(...validMaxs) : null,
      minimum:    validMins.length > 0 ? Math.min(...validMins) : null,
      datapoints: sorted,
      unit:       'Percent',
      observedAt: new Date().toISOString()
    };
  } catch (err) {
    const permDenied = isPermissionError(err);
    console.warn(`[Health Service] CPU metrics for ${instanceId}: ${permDenied ? 'permission denied' : err.message}`);
    return {
      hasData:          false,
      average:          null,
      maximum:          null,
      minimum:          null,
      datapoints:       [],
      unit:             'Percent',
      error:            err.message,
      permissionDenied: permDenied,
      observedAt:       new Date().toISOString()
    };
  }
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

function generateDemoDatapoints(now, hours, baseCpu, variance) {
  const period  = OBSERVATION_PERIODS[hours] || OBSERVATION_PERIODS[24];
  const stepMs  = period.periodSeconds * 1000;
  const count   = Math.min(Math.floor((hours * 3600 * 1000) / stepMs), 48);
  const points  = [];

  for (let i = count; i >= 0; i--) {
    const ts   = new Date(now.getTime() - i * stepMs);
    const wave = Math.sin(((count - i) / count) * Math.PI * 2) * (variance * 0.6);
    const noise = (Math.random() - 0.5) * (variance * 0.4);
    const avg   = Math.min(100, Math.max(0.1, parseFloat((baseCpu + wave + noise).toFixed(2))));
    const max   = Math.min(100, parseFloat((avg + Math.random() * (variance * 0.4)).toFixed(2)));
    const min   = Math.max(0.1, parseFloat((avg - Math.random() * (variance * 0.3)).toFixed(2)));
    points.push({ timestamp: ts.toISOString(), average: avg, maximum: max, minimum: min });
  }
  return points;
}

export function getDemoHealthSummary(lookbackHours = 24, thresholds = DEFAULT_HEALTH_THRESHOLDS) {
  const now = new Date();

  const rawInstances = [
    {
      instanceId:       'i-09a8b7c6d5e4f3a21',
      name:             'production-api-01',
      instanceType:     't3.xlarge',
      instanceState:    'running',
      availabilityZone: 'us-east-1a',
      region:           'us-east-1',
      launchTime:       '2026-08-15T08:30:00.000Z',
      publicIp:         '54.22.11.100',
      privateIp:        '10.0.1.10',
      tags:             { Environment: 'production', Service: 'api' },
      statusCheck: {
        instanceStatus: 'ok', systemStatus: 'ok',
        hasFailed: false, failedCheckDetails: null
      },
      cpu: {
        hasData: true, average: 68.4, maximum: 92.1, minimum: 42.0,
        unit: 'Percent',
        datapoints: generateDemoDatapoints(now, lookbackHours, 68, 22),
        observedAt: now.toISOString()
      }
    },
    {
      instanceId:       'i-07b6c5d4e3f2a1b90',
      name:             'production-worker-01',
      instanceType:     'm5.large',
      instanceState:    'running',
      availabilityZone: 'us-east-1b',
      region:           'us-east-1',
      launchTime:       '2026-08-20T11:15:00.000Z',
      publicIp:         null,
      privateIp:        '10.0.2.20',
      tags:             { Environment: 'production' },
      statusCheck: {
        instanceStatus: 'ok', systemStatus: 'ok',
        hasFailed: false, failedCheckDetails: null
      },
      cpu: {
        hasData: true, average: 34.8, maximum: 53.6, minimum: 18.1,
        unit: 'Percent',
        datapoints: generateDemoDatapoints(now, lookbackHours, 34, 16),
        observedAt: now.toISOString()
      }
    },
    {
      instanceId:       'i-03e2f1a0b9c8d7e65',
      name:             'staging-api-01',
      instanceType:     't3.medium',
      instanceState:    'running',
      availabilityZone: 'us-east-1a',
      region:           'us-east-1',
      launchTime:       '2026-09-01T14:00:00.000Z',
      publicIp:         '18.90.1.55',
      privateIp:        '10.0.3.30',
      tags:             { Environment: 'staging' },
      statusCheck: {
        instanceStatus: 'ok', systemStatus: 'ok',
        hasFailed: false, failedCheckDetails: null
      },
      cpu: {
        hasData: true, average: 3.5, maximum: 13.2, minimum: 0.1,
        unit: 'Percent',
        datapoints: generateDemoDatapoints(now, lookbackHours, 3.5, 2.5),
        observedAt: now.toISOString()
      }
    },
    {
      // Demo: status check failure at NORMAL CPU — proves independence of checks
      instanceId:       'i-0d1e2f3a4b5c6d7e8',
      name:             'prod-payments-02',
      instanceType:     'c5.xlarge',
      instanceState:    'running',
      availabilityZone: 'us-east-1c',
      region:           'us-east-1',
      launchTime:       '2026-09-10T09:00:00.000Z',
      publicIp:         null,
      privateIp:        '10.0.4.40',
      tags:             { Environment: 'production' },
      statusCheck: {
        instanceStatus: 'impaired', systemStatus: 'ok',
        hasFailed: true, failedCheckDetails: 'Instance: reachability'
      },
      cpu: {
        hasData: true, average: 41.2, maximum: 55.0, minimum: 30.0,
        unit: 'Percent',
        datapoints: generateDemoDatapoints(now, lookbackHours, 41, 12),
        observedAt: now.toISOString()
      }
    },
    {
      instanceId:       'i-05c4d3e2f1a0b9c87',
      name:             'analytics-db-replica',
      instanceType:     'r5.xlarge',
      instanceState:    'stopped',
      availabilityZone: 'us-east-1c',
      region:           'us-east-1',
      launchTime:       '2026-07-10T09:00:00.000Z',
      publicIp:         null,
      privateIp:        '10.0.5.50',
      tags:             { Environment: 'production' },
      statusCheck: null, // stopped → no status checks
      cpu: { hasData: false, average: null, maximum: null, minimum: null, datapoints: [], unit: 'Percent', observedAt: now.toISOString() }
    },
    {
      instanceId:       'i-01f2e3d4c5b6a7980',
      name:             'dev-bastion-host',
      instanceType:     't3.nano',
      instanceState:    'stopped',
      availabilityZone: 'us-east-1a',
      region:           'us-east-1',
      launchTime:       '2026-09-15T16:45:00.000Z',
      publicIp:         null,
      privateIp:        '10.0.6.60',
      tags:             { Environment: 'dev' },
      statusCheck: null,
      cpu: { hasData: false, average: null, maximum: null, minimum: null, datapoints: [], unit: 'Percent', observedAt: now.toISOString() }
    }
  ];

  return rawInstances.map((inst) => {
    const health = deriveHealthStatus({
      instanceState:       inst.instanceState,
      cpuAverage:          inst.cpu.average,
      cpuMaximum:          inst.cpu.maximum,
      hasStatusCheckFailed: inst.statusCheck ? inst.statusCheck.hasFailed : null,
      thresholds
    });
    const healthReason = buildHealthReason({
      instanceState:        inst.instanceState,
      cpuAverage:           inst.cpu.average,
      cpuMaximum:           inst.cpu.maximum,
      hasStatusCheckFailed: inst.statusCheck ? inst.statusCheck.hasFailed : null,
      statusCheckDetail:    inst.statusCheck ? inst.statusCheck.failedCheckDetails : null,
      observationHours:     lookbackHours,
      thresholds
    });

    return { ...inst, health, healthReason };
  });
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Fetches a full health summary for all (or one) EC2 instances.
 * Each result entry includes: metadata, EC2 status checks, CPU metrics,
 * derived health status, and a human-readable health reason.
 *
 * AWS call strategy (avoids excessive calls):
 *  - One DescribeInstances call (paginated)
 *  - One DescribeInstanceStatus call (paginated, running only)
 *  - Parallel CloudWatch GetMetricStatistics per running instance (batched 20 at a time)
 *
 * @param {object} opts
 * @param {number} [opts.lookbackHours=24]
 * @param {number} [opts.periodSeconds]    overrides per-window default
 * @param {string} [opts.instanceId]       scope to one instance
 * @param {object} [opts.thresholds]       override default CPU thresholds
 * @returns {Promise<{ instances: object[], mode: string, lastFetched: string, warning?: string }>}
 */
export async function getHealthSummary(opts = {}) {
  const isConfigured  = await checkAwsConfigured();
  const mode          = getExecutionMode(isConfigured);
  const lookbackHours = Math.max(1, parseInt(opts.lookbackHours, 10) || 24);
  const periodSeconds = opts.periodSeconds
    ? parseInt(opts.periodSeconds, 10)
    : ((OBSERVATION_PERIODS[lookbackHours] && OBSERVATION_PERIODS[lookbackHours].periodSeconds) || 3600);

  const thresholds = {
    ...DEFAULT_HEALTH_THRESHOLDS,
    ...(opts.thresholds || {})
  };

  if (mode === 'demo') {
    return {
      instances:   getDemoHealthSummary(lookbackHours, thresholds),
      mode:        'demo',
      lastFetched: new Date().toISOString()
    };
  }

  try {
    // ── Step 1: Get instance list ──────────────────────────────────────────
    const allInstances = [];
    {
      let nextToken;
      do {
        const cmd = new DescribeInstancesCommand({
          MaxResults: 100,
          ...(opts.instanceId ? { InstanceIds: [opts.instanceId] } : {}),
          ...(nextToken ? { NextToken: nextToken } : {})
        });
        const resp = await ec2Client.send(cmd);
        nextToken = resp.NextToken;

        for (const r of (resp.Reservations || [])) {
          for (const inst of (r.Instances || [])) {
            const tags = {};
            let   name = inst.InstanceId;
            for (const t of (inst.Tags || [])) {
              if (t.Key) {
                tags[t.Key] = t.Value;
                if (t.Key.toLowerCase() === 'name' && t.Value) name = t.Value;
              }
            }
            const az     = inst.Placement && inst.Placement.AvailabilityZone ? inst.Placement.AvailabilityZone : 'unknown';
            const region = az.length > 1 ? az.slice(0, -1) : 'unknown';

            allInstances.push({
              instanceId:       inst.InstanceId,
              name,
              instanceType:     inst.InstanceType,
              instanceState:    inst.State ? inst.State.Name : 'unknown',
              availabilityZone: az,
              region,
              launchTime:       inst.LaunchTime ? new Date(inst.LaunchTime).toISOString() : null,
              publicIp:         inst.PublicIpAddress  || null,
              privateIp:        inst.PrivateIpAddress || null,
              tags
            });
          }
        }
      } while (nextToken);
    }

    if (allInstances.length === 0) {
      return { instances: [], mode: 'live', lastFetched: new Date().toISOString() };
    }

    // ── Step 2: EC2 status checks (running only) ───────────────────────────
    const runningIds = allInstances
      .filter((i) => i.instanceState === 'running')
      .map((i) => i.instanceId);

    const statusMap = await fetchEc2StatusChecks(runningIds);

    // ── Step 3: CloudWatch CPU — parallel, running only, batched ──────────
    const cpuResults = new Map();
    const cpuTargets = allInstances.filter((i) => i.instanceState === 'running');

    const BATCH_SIZE = 20;
    for (let start = 0; start < cpuTargets.length; start += BATCH_SIZE) {
      const batch   = cpuTargets.slice(start, start + BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map((inst) => fetchCpuMetricsForInstance(inst.instanceId, lookbackHours, periodSeconds))
      );
      settled.forEach((r, idx) => {
        const id = batch[idx].instanceId;
        cpuResults.set(
          id,
          r.status === 'fulfilled'
            ? r.value
            : { hasData: false, average: null, maximum: null, minimum: null, datapoints: [], unit: 'Percent', error: r.reason && r.reason.message, observedAt: new Date().toISOString() }
        );
      });
    }

    // ── Step 4: Assemble ───────────────────────────────────────────────────
    const lastFetched = new Date().toISOString();

    const instances = allInstances.map((inst) => {
      const isRunning   = inst.instanceState === 'running';
      const statusCheck = isRunning ? (statusMap.get(inst.instanceId) || null) : null;
      const emptyCpu    = { hasData: false, average: null, maximum: null, minimum: null, datapoints: [], unit: 'Percent', observedAt: lastFetched };
      const cpuData     = isRunning ? (cpuResults.get(inst.instanceId) || emptyCpu) : emptyCpu;

      const health = deriveHealthStatus({
        instanceState:        inst.instanceState,
        cpuAverage:           cpuData.average,
        cpuMaximum:           cpuData.maximum,
        hasStatusCheckFailed: statusCheck ? statusCheck.hasFailed : null,
        thresholds
      });

      const healthReason = buildHealthReason({
        instanceState:        inst.instanceState,
        cpuAverage:           cpuData.average,
        cpuMaximum:           cpuData.maximum,
        hasStatusCheckFailed: statusCheck ? statusCheck.hasFailed : null,
        statusCheckDetail:    statusCheck ? statusCheck.failedCheckDetails : null,
        observationHours:     lookbackHours,
        thresholds
      });

      return { ...inst, statusCheck, cpu: cpuData, health, healthReason };
    });

    return { instances, mode: 'live', lastFetched };
  } catch (err) {
    console.warn(`[Health Service] Orchestrator failed: ${err.message}`);

    if (process.env.DEMO_MODE === 'live' || process.env.DEMO_MODE === 'false') {
      const e = new Error(`Health Service Error: ${err.message}`);
      e.code       = err.name || 'AWS_HEALTH_ERROR';
      e.statusCode = (err.$metadata && err.$metadata.httpStatusCode) || 500;
      throw e;
    }

    return {
      instances:   getDemoHealthSummary(lookbackHours, thresholds),
      mode:        'demo',
      lastFetched: new Date().toISOString(),
      warning:     `AWS health query failed (${err.name || err.message}). Showing demo data.`
    };
  }
}

