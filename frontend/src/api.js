const API_BASE_URL = 'https://vypax-lms-backend.onrender.com';

export async function apiFetch(path, options = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    }
  });
}

export default API_BASE_URL;