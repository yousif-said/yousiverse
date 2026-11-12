import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

/**
 * Tests stay on this machine: requests to any other host (provider image CDNs, mostly) are
 * blocked, so a slow or unreachable third party cannot slow down or fail a run.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(
      (url) => url.hostname !== "localhost",
      (route) => route.abort(),
    );
    await use(page);
  },
});
