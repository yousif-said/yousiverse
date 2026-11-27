import type { Page } from "@playwright/test";
import { signIn } from "./session";
import { expect, test } from "./test";

async function chooseUsername(page: Page, username: string, name: string) {
  await page.goto("/account");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
}

test("sends a signed-out visitor to sign in before showing a feed", async ({ page }) => {
  await page.goto("/feed");
  await expect(page).toHaveURL("/sign-in?next=%2Ffeed");
});

test("shows what a followed person adds and reviews", async ({ page, browser }) => {
  const stamp = Date.now().toString(36);
  const [reader, writer] = [`reader_${stamp}`, `writer_${stamp}`];
  await signIn(page);
  await chooseUsername(page, reader, "Feed Reader");

  await page.getByRole("link", { name: "Feed", exact: true }).click();
  await expect(page).toHaveURL("/feed");
  await expect(page.getByText("You are not following anyone yet.")).toBeVisible();

  const other = await browser.newPage();
  await signIn(other);
  await chooseUsername(other, writer, "Feed Writer");
  await other.goto("/games/113112");
  const stored = other.waitForResponse(/library\.save/);
  await other.getByRole("button", { name: "Playing" }).click();
  await stored;
  await other.getByLabel("Your review").fill(`Feed review by ${writer}`);
  await other.getByRole("button", { name: "Post review" }).click();
  await expect(other.getByRole("heading", { name: "Your review", exact: true })).toBeVisible();
  await other.close();

  await page.goto(`/u/${writer}`);
  const followed = page.waitForResponse(/follows\.follow/);
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await followed;

  await page.goto("/feed");
  const items = page.locator("li.post");
  await expect(items).toHaveCount(2);
  await expect(items.filter({ hasText: "reviewed" })).toContainText(`Feed review by ${writer}`);
  const playing = items.filter({ hasText: "is playing" });
  await expect(playing.getByRole("link", { name: writer })).toHaveAttribute("href", `/u/${writer}`);
  await playing.getByRole("link", { name: "Hades" }).click();
  await expect(page).toHaveURL("/games/113112");
});
