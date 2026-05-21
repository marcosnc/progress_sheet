import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { serverApiBaseUrl } from "@/lib/runtime-config";

export const metadata: Metadata = {
  title: "Progress Sheet",
  description: "Seguimiento de avance de obras",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const runtimeConfig = JSON.stringify({ apiUrl: serverApiBaseUrl() });

  return (
    <html lang="es">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__PROGRESS_SHEET_CONFIG__=${runtimeConfig};`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
