import {defineConfig} from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      enabled: true,
      include: ["app/api/**/*.ts", "lib/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/node_modules/**",
        "lib/db/**",
        "lib/auth.ts",
        "lib/auth-cookies.ts",
        "lib/current-user.ts",
        "app/api/auth/**/*.ts",
        "app/api/profile/**/*.ts",
      ],
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
      reportOnFailure: true,
    },
  },
});
