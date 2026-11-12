import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Provider calls are answered from recorded responses in src/fixtures, never the network.
    env: { PROVIDER_FIXTURES: "true", TMDB_API_TOKEN: "test-token" },
  },
});
