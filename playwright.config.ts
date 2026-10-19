import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: [
    {
      command: "npm run dev:demo -- --host 0.0.0.0 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev:demo -- --host 0.0.0.0 --port 4174 --strictPort",
      url: "http://127.0.0.1:4174",
      env: { VITE_GUESTBOOK_API: "/api" },
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: "desktop",
      testMatch: "signing.spec.ts",
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      testMatch: "signing.spec.ts",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "shared-mode",
      testMatch: "public.spec.ts",
      use: {
        baseURL: "http://127.0.0.1:4174",
        viewport: { width: 1100, height: 950 },
      },
    },
  ],
});
