import path from "node:path";

/** The dev server's output is copied here so tests can read the sign-in links it prints. */
export const serverLogPath = path.join(import.meta.dirname, "..", ".e2e-server.log");
