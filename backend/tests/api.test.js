import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer } from '../server.js';

const TEST_PORT = 5055;
const BASE_URL = `http://localhost:${TEST_PORT}`;

describe('Cloud Infrastructure Health & Cost Intelligence API Tests', () => {
  before(async () => {
    process.env.DEMO_MODE = 'demo'; // Test predictable contract responses
    await startServer(TEST_PORT);
  });

  after(async () => {
    await stopServer();
  });

  test('GET / returns API welcome information', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.service, 'Cloud Infrastructure Health and Cost Intelligence API');
    assert.ok(Array.isArray(data.endpoints));
  });

  test('GET /api/health satisfies API contract', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(typeof data.status, 'string');
    assert.equal(data.status, 'ok');
    assert.equal(typeof data.awsConfigured, 'boolean');
    assert.ok(['live', 'demo'].includes(data.mode));
  });

  test('GET /api/overview satisfies API contract', async () => {
    const res = await fetch(`${BASE_URL}/api/overview`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(typeof data.totalInstances, 'number');
    assert.equal(typeof data.runningInstances, 'number');
    assert.equal(typeof data.stoppedInstances, 'number');
    assert.equal(typeof data.monthlyCost, 'number');
    assert.equal(typeof data.activeAlerts, 'number');
    assert.ok(['live', 'demo'].includes(data.mode));

    // Consistency check
    assert.ok(data.totalInstances >= data.runningInstances + data.stoppedInstances);
  });

  test('GET /api/instances satisfies API contract', async () => {
    const res = await fetch(`${BASE_URL}/api/instances`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(Array.isArray(data.instances));
    assert.ok(['live', 'demo'].includes(data.mode));

    if (data.instances.length > 0) {
      const first = data.instances[0];
      assert.ok('instanceId' in first);
      assert.ok('name' in first);
      assert.ok('state' in first);
      assert.ok('instanceType' in first);
      assert.ok('availabilityZone' in first);
    }
  });

  test('GET /api/instances?state=running filters by instance state', async () => {
    const res = await fetch(`${BASE_URL}/api/instances?state=running`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(Array.isArray(data.instances));
    for (const inst of data.instances) {
      assert.equal(inst.state.toLowerCase(), 'running');
    }
  });

  test('GET /api/metrics satisfies API contract', async () => {
    const res = await fetch(`${BASE_URL}/api/metrics?lookbackHours=12`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(Array.isArray(data.metrics));
    assert.ok(['live', 'demo'].includes(data.mode));

    if (data.metrics.length > 0) {
      const metric = data.metrics[0];
      assert.ok('instanceId' in metric);
      assert.ok('metricName' in metric);
      assert.equal(metric.metricName, 'CPUUtilization');
      assert.ok(Array.isArray(metric.datapoints));
    }
  });

  test('GET /api/costs satisfies API contract', async () => {
    const res = await fetch(`${BASE_URL}/api/costs`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(typeof data.currency, 'string');
    assert.equal(data.currency, 'USD');
    assert.equal(typeof data.totalCost, 'number');
    assert.ok(Array.isArray(data.dailyCosts));
    assert.ok(Array.isArray(data.serviceBreakdown));
    assert.ok(['live', 'demo'].includes(data.mode));

    if (data.dailyCosts.length > 0) {
      assert.ok('date' in data.dailyCosts[0]);
      assert.ok('amount' in data.dailyCosts[0]);
    }

    if (data.serviceBreakdown.length > 0) {
      assert.ok('service' in data.serviceBreakdown[0]);
      assert.ok('amount' in data.serviceBreakdown[0]);
      assert.ok('percentage' in data.serviceBreakdown[0]);
    }
  });

  test('GET /api/costs validates date format', async () => {
    const res = await fetch(`${BASE_URL}/api/costs?startDate=invalid-date`);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid startDate format'));
  });

  test('GET /api/alerts satisfies API contract', async () => {
    const res = await fetch(`${BASE_URL}/api/alerts`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(Array.isArray(data.alerts));
    assert.ok(['live', 'demo'].includes(data.mode));

    if (data.alerts.length > 0) {
      const alert = data.alerts[0];
      assert.ok('id' in alert);
      assert.ok('type' in alert);
      assert.ok('message' in alert);
    }
  });

  test('GET /api/recommendations satisfies API contract', async () => {
    const res = await fetch(`${BASE_URL}/api/recommendations`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(Array.isArray(data.recommendations));
    assert.ok(['live', 'demo'].includes(data.mode));

    if (data.recommendations.length > 0) {
      const rec = data.recommendations[0];
      assert.ok('id' in rec);
      assert.ok('category' in rec);
      assert.ok('title' in rec);
      assert.ok('description' in rec);
    }
  });

  test('Unknown route returns 404', async () => {
    const res = await fetch(`${BASE_URL}/api/nonexistent`);
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.status, 404);
  });

  test('Auto Mode without AWS credentials returns mode: demo and awsConfigured: false', async () => {
    process.env.DEMO_MODE = 'auto';
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.awsConfigured, false);
    assert.equal(data.mode, 'demo');
  });

  test('Auto Mode gracefully serves instances labeled mode: demo when AWS is unconfigured', async () => {
    process.env.DEMO_MODE = 'auto';
    const res = await fetch(`${BASE_URL}/api/instances`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.mode, 'demo');
    assert.ok(Array.isArray(data.instances));
    assert.ok(data.instances.length > 0);
  });
});
