import { readFile } from "node:fs/promises";
import { serverLogPath } from "./server-log";
import { expect, test } from "./test";

async function findSignInLink(email: string): Promise<string | undefined> {
  const log = await readFile(serverLogPath, "utf8");
  const [, afterMarker] = log.split(`Sign-in link for ${email}:`);
  return afterMarker?.trim().split(/\s/)[0];
}

test("signs in with an emailed link, reaches the protected account page, and signs out", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/account");
  await expect(page).toHaveURL("/sign-in?next=%2Faccount");

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByText("Sign-in link sent")).toBeVisible();

  let signInLink: string | undefined;
  await expect
    .poll(async () => {
      signInLink = await findSignInLink(email);
      return signInLink;
    })
    .toContain("/api/auth/magic-link/verify");
  await page.goto(signInLink as string);

  await expect(page).toHaveURL("/account");
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();

  await page.goto("/account");
  await expect(page).toHaveURL("/sign-in?next=%2Faccount");
});
