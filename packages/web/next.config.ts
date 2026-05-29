import type { NextConfig } from "next";

const backendInternal =
  process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@progress-sheet/shared"],
  /**
   * Desarrollo local (web :3000, API :3001): el navegador llama a /api/* en el
   * mismo origen y Next reenvía al backend. En producción con Coolify, el proxy
   * enruta /api al contenedor backend y estas reglas no intervienen.
   */
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendInternal}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
