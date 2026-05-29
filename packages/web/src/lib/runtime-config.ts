declare global {
  interface Window {
    __PROGRESS_SHEET_CONFIG__?: {
      apiUrl?: string;
    };
  }
}

/** Base path del API (mismo origen: `/api`; dev directo al backend: URL absoluta). */
const DEFAULT_API_BASE = "/api";

/**
 * Server-only, runtime. Usa API_BASE_URL (sin prefijo NEXT_PUBLIC_) para que Next
 * no lo reemplace en el build.
 */
export function serverApiBaseUrl(): string {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE;
}

/** API base con sufijo `/api` (p. ej. `/api` o `https://app.example.com/api`). */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const runtime = window.__PROGRESS_SHEET_CONFIG__?.apiUrl;
    if (runtime) return runtime;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE;
}
