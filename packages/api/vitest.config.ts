import { testDatabaseUrl } from "@yousiverse/db/testing";
import { defineConfig } from "vitest/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repo root.");
}
// Tests run against a throwaway database next to the dev one, never the dev data itself.
process.env.DATABASE_URL = testDatabaseUrl(process.env.DATABASE_URL);

export default defineConfig({
  test: {
    globalSetup: "./test/global-setup.ts",
    fileParallelism: false,
  },
});
