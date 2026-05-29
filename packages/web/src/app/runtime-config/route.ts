import { serverApiBaseUrl } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

/** Depuración: curl https://tu-dominio/runtime-config */
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
