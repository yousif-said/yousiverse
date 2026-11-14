import { defineConfig, devices } from "@playwright/test";
import { serverLogPath } from "./e2e/server-log";

const baseURL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A fresh dev server every run: the sign-in test reads the magic link from its output.
    command: `bun run dev 2>&1 | tee "${serverLogPath}"`,
    url: baseURL,
    reuseExistingServer: false,
    // Provider calls are answered from recorded responses, so tests need no API keys.
    env: {
      PROVIDER_FIXTURES: "true",
      TMDB_API_TOKEN: "e2e-token",
      IGDB_CLIENT_ID: "e2e-id",
      IGDB_CLIENT_SECRET: "e2e-secret",
      WATCHMODE_API_KEY: "e2e-key",
      ITAD_API_KEY: "e2e-key",
      STEAM_API_KEY: "e2e-key",
    },
    timeout: 120_000,
  },
});
