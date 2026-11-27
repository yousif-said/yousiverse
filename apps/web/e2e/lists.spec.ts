import type { Page } from "@playwright/test";
import { signIn } from "./session";
import { expect, test } from "./test";

async function addToList(page: Page, path: string, listName: string) {
  await page.goto(path);
  await page.getByRole("button", { name: "Add to a list" }).click();
  const stored = page.waitForResponse(/lists\.addItem/);
  await page.getByRole("checkbox", { name: new RegExp(`^${listName}`) }).click();
  await stored;
  await page.getByRole("button", { name: "Done" }).click();
}

test("makes a list, fills it from title pages, shares it, then hides and deletes it", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await page.goto("/lists");
  await expect(page.getByText("You have no lists yet.")).toBeVisible();

  await page.getByRole("button", { name: "New list" }).first().click();
  await page.getByRole("dialog", { name: "New list" }).getByLabel("Name").fill("Weekend picks");
  await page.getByRole("button", { name: "Create list" }).click();
  await expect(page).toHaveURL(/\/lists\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Weekend picks" })).toBeVisible();
  await expect(page.getByText("This list is empty.")).toBeVisible();
  const listUrl = page.url();

  await addToList(page, "/games/113112", "Weekend picks");
  await addToList(page, "/movies/603", "Weekend picks");
  await page.getByRole("button", { name: "Add to a list" }).click();
  await expect(page.getByRole("checkbox", { name: /^Weekend picks/ })).toBeChecked();
  await page.getByRole("button", { name: "Done" }).click();

  await page.goto("/lists");
  await page.getByRole("link", { name: /Weekend picks.*2 titles/ }).click();
  const titles = page.getByRole("main").getByRole("listitem");
  await expect(titles).toHaveCount(2);
  await expect(titles.first()).toContainText("Hades");
  await expect(titles.last()).toContainText("The Matrix");

  // A public list can be opened by someone who is not signed in, but not changed.
  const visitor = await browser.newPage();
  await visitor.goto(listUrl);
  await expect(visitor.getByText(/By\s*A Yousiverse member/)).toBeVisible();
  await expect(visitor.getByRole("main").getByRole("listitem")).toHaveCount(2);
  await expect(visitor.getByRole("button", { name: "Edit list" })).toHaveCount(0);
  await expect(visitor.getByRole("button", { name: /Remove/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Remove Hades from this list" }).click();
  await expect(titles).toHaveCount(1);

  await page.getByRole("button", { name: "Edit list" }).click();
  const editor = page.getByRole("dialog", { name: "Edit list" });
  await editor.getByLabel("Name").fill("Saturday picks");
  await editor.getByLabel(/Description/).fill("For a slow weekend.");
  await editor
    .getByRole("group", { name: "Who can see it" })
    .getByRole("button", { name: "Only you" })
    .click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Saturday picks" })).toBeVisible();
  await expect(page.getByText("Your list")).toBeVisible();
  await expect(page.getByRole("main").locator(".chip", { hasText: "Only you" })).toBeVisible();
  await expect(page.getByText("For a slow weekend.").first()).toBeVisible();

  const hidden = await visitor.reload();
  expect(hidden?.status()).toBe(404);
  await visitor.close();

  await page.getByRole("button", { name: "Edit list" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete list" }).click();
  await expect(page).toHaveURL("/lists");
  await expect(page.getByText("You have no lists yet.")).toBeVisible();
});

test("sends a signed-out visitor to sign in before showing their lists", async ({ page }) => {
  await page.goto("/lists");

  await expect(page).toHaveURL("/sign-in?next=%2Flists");
});
