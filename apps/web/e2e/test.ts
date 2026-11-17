import { type Browser, test as base, type Page } from "@playwright/test";

export { expect } from "@playwright/test";

/** Set E2E_CPU_SLOWDOWN=6 to run the browser six times slower, as a busy CI machine would. */
const cpuSlowdown = Number(process.env.E2E_CPU_SLOWDOWN ?? 1);

/**
 * Waits until React has taken over every control on the page. Until then a click or a typed
 * value is lost, which a test on a slow machine would otherwise run into. React marks each
 * element it has taken over with a `__reactProps$…` key.
 */
async function waitUntilInteractive(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button, input, select, textarea")].every((control) =>
      Object.keys(control).some((key) => key.startsWith("__reactProps$")),
    ),
  );
}

/**
 * Sets a page up for tests. Requests to any other host (provider image CDNs, mostly) are
 * blocked, so a slow or unreachable third party cannot slow down or fail a run. Loading a page
 * waits until its controls work.
 */
async function prepare(page: Page): Promise<Page> {
  await page.route(
    (url) => url.hostname !== "localhost",
    (route) => route.abort(),
  );
  if (cpuSlowdown > 1) {
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setCPUThrottlingRate", { rate: cpuSlowdown });
  }

  const goto = page.goto.bind(page);
  page.goto = async (...args) => {
    const response = await goto(...args);
    await waitUntilInteractive(page);
    return response;
  };
  const reload = page.reload.bind(page);
  page.reload = async (...args) => {
    const response = await reload(...args);
    await waitUntilInteractive(page);
    return response;
  };
  return page;
}

export const test = base.extend<object, { browser: Browser }>({
  page: async ({ page }, use) => {
    await use(await prepare(page));
  },
  // Pages a test opens for a second person are set up the same way.
  browser: [
    async ({ browser }, use) => {
      const newPage = browser.newPage.bind(browser);
      browser.newPage = async (...args) => prepare(await newPage(...args));
      await use(browser);
    },
    { scope: "worker" },
  ],
});
