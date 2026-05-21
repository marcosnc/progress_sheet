import { serverApiBaseUrl } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

/** Devuelve JS con la URL del API leída en runtime (para depurar: curl /api/runtime-config). */
export async function GET() {
  const apiUrl = serverApiBaseUrl();
  return new Response(
    `window.__PROGRESS_SHEET_CONFIG__=${JSON.stringify({ apiUrl })};`,
    {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}
