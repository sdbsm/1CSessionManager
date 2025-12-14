type ApiFetchOptions = RequestInit & { skipAuthHeader?: boolean };

const API_KEY_STORAGE = 'x-api-key';

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(API_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE);
}

export async function apiFetch(input: RequestInfo | URL, init: ApiFetchOptions = {}) {
  const headers = new Headers(init.headers || {});

  if (!init.skipAuthHeader) {
    const key = getApiKey();
    if (key) headers.set('X-Api-Key', key);
  }

  return fetch(input, { ...init, headers });
}

export async function apiFetchJson<T>(input: RequestInfo | URL, init: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(input, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}


