import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@progress-sheet/shared"],
};

export default nextConfig;
