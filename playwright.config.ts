import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:8080",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium" }],
  webServer: {
    command: "npm run build && npx vite preview --port 8080",
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
