// Dev uses same-origin /api (Vite proxies it to the local backend). Production
// builds call the real API host from VITE_PUBLIC_API_URL, e.g.
// https://memoapi.apa1-eva.com/api.
const DEV_API_BASE = import.meta.env.VITE_API_BASE || '/api';
const PUBLIC_API_URL = (import.meta.env.VITE_PUBLIC_API_URL || '').replace(/\/+$/, '');
const PROD_API_BASE = PUBLIC_API_URL ? `${PUBLIC_API_URL}/api` : DEV_API_BASE;

const API_BASE = import.meta.env.DEV ? DEV_API_BASE : PROD_API_BASE;

const REAL_API_URL =
  typeof window !== 'undefined' ? new URL(API_BASE, window.location.origin).toString() : API_BASE;

type FetchOptions = RequestInit & { data?: any; skipAuthRetry?: boolean };

type SessionLostHandler = () => void;

let onSessionLost: SessionLostHandler | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export const setSessionLostHandler = (handler: SessionLostHandler | null) => {
  onSessionLost = handler;
};

export const isSessionError = (err: unknown): boolean => {
  if (err && typeof err === 'object' && 'status' in err) {
    return (err as { status?: number }).status === 401;
  }
  return false;
};

const attemptRefresh = async (): Promise<boolean> => {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
};

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { data, headers, skipAuthRetry, ...rest } = options;

  const doFetch = async (): Promise<Response> => {
    const requestHeaders: Record<string, string> = { ...((headers as Record<string, string>) || {}) };
    let body: BodyInit | undefined = rest.body ?? undefined;

    if (data !== undefined) {
      requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
      body = JSON.stringify(data);
    }

    return fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: requestHeaders,
      ...(body !== undefined ? { body } : {}),
      ...rest,
    });
  };

  let res = await doFetch();

  if (res.status === 401 && !skipAuthRetry) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      res = await doFetch();
    } else {
      onSessionLost?.();
    }
  }

  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }

  if (!res.ok) {
    const error = new Error(body.message || `Request failed: ${res.status}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }

  return body as T;
}

export const api = {
  get: <T = any>(path: string, opts?: FetchOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T = any>(path: string, opts?: FetchOptions) => request<T>(path, { ...opts, method: 'POST' }),
  put: <T = any>(path: string, opts?: FetchOptions) => request<T>(path, { ...opts, method: 'PUT' }),
  delete: <T = any>(path: string, opts?: FetchOptions) => request<T>(path, { ...opts, method: 'DELETE' }),
  isSessionError,
};