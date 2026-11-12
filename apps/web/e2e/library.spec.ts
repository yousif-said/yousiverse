import type { Page } from "@playwright/test";
import { signIn } from "./session";
import { expect, test } from "./test";

/** Runs a click that changes the library and waits until the server has stored the change. */
async function andSave(page: Page, action: Promise<void>) {
  const stored = page.waitForResponse(/library\.(save|remove)/);
  await action;
  await stored;
}

test("asks a signed-out visitor to sign in before adding to a library", async ({ page }) => {
  await page.goto("/movies/603");

  await expect(page.getByText("to add this to your library and rate it")).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/sign-in?next=%2Fmovies%2F603");

  await page.goto("/library");
  await expect(page).toHaveURL("/sign-in?next=%2Flibrary");
});

test("adds titles to the library, filters it, changes a status, and removes a title", async ({
  page,
}) => {
  await signIn(page);

  await page.goto("/library");
  await expect(page.getByText("Your library is empty.")).toBeVisible();

  await page.goto("/movies/603");
  await andSave(page, page.getByRole("button", { name: "Want to watch" }).click());
  await expect(page.getByRole("button", { name: "Want to watch" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("group", { name: "In your library" })).toBeVisible();

  await page.goto("/games/113112");
  await andSave(page, page.getByRole("button", { name: "Playing" }).click());
  await expect(page.getByRole("group", { name: "In your library" })).toBeVisible();

  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(page).toHaveURL("/library");
  const titles = page.getByRole("main").getByRole("listitem");
  await expect(titles).toHaveCount(2);
  await expect(titles.filter({ hasText: "The Matrix" })).toContainText("Want to watch");
  await expect(titles.filter({ hasText: "Hades" })).toContainText("Playing");

  await page.getByRole("link", { name: "Games", exact: true }).click();
  await expect(page).toHaveURL("/library?type=game");
  await expect(titles).toHaveCount(1);
  await page.getByRole("link", { name: "Finished", exact: true }).click();
  await expect(page).toHaveURL("/library?type=game&status=finished");
  await expect(page.getByText("Nothing in your library matches these filters.")).toBeVisible();

  await page.goto("/games/113112");
  await expect(page.getByRole("button", { name: "Playing" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await andSave(page, page.getByRole("button", { name: "Finished" }).click());
  await andSave(page, page.getByRole("checkbox", { name: "Only I can see this" }).check());
  await page.goto("/library?status=finished");
  await expect(titles).toHaveCount(1);
  await expect(titles).toContainText("Finished, only you");

  await page.goto("/movies/603");
  await andSave(page, page.getByRole("button", { name: "Remove from library" }).click());
  await expect(page.getByRole("group", { name: "Add to your library" })).toBeVisible();
  await page.goto("/library");
  await expect(titles).toHaveCount(1);
  await expect(titles).toContainText("Hades");
});
