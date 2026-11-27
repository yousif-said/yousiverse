import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The app's own import alias, so tested modules can import the way the rest of the app does.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
