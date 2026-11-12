import { expect, test } from "./test";

test("home page shows the shelf and switches theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("on one shelf");
  await expect(page.getByRole("heading", { name: "Recently added" })).toBeVisible();

  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch between light and dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("every title on the shelf links to its page", async ({ page }) => {
  await page.goto("/");

  const shelf = page.getByRole("region", { name: "Recently added" });
  const titles = shelf.getByRole("listitem").getByRole("link");
  await expect(titles.first()).toBeVisible();
  for (const href of await titles.evaluateAll((links) =>
    links.map((a) => a.getAttribute("href")),
  )) {
    expect(href).toMatch(/^\/(movies|tv|games|books)\/\w+$/);
  }
});

test("searches from the home page", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("searchbox", { name: "Search the catalog" }).fill("severance");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL("/search?q=severance");
  await expect(page.getByRole("link", { name: "Severance TV show, 2022" })).toBeVisible();
});
