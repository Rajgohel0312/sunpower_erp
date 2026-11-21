/**
 * Centralized API Client for SunPower ERP
 * Supports credentials (HttpOnly cookies), JSON envelope unwrapping,
 * request correlation, and transparent 401 token refresh queue.
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

// Single-flight refresh mutex to prevent concurrent refresh token revocation race conditions
let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token, null));
  refreshSubscribers = [];
}

function onRefreshFailed(err) {
  refreshSubscribers.forEach((cb) => cb(null, err));
  refreshSubscribers = [];
}

export async function apiRequest(endpoint, options = {}, isRetry = false) {
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

    // Handle 401 Unauthorized with silent refresh
    const isAuthEndpoint = endpoint.includes('/auth/login') ||
                           endpoint.includes('/auth/refresh') ||
                           endpoint.includes('/auth/logout');

    if (res.status === 401 && !isRetry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Another refresh is already underway; queue this request
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken, refreshErr) => {
            if (refreshErr || !newToken) {
              reject(refreshErr || new ApiError('Session expired. Please log in again.', 401, 'UNAUTHENTICATED'));
            } else {
              // Retry with new in-memory token
              const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
              resolve(apiRequest(endpoint, { ...options, headers: retryHeaders }, true));
            }
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({})
        });

        const refreshData = await refreshRes.json().catch(() => null);

        if (!refreshRes.ok || !refreshData?.data?.accessToken) {
          const err = new ApiError(
            refreshData?.error?.message || 'Session expired. Please log in again.',
            401,
            refreshData?.error?.code || 'SESSION_EXPIRED'
          );
          setAccessToken(null);
          isRefreshing = false;
          onRefreshFailed(err);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sunpower:auth:expired'));
          }
          throw err;
        }

        const newAccessToken = refreshData.data.accessToken;
        setAccessToken(newAccessToken);
        isRefreshing = false;
        onRefreshed(newAccessToken);

        // Retry original request with newly issued token
        const retryHeaders = { ...headers, Authorization: `Bearer ${newAccessToken}` };
        return apiRequest(endpoint, { ...options, headers: retryHeaders }, true);
      } catch (refreshErr) {
        setAccessToken(null);
        isRefreshing = false;
        onRefreshFailed(refreshErr);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sunpower:auth:expired'));
        }
        throw refreshErr;
      }
    }

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
