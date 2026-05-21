declare global {
  interface Window {
    __PROGRESS_SHEET_CONFIG__?: {
      apiUrl?: string;
    };
  }
}

const DEFAULT_API_BASE = "http://localhost:3001/api";

/**
 * Server-only, runtime. Usa API_BASE_URL (sin prefijo NEXT_PUBLIC_) para que Next
 * no lo reemplace en el build. NEXT_PUBLIC_* queda solo como respaldo en cliente.
 */
export function serverApiBaseUrl(): string {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE;
}

/** API base URL with /api suffix (e.g. https://api.example.com/api). */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const runtime = window.__PROGRESS_SHEET_CONFIG__?.apiUrl;
    if (runtime) return runtime;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE;
}

/** Backend origin without /api (auth routes live at /auth/*). */
export function getApiOrigin(): string {
  const base = getApiBaseUrl();
  return base.replace(/\/api\/?$/, "") || base;
}
