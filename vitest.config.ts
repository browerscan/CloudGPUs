import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html"],
      all: true,
      include: ["src/**/*.ts"],
      exclude: [
        "src/admin/**",
        "src/db/seed.ts",
        "src/migrations/run.ts",
        "src/workers/browser.ts",
        "src/workers/index.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 60,
        statements: 80,
      },
    },
  },
});
