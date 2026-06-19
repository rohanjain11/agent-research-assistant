/**
 * API base URL for backend requests.
 * - Local dev: unset → uses `/api` (Vite proxy → localhost:8847)
 * - GitHub Pages: set VITE_API_BASE to your deployed backend URL
 */
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

/**
 * Build a full API URL for a backend endpoint.
 *
 * @param {string} path - Endpoint path, e.g. `/research` or `/logs/researcher`
 * @returns {string} Full URL for fetch
 */
export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const endpoint = normalized.startsWith('/api/')
    ? normalized.slice(4)
    : normalized;

  if (API_BASE) {
    return `${API_BASE}${endpoint}`;
  }
  return `/api${endpoint}`;
}
