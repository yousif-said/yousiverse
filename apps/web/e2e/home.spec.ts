import { expect, test } from "@playwright/test";

test("home page shows the shelf and switches theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("on one shelf");
  await expect(page.getByRole("heading", { name: "Sample shelf" })).toBeAttached();

  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch between light and dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
