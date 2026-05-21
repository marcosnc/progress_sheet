import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";
import { serverApiBaseUrl } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Progress Sheet",
  description: "Seguimiento de avance de obras",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const configScript = `window.__PROGRESS_SHEET_CONFIG__=${JSON.stringify({
    apiUrl: serverApiBaseUrl(),
  })};`;

  return (
    <html lang="es">
      <body>
        <Script
          id="progress-sheet-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: configScript }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
