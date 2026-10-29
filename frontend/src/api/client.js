import {
  mockHealth,
  mockOverview,
  mockInstances,
  mockMetrics,
  mockCosts,
  mockAlerts,
  mockRecommendations,
  mockInventoryInstances,
  mockInventoryVolumes,
  mockInventoryElasticIps
} from './mockData.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Generic fetcher with timeout and offline fallback support.
 * @param {string} endpoint
 * @param {object} [fallbackData]
 * @param {object} [options]
 * @returns {Promise<{ data: any, isFallback: boolean, error?: string }>}
 */
async function fetchWithFallback(endpoint, fallbackData, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      data,
      isFallback: false,
      mode: data.mode || 'live'
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(`[API Client] Failed to fetch ${endpoint} from ${url} (${error.message}). Using fallback demo data.`);

    return {
      data: fallbackData,
      isFallback: true,
      mode: 'demo',
      error: error.message
    };
  }
}

export async function fetchHealth() {
  return fetchWithFallback('/health', mockHealth);
}

export async function fetchOverview() {
  return fetchWithFallback('/overview', mockOverview);
}

export async function fetchInstances(params = {}) {
  const query = new URLSearchParams();
  if (params.state) query.set('state', params.state);
  if (params.search) query.set('search', params.search);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const result = await fetchWithFallback(`/instances${qs}`, { instances: mockInstances, mode: 'demo' });

  // If fallback is used, perform client-side filtering to keep UI responsive
  if (result.isFallback && params.state) {
    result.data = {
      ...result.data,
      instances: (result.data.instances || []).filter(
        (i) => i.state.toLowerCase() === params.state.toLowerCase()
      )
    };
  }

  return result;
}

export async function fetchMetrics(params = {}) {
  const query = new URLSearchParams();
  if (params.lookbackHours) query.set('lookbackHours', params.lookbackHours);
  if (params.instanceId) query.set('instanceId', params.instanceId);

  const qs = query.toString() ? `?${query.toString()}` : '';
  return fetchWithFallback(`/metrics${qs}`, { metrics: mockMetrics, mode: 'demo' });
}

export async function fetchCosts(params = {}) {
  const query = new URLSearchParams();
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);

  const qs = query.toString() ? `?${query.toString()}` : '';
  return fetchWithFallback(`/costs${qs}`, mockCosts);
}

export async function fetchAlerts(params = {}) {
  const query = new URLSearchParams();
  if (params.severity) query.set('severity', params.severity);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const result = await fetchWithFallback(`/alerts${qs}`, { alerts: mockAlerts, mode: 'demo' });

  if (result.isFallback && params.severity) {
    result.data = {
      ...result.data,
      alerts: (result.data.alerts || []).filter(
        (a) => a.severity.toLowerCase() === params.severity.toLowerCase()
      )
    };
  }

  return result;
}

export async function fetchRecommendations(params = {}) {
  const query = new URLSearchParams();
  if (params.priority) query.set('priority', params.priority);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const result = await fetchWithFallback(`/recommendations${qs}`, { recommendations: mockRecommendations, mode: 'demo' });

  if (result.isFallback && params.priority) {
    result.data = {
      ...result.data,
      recommendations: (result.data.recommendations || []).filter(
        (r) => r.priority.toLowerCase() === params.priority.toLowerCase()
      )
    };
  }

  return result;
}

export { API_BASE_URL };

// ─── Module 2: Infrastructure Health & Monitoring ───────────────────────────

/**
 * Fetches the full health monitoring summary from /api/monitoring.
 *
 * @param {object} params
 * @param {number} [params.lookbackHours=24]  Observation window (1|3|6|12|24|72)
 * @param {string} [params.instanceId]        Scope to a single instance
 * @param {number} [params.cpuWarning=80]     Warning CPU threshold %
 * @param {number} [params.cpuCritical=95]    Critical CPU threshold %
 */
export async function fetchMonitoring(params = {}) {
  const query = new URLSearchParams();
  if (params.lookbackHours) query.set('lookbackHours', String(params.lookbackHours));
  if (params.instanceId)    query.set('instanceId',    params.instanceId);
  if (params.cpuWarning)    query.set('cpuWarning',    String(params.cpuWarning));
  if (params.cpuCritical)   query.set('cpuCritical',   String(params.cpuCritical));

  const qs = query.toString() ? `?${query.toString()}` : '';

  // Build inline demo fallback so the UI always renders something useful
  const demoFallback = buildMonitoringDemoFallback();

  return fetchWithFallback(`/monitoring${qs}`, demoFallback);
}

function buildMonitoringDemoFallback() {
  const now = new Date();
  const makePoints = (base, variance, hours) => {
    const count = Math.min(24, hours);
    return Array.from({ length: count }, (_, i) => {
      const ts  = new Date(now.getTime() - (count - i) * 3600 * 1000);
      const avg = Math.min(100, Math.max(0.1, parseFloat((base + (Math.random() - 0.5) * variance).toFixed(2))));
      return { timestamp: ts.toISOString(), average: avg, maximum: parseFloat((avg + Math.random() * 8).toFixed(2)), minimum: parseFloat((avg - Math.random() * 5).toFixed(2)) };
    });
  };

  return {
    instances: [
      { instanceId: 'i-09a8b7c6d5e4f3a21', name: 'production-api-01',    instanceType: 't3.xlarge', instanceState: 'running', availabilityZone: 'us-east-1a', region: 'us-east-1', launchTime: '2026-08-15T08:30:00.000Z', publicIp: '54.22.11.100', privateIp: '10.0.1.10', tags: { Environment: 'production' }, statusCheck: { instanceStatus: 'ok', systemStatus: 'ok', hasFailed: false, failedCheckDetails: null }, cpu: { hasData: true, average: 68.4, maximum: 92.1, minimum: 42.0, unit: 'Percent', datapoints: makePoints(68, 20, 24), observedAt: now.toISOString() }, health: 'warning',  healthReason: 'Elevated CPU utilization: average 68.4%, peak 92.1% during the 24h window (warning threshold: 80%).' },
      { instanceId: 'i-07b6c5d4e3f2a1b90', name: 'production-worker-01', instanceType: 'm5.large',  instanceState: 'running', availabilityZone: 'us-east-1b', region: 'us-east-1', launchTime: '2026-08-20T11:15:00.000Z', publicIp: null,           privateIp: '10.0.2.20', tags: { Environment: 'production' }, statusCheck: { instanceStatus: 'ok', systemStatus: 'ok', hasFailed: false, failedCheckDetails: null }, cpu: { hasData: true, average: 34.8, maximum: 53.6, minimum: 18.1, unit: 'Percent', datapoints: makePoints(34, 14, 24), observedAt: now.toISOString() }, health: 'healthy',  healthReason: 'CPU utilization normal: average 34.8%, peak 53.6% during the 24h window.' },
      { instanceId: 'i-03e2f1a0b9c8d7e65', name: 'staging-api-01',       instanceType: 't3.medium', instanceState: 'running', availabilityZone: 'us-east-1a', region: 'us-east-1', launchTime: '2026-09-01T14:00:00.000Z', publicIp: '18.90.1.55',  privateIp: '10.0.3.30', tags: { Environment: 'staging' },    statusCheck: { instanceStatus: 'ok', systemStatus: 'ok', hasFailed: false, failedCheckDetails: null }, cpu: { hasData: true, average: 3.5,  maximum: 13.2, minimum: 0.1,  unit: 'Percent', datapoints: makePoints(3.5, 2, 24), observedAt: now.toISOString() },  health: 'healthy',  healthReason: 'CPU utilization normal: average 3.5%, peak 13.2% during the 24h window.' },
      { instanceId: 'i-0d1e2f3a4b5c6d7e8', name: 'prod-payments-02',     instanceType: 'c5.xlarge', instanceState: 'running', availabilityZone: 'us-east-1c', region: 'us-east-1', launchTime: '2026-09-10T09:00:00.000Z', publicIp: null,           privateIp: '10.0.4.40', tags: { Environment: 'production' }, statusCheck: { instanceStatus: 'impaired', systemStatus: 'ok', hasFailed: true, failedCheckDetails: 'Instance: reachability' }, cpu: { hasData: true, average: 41.2, maximum: 55.0, minimum: 30.0, unit: 'Percent', datapoints: makePoints(41, 12, 24), observedAt: now.toISOString() }, health: 'critical', healthReason: 'EC2 status check failed: Instance: reachability. This indicates a hardware or software issue at the hypervisor or OS level, not related to CPU load.' },
      { instanceId: 'i-05c4d3e2f1a0b9c87', name: 'analytics-db-replica', instanceType: 'r5.xlarge', instanceState: 'stopped', availabilityZone: 'us-east-1c', region: 'us-east-1', launchTime: '2026-07-10T09:00:00.000Z', publicIp: null,           privateIp: '10.0.5.50', tags: { Environment: 'production' }, statusCheck: null, cpu: { hasData: false, average: null, maximum: null, minimum: null, unit: 'Percent', datapoints: [], observedAt: now.toISOString() }, health: 'stopped',  healthReason: 'Instance is stopped. No health metrics are collected.' },
      { instanceId: 'i-01f2e3d4c5b6a7980', name: 'dev-bastion-host',     instanceType: 't3.nano',   instanceState: 'stopped', availabilityZone: 'us-east-1a', region: 'us-east-1', launchTime: '2026-09-15T16:45:00.000Z', publicIp: null,           privateIp: '10.0.6.60', tags: { Environment: 'dev' },        statusCheck: null, cpu: { hasData: false, average: null, maximum: null, minimum: null, unit: 'Percent', datapoints: [], observedAt: now.toISOString() }, health: 'stopped',  healthReason: 'Instance is stopped. No health metrics are collected.' }
    ],
    mode: 'demo',
    lastFetched: now.toISOString(),
    thresholds: { cpuWarning: 80, cpuCritical: 95 },
    observationPeriods: { 1: { label: 'Last 1 hour' }, 3: { label: 'Last 3 hours' }, 6: { label: 'Last 6 hours' }, 12: { label: 'Last 12 hours' }, 24: { label: 'Last 24 hours' }, 72: { label: 'Last 3 days' } }
  };
}

// ─── Module 1: Infrastructure Inventory ────────────────────────────────────

/**
 * Fetches paginated EC2 instance inventory.
 * @param {object} params - { search, state, region, page, pageSize }
 */
export async function fetchInventoryInstances(params = {}) {
  const query = new URLSearchParams();
  if (params.search)   query.set('search',   params.search);
  if (params.state)    query.set('state',    params.state);
  if (params.region)   query.set('region',   params.region);
  if (params.page)     query.set('page',     String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const qs = query.toString() ? `?${query.toString()}` : '';
  const fallback = {
    instances: mockInventoryInstances,
    total: mockInventoryInstances.length,
    page: 1, pageSize: 25, totalPages: 1,
    lastRefreshed: new Date().toISOString(),
    mode: 'demo'
  };

  const result = await fetchWithFallback(`/inventory/instances${qs}`, fallback);

  // Client-side filtering when using fallback
  if (result.isFallback) {
    let items = mockInventoryInstances;
    if (params.state) items = items.filter((i) => i.state.toLowerCase() === params.state.toLowerCase());
    if (params.region) items = items.filter((i) => i.region?.toLowerCase() === params.region.toLowerCase());
    if (params.search) {
      const t = params.search.toLowerCase();
      items = items.filter((i) =>
        ['instanceId','name','instanceType','availabilityZone','region','privateIp','publicIp']
          .some((k) => String(i[k] ?? '').toLowerCase().includes(t))
      );
    }
    const page = params.page || 1;
    const size = params.pageSize || 25;
    const start = (page - 1) * size;
    result.data = {
      instances: items.slice(start, start + size),
      total: items.length,
      page, pageSize: size,
      totalPages: Math.max(1, Math.ceil(items.length / size)),
      lastRefreshed: new Date().toISOString(),
      mode: 'demo'
    };
  }

  return result;
}

/**
 * Fetches paginated EBS volume inventory.
 * @param {object} params - { search, state, volumeType, encrypted, page, pageSize }
 */
export async function fetchInventoryVolumes(params = {}) {
  const query = new URLSearchParams();
  if (params.search)     query.set('search',     params.search);
  if (params.state)      query.set('state',      params.state);
  if (params.volumeType) query.set('volumeType', params.volumeType);
  if (params.encrypted !== undefined) query.set('encrypted', String(params.encrypted));
  if (params.page)       query.set('page',       String(params.page));
  if (params.pageSize)   query.set('pageSize',   String(params.pageSize));

  const qs = query.toString() ? `?${query.toString()}` : '';
  const fallback = {
    volumes: mockInventoryVolumes,
    total: mockInventoryVolumes.length,
    page: 1, pageSize: 25, totalPages: 1,
    lastRefreshed: new Date().toISOString(),
    mode: 'demo'
  };

  const result = await fetchWithFallback(`/inventory/volumes${qs}`, fallback);

  if (result.isFallback) {
    let items = mockInventoryVolumes;
    if (params.state)      items = items.filter((v) => v.state === params.state);
    if (params.volumeType) items = items.filter((v) => v.volumeType === params.volumeType);
    if (params.encrypted !== undefined) items = items.filter((v) => v.encrypted === (params.encrypted === 'true' || params.encrypted === true));
    if (params.search) {
      const t = params.search.toLowerCase();
      items = items.filter((v) =>
        ['volumeId','name','attachedInstanceId','attachmentDevice','availabilityZone']
          .some((k) => String(v[k] ?? '').toLowerCase().includes(t))
      );
    }
    const page = params.page || 1;
    const size = params.pageSize || 25;
    const start = (page - 1) * size;
    result.data = {
      volumes: items.slice(start, start + size),
      total: items.length,
      page, pageSize: size,
      totalPages: Math.max(1, Math.ceil(items.length / size)),
      lastRefreshed: new Date().toISOString(),
      mode: 'demo'
    };
  }

  return result;
}

/**
 * Fetches paginated Elastic IP inventory.
 * @param {object} params - { search, associated, page, pageSize }
 */
export async function fetchInventoryElasticIps(params = {}) {
  const query = new URLSearchParams();
  if (params.search !== undefined && params.search !== '') query.set('search', params.search);
  if (params.associated !== undefined) query.set('associated', String(params.associated));
  if (params.page)     query.set('page',     String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const qs = query.toString() ? `?${query.toString()}` : '';
  const fallback = {
    elasticIps: mockInventoryElasticIps,
    total: mockInventoryElasticIps.length,
    page: 1, pageSize: 25, totalPages: 1,
    lastRefreshed: new Date().toISOString(),
    mode: 'demo'
  };

  const result = await fetchWithFallback(`/inventory/elastic-ips${qs}`, fallback);

  if (result.isFallback) {
    let items = mockInventoryElasticIps;
    if (params.associated !== undefined) {
      const assoc = params.associated === 'true' || params.associated === true;
      items = items.filter((e) => e.associated === assoc);
    }
    if (params.search) {
      const t = params.search.toLowerCase();
      items = items.filter((e) =>
        ['allocationId','publicIp','name','associatedInstanceId','privateIpAddress']
          .some((k) => String(e[k] ?? '').toLowerCase().includes(t))
      );
    }
    const page = params.page || 1;
    const size = params.pageSize || 25;
    const start = (page - 1) * size;
    result.data = {
      elasticIps: items.slice(start, start + size),
      total: items.length,
      page, pageSize: size,
      totalPages: Math.max(1, Math.ceil(items.length / size)),
      lastRefreshed: new Date().toISOString(),
      mode: 'demo'
    };
  }

  return result;
}
