import {defineConfig} from "@playwright/test";

const previewBaseURL = process.env.PREVIEW_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*preview*.spec.mjs",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "line",
  outputDir: "test-results/preview",
  use: {
    baseURL: previewBaseURL || "http://localhost:3000",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  ...(previewBaseURL
    ? {}
    : {
        webServer: [
          {
            command: "node scripts/e2e-auth-provider.mjs",
            url: "http://127.0.0.1:4010/health",
            reuseExistingServer: !process.env.CI,
            timeout: 30_000,
          },
          {
            command:
              "SUPABASE_URL=http://127.0.0.1:4010 SUPABASE_ANON_KEY=e2e-key npm run dev -- --port 3000",
            url: "http://localhost:3000/auth",
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
        ],
      }),
});
