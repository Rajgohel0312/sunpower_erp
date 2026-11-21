/**
 * Centralized API Client for SunPower ERP
 * Supports credentials (HttpOnly cookies), JSON envelope unwrapping, and request correlation.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR', details = null, requestId = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

let inMemoryAccessToken = null;

export function setAccessToken(token) {
  inMemoryAccessToken = token;
}

export function getAccessToken() {
  return inMemoryAccessToken;
}

export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // If in-memory token exists, pass as Bearer header (cookies are also sent via credentials)
  if (inMemoryAccessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }

  const config = {
    ...options,
    headers,
    credentials: 'include' // Always include HttpOnly cookies
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, config);
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
      const errPayload = data?.error || {};
      throw new ApiError(
        errPayload.message || `Request failed with status ${res.status}`,
        res.status,
        errPayload.code || 'REQUEST_FAILED',
        errPayload.details || null,
        errPayload.requestId || data?.meta?.requestId || null
      );
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Network connection failed', 0, 'NETWORK_ERROR');
  }
}

export const api = {
  get: (endpoint, query = {}, options = {}) => {
    // Robustly handle both flat query objects and nested { params: { ... } } wrappers
    const params = (query && typeof query === 'object' && query.params && typeof query.params === 'object')
      ? query.params
      : query;

    const qs = new URLSearchParams();
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          qs.append(k, String(v));
        }
      });
    }
    const queryString = qs.toString();
    const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
    return apiRequest(fullEndpoint, { ...options, method: 'GET' });
  },
  post: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'POST', body }),
  patch: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'PATCH', body }),
  put: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'PUT', body }),
  delete: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'DELETE' })
};
