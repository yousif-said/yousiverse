import { findSignInLink } from "./session";
import { expect, test } from "./test";

test("signs in with an emailed link, reaches the protected account page, and signs out", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/account");
  await expect(page).toHaveURL("/sign-in?next=%2Faccount");

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  // The form is gone, so the link cannot be asked for twice by accident.
  await expect(page.getByRole("button", { name: "Send sign-in link" })).toBeHidden();
  await expect(page.getByRole("button", { name: /Send again in \d+s/ })).toBeDisabled();

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
  await expect(page.getByRole("heading", { level: 1, name: /One universe\./ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send sign-in link" })).toBeVisible();

  await page.goto("/account");
  await expect(page).toHaveURL("/sign-in?next=%2Faccount");
});

test("goes back to the form to use a different email", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(`e2e-${Date.now()}-other@example.com`);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await page.getByRole("button", { name: "Use a different email" }).click();
  await expect(page.getByLabel("Email")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Send sign-in link" })).toBeEnabled();
});
