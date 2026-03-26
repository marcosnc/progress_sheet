import { defineConfig } from "vitest/config";
import tsconfig from "./tsconfig.json" with { type: "json" };

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    extensions: [".ts"],
  },
});
