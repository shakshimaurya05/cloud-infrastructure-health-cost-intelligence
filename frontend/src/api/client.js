import {
  mockHealth,
  mockOverview,
  mockInstances,
  mockMetrics,
  mockCosts,
  mockAlerts,
  mockRecommendations
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
