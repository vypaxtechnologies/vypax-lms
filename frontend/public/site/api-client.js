export const API_BASE_URL = 'https://vypax-lms-backend.onrender.com/api';

export class ApiError extends Error {
  constructor(message, { status, contentType, isJson } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.contentType = contentType;
    this.isJson = isJson;
  }
}

export async function apiRequest(endpoint, options = {}) {
  const { json, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);
  let body = requestOptions.body;

  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }

  const path = String(endpoint).replace(/^\/+/, '');
  const response = await fetch(`${API_BASE_URL}/${path}`, {
    ...requestOptions,
    headers,
    body,
    credentials: 'include'
  });
  const contentType = response.headers.get('content-type') || '';
  const isJson = /^application\/(?:[\w.+-]+\+)?json\b/i.test(contentType);

  if (!isJson) {
    throw new ApiError(
      `API request ${requestOptions.method || 'GET'} ${path} returned HTTP ${response.status} with ${contentType || 'no Content-Type'}; expected JSON.`,
      { status: response.status, contentType, isJson: false }
    );
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new ApiError(
      `API request ${requestOptions.method || 'GET'} ${path} returned invalid JSON (HTTP ${response.status}).`,
      { status: response.status, contentType, isJson: true }
    );
  }

  if (!response.ok) {
    throw new ApiError(
      result?.error || `API request ${requestOptions.method || 'GET'} ${path} failed with HTTP ${response.status}.`,
      { status: response.status, contentType, isJson: true }
    );
  }

  return result;
}
