import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { serverLogPath } from "./server-log";
import { expect } from "./test";

/**
 * Every sign-in link the dev server has printed for an email address, oldest first. A link
 * counts only once the line after it has started, so one still being written is never used.
 */
async function findSignInLinks(email: string): Promise<string[]> {
  const log = await readFile(serverLogPath, "utf8");
  const [, ...afterMarkers] = log.split(`Sign-in link for ${email}:`);
  return afterMarkers.flatMap(
    (text) => /^\s*(\S+\/api\/auth\/magic-link\/verify\S+)\s/.exec(text)?.[1] ?? [],
  );
}

export async function findSignInLink(email: string): Promise<string | undefined> {
  return (await findSignInLinks(email)).at(-1);
}

/**
 * Signs in through the development sign-in link: as a brand-new person, or as the owner of
 * `email` when one is given.
 */
export async function signIn(page: Page, email?: string): Promise<void> {
  const address =
    email ?? `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  // An address used before already has links in the log; only a new one will work.
  const earlierLinks = (await findSignInLinks(address)).length;
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(address);
  await page.getByRole("button", { name: "Send sign-in link" }).click();

  let links: string[] = [];
  await expect
    .poll(async () => {
      links = await findSignInLinks(address);
      return links.length;
    })
    .toBeGreaterThan(earlierLinks);
  await page.goto(links.at(-1) as string);
  await expect(page).toHaveURL("/");
}
