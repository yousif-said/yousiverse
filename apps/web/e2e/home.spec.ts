import { signIn } from "./session";
import { expect, test } from "./test";

test("shows the front door to a visitor, with the sign-in form and no shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Everything you watch, play, and read. One universe.",
  );
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send sign-in link" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
});

test("greets a new account and offers three ways to start, then switches theme", async ({
  page,
}) => {
  await signIn(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^Good (morning|afternoon|evening)[,.]/,
  );
  await expect(page.getByRole("heading", { name: "Three ways to start" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Search the catalog" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Import your history" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Find people to follow" })).toBeVisible();

  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Your profile, account, and more" }).click();
  await page.getByRole("menuitem", { name: "Switch to day" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.getByRole("button", { name: "Your profile, account, and more" }).click();
  await expect(page.getByRole("menuitem", { name: "Switch to night" })).toBeVisible();
});

test("searches from the sidebar's palette", async ({ page }) => {
  await signIn(page);

  await page.getByRole("button", { name: "Search" }).click();
  const palette = page.getByRole("dialog", { name: "Search" });
  await palette.getByRole("combobox", { name: "Search" }).fill("severance");
  await palette.getByRole("option", { name: "Search everything for “severance”" }).click();

  await expect(page).toHaveURL("/search?q=severance");
  await expect(
    page
      .getByRole("link", { name: "Severance", exact: true })
      .and(page.locator('[href^="/tv/"]'))
      .first(),
  ).toBeVisible();
});
