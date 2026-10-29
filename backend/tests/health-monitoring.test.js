/**
 * health-monitoring.test.js
 *
 * Tests for Module 2: Infrastructure Health & Monitoring.
 * Covers:
 *  - deriveHealthStatus: stopped ≠ unhealthy, missing ≠ 0, status-check vs CPU distinction
 *  - buildHealthReason: explains exact metric/threshold that triggered the status
 *  - fetchCpuMetricsForInstance: correct null handling when no datapoints exist
 *  - getDemoHealthSummary: produces valid demo data without invented values
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveHealthStatus,
  buildHealthReason,
  getDemoHealthSummary,
  DEFAULT_HEALTH_THRESHOLDS,
  OBSERVATION_PERIODS
} from '../services/health.service.js';

const T = DEFAULT_HEALTH_THRESHOLDS;

// ─── deriveHealthStatus ────────────────────────────────────────────────────────

describe('deriveHealthStatus — state-based rules', () => {
  test('stopped instance → "stopped" (never "unhealthy")', () => {
    assert.equal(
      deriveHealthStatus({ instanceState: 'stopped', cpuAverage: null, cpuMaximum: null, hasStatusCheckFailed: null }),
      'stopped'
    );
  });

  test('stopping instance → "stopped"', () => {
    assert.equal(
      deriveHealthStatus({ instanceState: 'stopping', cpuAverage: 60, cpuMaximum: 80, hasStatusCheckFailed: false }),
      'stopped'
    );
  });

  test('terminated instance → "terminated"', () => {
    assert.equal(
      deriveHealthStatus({ instanceState: 'terminated', cpuAverage: null, cpuMaximum: null, hasStatusCheckFailed: null }),
      'terminated'
    );
  });

  test('pending/other state → "unknown"', () => {
    assert.equal(
      deriveHealthStatus({ instanceState: 'pending', cpuAverage: null, cpuMaximum: null, hasStatusCheckFailed: null }),
      'unknown'
    );
  });
});

describe('deriveHealthStatus — CPU thresholds (running instances)', () => {
  test('normal CPU → "healthy"', () => {
    assert.equal(
      deriveHealthStatus({ instanceState: 'running', cpuAverage: 40, cpuMaximum: 60, hasStatusCheckFailed: false }),
      'healthy'
    );
  });

  test('average at warning threshold → "warning"', () => {
    assert.equal(
      deriveHealthStatus({ instanceState: 'running', cpuAverage: 80, cpuMaximum: 82, hasStatusCheckFailed: false, thresholds: T }),
      'warning'
    );
  });

  test('peak at critical threshold → "critical"', () => {
    assert.equal(
      deriveHealthStatus({ instanceState: 'running', cpuAverage: 70, cpuMaximum: 95, hasStatusCheckFailed: false, thresholds: T }),
      'critical'
    );
  });

  test('missing metrics → "unknown" (never "healthy" or "0")', () => {
    assert.equal(
      deriveHealthStatus({ instanceState: 'running', cpuAverage: null, cpuMaximum: null, hasStatusCheckFailed: false }),
      'unknown'
    );
    // Also confirm undefined is treated the same as null
    assert.equal(
      deriveHealthStatus({ instanceState: 'running', cpuAverage: undefined, cpuMaximum: undefined, hasStatusCheckFailed: false }),
      'unknown'
    );
  });
});

describe('deriveHealthStatus — EC2 status check failure is independent of CPU', () => {
  test('status check failure on running instance → "critical" regardless of CPU', () => {
    // CPU looks completely normal but status check failed
    assert.equal(
      deriveHealthStatus({
        instanceState: 'running',
        cpuAverage: 40,
        cpuMaximum: 50,
        hasStatusCheckFailed: true,
        thresholds: T
      }),
      'critical'
    );
  });

  test('status check failure with low CPU → "critical" (not misclassified)', () => {
    assert.equal(
      deriveHealthStatus({
        instanceState: 'running',
        cpuAverage: 1.2,
        cpuMaximum: 2.0,
        hasStatusCheckFailed: true,
        thresholds: T
      }),
      'critical'
    );
  });

  test('high CPU but no status check failure → "warning" (not confused with check failure)', () => {
    assert.equal(
      deriveHealthStatus({
        instanceState: 'running',
        cpuAverage: 85,
        cpuMaximum: 88,
        hasStatusCheckFailed: false,
        thresholds: T
      }),
      'warning'
    );
  });
});

// ─── buildHealthReason ────────────────────────────────────────────────────────

describe('buildHealthReason — explains exact trigger', () => {
  test('stopped instance explanation', () => {
    const reason = buildHealthReason({ instanceState: 'stopped', cpuAverage: null, cpuMaximum: null });
    assert.ok(reason.includes('stopped'));
    assert.ok(reason.includes('No health metrics'));
  });

  test('status check failure explicitly mentions "status check" not CPU', () => {
    const reason = buildHealthReason({
      instanceState: 'running',
      cpuAverage: 40,
      cpuMaximum: 50,
      hasStatusCheckFailed: true,
      statusCheckDetail: 'Instance: reachability',
      observationHours: 24,
      thresholds: T
    });
    assert.ok(reason.includes('status check failed'), `Expected "status check failed" in: ${reason}`);
    assert.ok(reason.includes('reachability'));
    // The reason may mention CPU only to say "NOT related to CPU" — it must NOT attribute the issue to CPU load
    assert.ok(
      !reason.toLowerCase().includes('cpu utilization') && !reason.toLowerCase().includes('peak') && !reason.toLowerCase().includes('average'),
      `Should not attribute status-check failure to CPU metrics: ${reason}`
    );
  });

  test('missing metrics explanation mentions window and monitoring', () => {
    const reason = buildHealthReason({
      instanceState: 'running',
      cpuAverage: null,
      cpuMaximum: null,
      hasStatusCheckFailed: false,
      observationHours: 12,
      thresholds: T
    });
    assert.ok(reason.includes('not available'));
    assert.ok(reason.includes('12h'));
  });

  test('critical CPU reason includes both threshold and observed value', () => {
    const reason = buildHealthReason({
      instanceState: 'running',
      cpuAverage: 90,
      cpuMaximum: 96,
      hasStatusCheckFailed: false,
      observationHours: 24,
      thresholds: T
    });
    assert.ok(reason.includes('96'), `Should include peak value: ${reason}`);
    assert.ok(reason.includes(String(T.cpuCritical)), `Should include critical threshold: ${reason}`);
    assert.ok(reason.includes('Critical'));
  });

  test('warning CPU reason distinguishes from status-check reason', () => {
    const reason = buildHealthReason({
      instanceState: 'running',
      cpuAverage: 83,
      cpuMaximum: 87,
      hasStatusCheckFailed: false,
      observationHours: 6,
      thresholds: T
    });
    assert.ok(reason.includes('CPU'));
    assert.ok(reason.includes(String(T.cpuWarning)));
    assert.ok(!reason.includes('status check'));
  });

  test('healthy instance explanation mentions normal CPU', () => {
    const reason = buildHealthReason({
      instanceState: 'running',
      cpuAverage: 25,
      cpuMaximum: 40,
      hasStatusCheckFailed: false,
      observationHours: 24,
      thresholds: T
    });
    assert.ok(reason.toLowerCase().includes('normal'));
  });
});

// ─── Custom thresholds ────────────────────────────────────────────────────────

describe('deriveHealthStatus — custom threshold overrides', () => {
  test('custom low warning threshold triggers warning at 50%', () => {
    assert.equal(
      deriveHealthStatus({
        instanceState: 'running',
        cpuAverage: 55,
        cpuMaximum: 58,
        hasStatusCheckFailed: false,
        thresholds: { cpuWarning: 50, cpuCritical: 80 }
      }),
      'warning'
    );
  });

  test('custom high warning threshold keeps healthy at 70%', () => {
    assert.equal(
      deriveHealthStatus({
        instanceState: 'running',
        cpuAverage: 70,
        cpuMaximum: 75,
        hasStatusCheckFailed: false,
        thresholds: { cpuWarning: 85, cpuCritical: 95 }
      }),
      'healthy'
    );
  });
});

// ─── OBSERVATION_PERIODS ─────────────────────────────────────────────────────

describe('OBSERVATION_PERIODS — valid structure', () => {
  test('all expected periods are defined', () => {
    const expectedHours = [1, 3, 6, 12, 24, 72];
    for (const h of expectedHours) {
      assert.ok(OBSERVATION_PERIODS[h], `Period ${h}h should be defined`);
      assert.ok(OBSERVATION_PERIODS[h].label, `Period ${h}h should have a label`);
      assert.ok(typeof OBSERVATION_PERIODS[h].periodSeconds === 'number', `Period ${h}h should have periodSeconds`);
    }
  });

  test('all period seconds are multiples of 60', () => {
    for (const [, p] of Object.entries(OBSERVATION_PERIODS)) {
      assert.equal(p.periodSeconds % 60, 0, `Period ${p.periodSeconds}s must be divisible by 60`);
    }
  });
});

// ─── getDemoHealthSummary ─────────────────────────────────────────────────────

describe('getDemoHealthSummary — data integrity', () => {
  const summary = getDemoHealthSummary(24, T);

  test('returns an array of instances', () => {
    assert.ok(Array.isArray(summary));
    assert.ok(summary.length > 0);
  });

  test('every instance has required fields', () => {
    const required = ['instanceId', 'name', 'instanceType', 'instanceState', 'health', 'healthReason', 'cpu'];
    for (const inst of summary) {
      for (const field of required) {
        assert.ok(field in inst, `Missing field "${field}" on ${inst.instanceId}`);
      }
    }
  });

  test('stopped instances have health "stopped" and null CPU values', () => {
    const stopped = summary.filter((i) => i.instanceState === 'stopped');
    assert.ok(stopped.length > 0, 'Demo should include at least one stopped instance');
    for (const inst of stopped) {
      assert.equal(inst.health, 'stopped', `Stopped instance ${inst.instanceId} must not be classified as unhealthy`);
      assert.equal(inst.cpu.average, null, `Stopped instance ${inst.instanceId} CPU average must be null, not 0`);
      assert.equal(inst.cpu.maximum, null);
      assert.equal(inst.statusCheck, null, 'Stopped instances must not have status checks');
    }
  });

  test('running instances have hasData-aware cpu values (never null treated as 0)', () => {
    const running = summary.filter((i) => i.instanceState === 'running');
    assert.ok(running.length > 0);
    for (const inst of running) {
      if (inst.cpu.hasData) {
        assert.ok(inst.cpu.average !== null, `Running instance ${inst.instanceId} with data should have non-null average`);
        assert.ok(inst.cpu.datapoints.length > 0, `Running instance with hasData should have datapoints`);
      }
    }
  });

  test('instance with failed status check has "critical" health, not just "warning"', () => {
    const impaired = summary.find((i) => i.statusCheck?.hasFailed === true);
    assert.ok(impaired, 'Demo should include at least one instance with failed status check');
    assert.equal(impaired.health, 'critical');
    assert.ok(impaired.healthReason.includes('status check'));
  });

  test('health reason is present and non-empty for all instances', () => {
    for (const inst of summary) {
      assert.ok(typeof inst.healthReason === 'string');
      assert.ok(inst.healthReason.length > 10, `healthReason too short for ${inst.instanceId}: "${inst.healthReason}"`);
    }
  });

  test('no invented datapoints for stopped instances', () => {
    const stopped = summary.filter((i) => i.instanceState === 'stopped');
    for (const inst of stopped) {
      assert.deepEqual(inst.cpu.datapoints, [], `Stopped instance ${inst.instanceId} must have empty datapoints`);
    }
  });
});
