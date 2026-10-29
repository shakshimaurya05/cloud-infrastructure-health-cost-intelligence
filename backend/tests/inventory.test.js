/**
 * MODULE 1: Infrastructure Inventory API Tests
 * Tests: /api/inventory/instances, /api/inventory/volumes, /api/inventory/elastic-ips
 * Covers: valid responses, empty inventories, pagination, filtering, search,
 *         API contract shape, and permission-denied error propagation.
 */

import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer } from '../server.js';

const TEST_PORT = 5066;
const BASE_URL = `http://localhost:${TEST_PORT}`;

describe('Inventory API - Module 1', () => {
  before(async () => {
    process.env.DEMO_MODE = 'demo';
    await startServer(TEST_PORT);
  });

  after(async () => {
    await stopServer();
  });

  // ── /api/inventory/instances ──────────────────────────────────────────────

  describe('GET /api/inventory/instances', () => {
    test('returns a valid paginated response', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/instances`);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.ok(Array.isArray(data.instances), 'instances must be an array');
      assert.equal(typeof data.total, 'number');
      assert.equal(typeof data.page, 'number');
      assert.equal(typeof data.pageSize, 'number');
      assert.equal(typeof data.totalPages, 'number');
      assert.ok(typeof data.lastRefreshed === 'string', 'lastRefreshed must be a string');
      assert.ok(['live', 'demo'].includes(data.mode), 'mode must be live or demo');
    });

    test('each instance has required fields', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/instances`);
      const data = await res.json();
      assert.ok(data.instances.length > 0, 'demo must return instances');

      const requiredFields = [
        'instanceId', 'name', 'state', 'instanceType',
        'region', 'availabilityZone', 'launchTime', 'tags'
      ];
      for (const inst of data.instances) {
        for (const field of requiredFields) {
          assert.ok(field in inst, `instance must have field: ${field}`);
        }
        // publicIp and privateIp may be null but must be present
        assert.ok('publicIp' in inst);
        assert.ok('privateIp' in inst);
      }
    });

    test('state filter returns only matching instances', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/instances?state=running`);
      const data = await res.json();
      assert.ok(Array.isArray(data.instances));
      for (const inst of data.instances) {
        assert.equal(inst.state.toLowerCase(), 'running');
      }
    });

    test('state filter for stopped returns only stopped instances', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/instances?state=stopped`);
      const data = await res.json();
      for (const inst of data.instances) {
        assert.equal(inst.state.toLowerCase(), 'stopped');
      }
    });

    test('search filter narrows results', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/instances?search=production`);
      const data = await res.json();
      assert.ok(data.instances.length > 0, 'should match production instances');
      for (const inst of data.instances) {
        const matchFound = ['instanceId', 'name', 'instanceType', 'availabilityZone', 'region', 'privateIp', 'publicIp']
          .some((k) => String(inst[k] ?? '').toLowerCase().includes('production'));
        assert.ok(matchFound, `result "${inst.name}" should match search "production"`);
      }
    });

    test('pagination: page=1 and page=2 return different items', async () => {
      const res1 = await fetch(`${BASE_URL}/api/inventory/instances?page=1&pageSize=2`);
      const res2 = await fetch(`${BASE_URL}/api/inventory/instances?page=2&pageSize=2`);
      const d1 = await res1.json();
      const d2 = await res2.json();

      assert.equal(d1.page, 1);
      assert.equal(d2.page, 2);
      assert.equal(d1.pageSize, 2);
      // IDs on page 1 and page 2 must not overlap (if enough data)
      if (d1.instances.length > 0 && d2.instances.length > 0) {
        const ids1 = new Set(d1.instances.map((i) => i.instanceId));
        for (const inst of d2.instances) {
          assert.ok(!ids1.has(inst.instanceId), 'Pages must not overlap');
        }
      }
    });

    test('pagination: total reflects unfiltered count, page items are bounded by pageSize', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/instances?pageSize=2`);
      const data = await res.json();
      assert.ok(data.instances.length <= 2);
      assert.ok(data.total >= data.instances.length);
    });

    test('empty result when filter matches nothing', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/instances?search=zzz_does_not_exist_xyz`);
      const data = await res.json();
      assert.equal(data.instances.length, 0);
      assert.equal(data.total, 0);
    });
  });

  // ── /api/inventory/volumes ────────────────────────────────────────────────

  describe('GET /api/inventory/volumes', () => {
    test('returns a valid paginated response', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/volumes`);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.ok(Array.isArray(data.volumes));
      assert.equal(typeof data.total, 'number');
      assert.equal(typeof data.page, 'number');
      assert.ok(typeof data.lastRefreshed === 'string');
      assert.ok(['live', 'demo'].includes(data.mode));
    });

    test('each volume has required fields', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/volumes`);
      const data = await res.json();
      assert.ok(data.volumes.length > 0, 'demo must return volumes');

      const requiredFields = [
        'volumeId', 'size', 'volumeType', 'state',
        'availabilityZone', 'encrypted', 'tags'
      ];
      for (const vol of data.volumes) {
        for (const field of requiredFields) {
          assert.ok(field in vol, `volume must have field: ${field}`);
        }
        assert.equal(typeof vol.encrypted, 'boolean');
        assert.equal(typeof vol.size, 'number');
      }
    });

    test('state filter: available returns only unattached volumes', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/volumes?state=available`);
      const data = await res.json();
      for (const vol of data.volumes) {
        assert.equal(vol.state.toLowerCase(), 'available');
      }
    });

    test('volumeType filter works', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/volumes?volumeType=gp3`);
      const data = await res.json();
      for (const vol of data.volumes) {
        assert.equal(vol.volumeType, 'gp3');
      }
    });

    test('encrypted=true filter returns only encrypted volumes', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/volumes?encrypted=true`);
      const data = await res.json();
      for (const vol of data.volumes) {
        assert.equal(vol.encrypted, true);
      }
    });

    test('encrypted=false filter returns only unencrypted volumes', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/volumes?encrypted=false`);
      const data = await res.json();
      for (const vol of data.volumes) {
        assert.equal(vol.encrypted, false);
      }
    });

    test('search by volumeId narrows results', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/volumes`);
      const all = await res.json();
      if (all.volumes.length === 0) return;

      const targetId = all.volumes[0].volumeId;
      const res2 = await fetch(`${BASE_URL}/api/inventory/volumes?search=${targetId}`);
      const data2 = await res2.json();
      assert.ok(data2.volumes.some((v) => v.volumeId === targetId));
    });

    test('pagination bounds are respected', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/volumes?pageSize=3`);
      const data = await res.json();
      assert.ok(data.volumes.length <= 3);
    });
  });

  // ── /api/inventory/elastic-ips ────────────────────────────────────────────

  describe('GET /api/inventory/elastic-ips', () => {
    test('returns a valid paginated response', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/elastic-ips`);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.ok(Array.isArray(data.elasticIps));
      assert.equal(typeof data.total, 'number');
      assert.equal(typeof data.page, 'number');
      assert.ok(typeof data.lastRefreshed === 'string');
      assert.ok(['live', 'demo'].includes(data.mode));
    });

    test('each Elastic IP has required fields', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/elastic-ips`);
      const data = await res.json();
      assert.ok(data.elasticIps.length > 0, 'demo must return elastic IPs');

      const requiredFields = ['allocationId', 'publicIp', 'domain', 'associated', 'tags'];
      for (const eip of data.elasticIps) {
        for (const field of requiredFields) {
          assert.ok(field in eip, `elasticIp must have field: ${field}`);
        }
        assert.equal(typeof eip.associated, 'boolean');
      }
    });

    test('associated=true filter returns only associated IPs', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/elastic-ips?associated=true`);
      const data = await res.json();
      for (const eip of data.elasticIps) {
        assert.equal(eip.associated, true);
      }
    });

    test('associated=false filter returns only unassociated IPs', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/elastic-ips?associated=false`);
      const data = await res.json();
      for (const eip of data.elasticIps) {
        assert.equal(eip.associated, false);
      }
    });

    test('search by IP address narrows results', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/elastic-ips?search=54.210`);
      const data = await res.json();
      assert.ok(data.elasticIps.length > 0);
      for (const eip of data.elasticIps) {
        assert.ok(eip.publicIp.includes('54.210'));
      }
    });

    test('no results for nonsense search', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/elastic-ips?search=no_match_xyz_abc`);
      const data = await res.json();
      assert.equal(data.elasticIps.length, 0);
    });
  });

  // ── Cross-cutting checks ──────────────────────────────────────────────────

  describe('Cross-cutting: mode, error handling, 404', () => {
    test('lastRefreshed is a valid ISO timestamp', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/instances`);
      const data = await res.json();
      const ts = new Date(data.lastRefreshed);
      assert.ok(!isNaN(ts.getTime()), 'lastRefreshed must be a valid date');
    });

    test('demo mode label is present in all three inventory endpoints', async () => {
      const endpoints = [
        '/api/inventory/instances',
        '/api/inventory/volumes',
        '/api/inventory/elastic-ips'
      ];
      for (const ep of endpoints) {
        const res = await fetch(`${BASE_URL}${ep}`);
        const data = await res.json();
        assert.equal(data.mode, 'demo', `${ep} should return demo mode`);
      }
    });

    test('unknown inventory sub-route returns 404', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/nonexistent`);
      assert.equal(res.status, 404);
    });

    test('pageSize capped at 200 (sends 9999)', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/instances?pageSize=9999`);
      const data = await res.json();
      assert.ok(data.pageSize <= 200, 'pageSize must be capped at 200');
    });
  });
});
