import { testDatabaseUrl } from "@yousiverse/db/testing";
import { defineConfig } from "vitest/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repo root.");
}
// Tests run against a throwaway database next to the dev one, never the dev data itself.
process.env.DATABASE_URL = testDatabaseUrl(process.env.DATABASE_URL);

export default defineConfig({
  test: {
    // Provider calls are answered from recorded responses, never the network.
    env: {
      PROVIDER_FIXTURES: "true",
      TMDB_API_TOKEN: "test-token",
      IGDB_CLIENT_ID: "test-id",
      IGDB_CLIENT_SECRET: "test-secret",
      WATCHMODE_API_KEY: "test-key",
      ITAD_API_KEY: "test-key",
      STEAM_API_KEY: "test-key",
    },
    globalSetup: "./test/global-setup.ts",
    fileParallelism: false,
  },
});
