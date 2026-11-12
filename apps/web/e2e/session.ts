import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { serverLogPath } from "./server-log";
import { expect } from "./test";

export async function findSignInLink(email: string): Promise<string | undefined> {
  const log = await readFile(serverLogPath, "utf8");
  const [, afterMarker] = log.split(`Sign-in link for ${email}:`);
  return afterMarker?.trim().split(/\s/)[0];
}

/** Signs in as a brand-new person through the development sign-in link. */
export async function signIn(page: Page): Promise<void> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send sign-in link" }).click();

  let signInLink: string | undefined;
  await expect
    .poll(async () => {
      signInLink = await findSignInLink(email);
      return signInLink;
    })
    .toContain("/api/auth/magic-link/verify");
  await page.goto(signInLink as string);
  await expect(page).toHaveURL("/");
}
