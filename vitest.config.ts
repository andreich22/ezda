import {defineConfig} from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      enabled: true,
      include: ["app/api/**/*.ts", "lib/**/*.ts"],
      exclude: ["**/*.d.ts", "**/node_modules/**"],
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
      reportOnFailure: true,
    },
  },
});
