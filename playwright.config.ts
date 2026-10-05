import { defineConfig } from "@playwright/test";

// Browser tests run against the production build served by `astro preview`.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4322",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
    {
      name: "phone",
      use: { browserName: "chromium", viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    // --ignore-lock keeps preview in the foreground even when Astro detects an agent.
    command: "npx astro build && npx astro preview --port 4322 --ignore-lock",
    url: "http://localhost:4322",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
