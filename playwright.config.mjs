import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.mjs",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "line",
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "node scripts/e2e-auth-provider.mjs",
      url: "http://127.0.0.1:4010/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "SUPABASE_URL=http://127.0.0.1:4010 SUPABASE_ANON_KEY=e2e-key npm run dev -- --port 3000",
      url: "http://127.0.0.1:3000/auth",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
