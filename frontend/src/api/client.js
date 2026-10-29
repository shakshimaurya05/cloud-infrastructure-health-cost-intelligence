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
