import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * Tes di browser sungguhan terhadap hasil `npm run build`.
 * Empat ukuran layar: ponsel 360, 390, 412 px dan desktop 1440 px.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: "chromium",
    locale: "id-ID",
    testIdAttribute: "data-uji",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    { name: "ponsel-360", use: { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true } },
    { name: "ponsel-390", use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: "ponsel-412", use: { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true } },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
