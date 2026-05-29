declare global {
  interface Window {
    __PROGRESS_SHEET_CONFIG__?: {
      apiUrl?: string;
    };
  }
}

/** URL base del API con sufijo /api (p. ej. http://localhost:3001/api). */
const DEFAULT_API_BASE = "http://localhost:3001/api";

/**
 * Server-only, runtime. Variable API_BASE_URL en Docker/Coolify (URL completa).
 * Sin prefijo NEXT_PUBLIC_ para que Next no la reemplace en el build.
 */
export function serverApiBaseUrl(): string {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE;
}

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const runtime = window.__PROGRESS_SHEET_CONFIG__?.apiUrl;
    if (runtime) return runtime;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE;
}
