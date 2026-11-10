export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Parse env vars at server startup so a bad config fails immediately, not on first request.
    await Promise.all([import("@yousiverse/db/env"), import("@yousiverse/auth/env")]);
  }
}
