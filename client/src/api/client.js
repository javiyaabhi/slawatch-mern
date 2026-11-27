const RAW_BASE = import.meta.env.VITE_API_URL || '/api';
const BASE = RAW_BASE.trim().replace(/\/+$/, '');
let csrfToken = '';
export function setCsrf(token) { csrfToken = token || ''; }

export async function api(path, options = {}) {
  const method = options.method || 'GET';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  let response;
  try {
    response = await fetch(`${BASE}${cleanPath}`, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}) },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      signal: options.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Unable to reach the server. Check that the Express API is running.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || 'Something went wrong');
    error.status = response.status;
    error.details = result.errors;
    throw error;
  }
  return result;
}
