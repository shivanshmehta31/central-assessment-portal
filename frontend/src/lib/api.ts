import { useAuthStore } from './auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, user, setSession, clear } = useAuthStore.getState();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('refresh failed');
        const data = await res.json();
        if (user) setSession(user, data.accessToken, data.refreshToken);
        return data.accessToken as string;
      })
      .catch(() => {
        clear();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
  isFormData?: boolean;
  responseType?: 'blob';
}

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, isFormData, responseType, headers, ...rest } = options;
  const doFetch = async (token: string | null) => {
    const finalHeaders: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(headers as Record<string, string>),
    };
    if (auth && token) finalHeaders.Authorization = `Bearer ${token}`;

    return fetch(`${API_URL}${path}`, { ...rest, headers: finalHeaders });
  };

  let token = useAuthStore.getState().accessToken;
  let res = await doFetch(token);

  if (res.status === 401 && auth) {
    token = await refreshAccessToken();
    if (token) res = await doFetch(token);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(Array.isArray(message) ? message.join(', ') : message, res.status);
  }

  if (res.status === 204) return undefined as T;
  if (responseType === 'blob') return (await res.blob()) as unknown as T;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return res.json();
  return res.text() as unknown as T;
}

export const api = {
  get: <T = unknown>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined }),
  patch: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined }),
  delete: <T = unknown>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  // Authenticated binary download (e.g. an uploaded PDF) — returned as a Blob.
  blob: (path: string) => apiFetch<Blob>(path, { method: 'GET', responseType: 'blob' }),
  // Multipart upload with several fields/files.
  form: <T = unknown>(path: string, body: FormData, method = 'POST') =>
    apiFetch<T>(path, { method, isFormData: true, body }),
  put: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body != null ? JSON.stringify(body) : undefined }),
  upload: <T = unknown>(path: string, file: File, fieldName = 'file', query = '') =>
    apiFetch<T>(`${path}${query}`, {
      method: 'POST',
      isFormData: true,
      body: (() => {
        const form = new FormData();
        form.append(fieldName, file);
        return form;
      })(),
    }),
};

export { API_URL };

// Saves a Blob as a file download in the browser.
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
