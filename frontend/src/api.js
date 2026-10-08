const API_URL = 'https://vypax-lms-backend.onrender.com/';

export async function apiFetch(path, options = {}) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
  });
}