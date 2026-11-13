import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Provider calls are answered from recorded responses in src/fixtures, never the network.
    env: {
      PROVIDER_FIXTURES: "true",
      TMDB_API_TOKEN: "test-token",
      IGDB_CLIENT_ID: "test-id",
      IGDB_CLIENT_SECRET: "test-secret",
      WATCHMODE_API_KEY: "test-key",
      ITAD_API_KEY: "test-key",
    },
  },
});
