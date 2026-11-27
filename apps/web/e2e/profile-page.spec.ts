import type { Page } from "@playwright/test";
import { signIn } from "./session";
import { expect, test } from "./test";

async function andStore(page: Page, request: RegExp, action: Promise<unknown>) {
  const stored = page.waitForResponse(request);
  await action;
  await stored;
}

test("a public profile shows what its owner made public and nothing private", async ({
  page,
  browser,
}) => {
  await signIn(page);
  const username = `shelf_${Date.now().toString(36)}`;
  await page.goto("/account");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Display name").fill("Shelf Keeper");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  // A public library entry with a rating and a review, and a private library entry.
  await page.goto("/movies/603");
  await andStore(page, /library\.save/, page.getByRole("button", { name: "Watched" }).click());
  const slider = page.getByRole("slider", { name: "Your rating" });
  await andStore(
    page,
    /ratings\.save/,
    (async () => {
      await slider.focus();
      await slider.press("End");
      for (let step = 0; step < 4; step++) await slider.press("ArrowLeft");
    })(),
  );
  await expect(slider).toHaveAttribute("aria-valuenow", "9");
  await page.getByLabel("Your review").fill(`Profile review by ${username}`);
  await page.getByRole("button", { name: "Post review" }).click();
  await expect(page.getByRole("heading", { name: "Your review", exact: true })).toBeVisible();

  await page.goto("/games/113112");
  await andStore(page, /library\.save/, page.getByRole("button", { name: "Playing" }).click());
  const visibility = page.getByRole("button", { name: /^Who can see this in your library: / });
  await andStore(page, /library\.save/, visibility.click());
  await andStore(page, /library\.save/, visibility.click());
  await expect(visibility).toHaveAccessibleName("Who can see this in your library: Only you");

  await page.goto("/lists");
  await page.getByRole("button", { name: "New list" }).first().click();
  await page
    .getByRole("dialog", { name: "New list" })
    .getByLabel("Name")
    .fill("Shown on my profile");
  await page.getByRole("button", { name: "Create list" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Shown on my profile" })).toBeVisible();

  const visitor = await browser.newPage();
  await visitor.goto(`/u/${username}`);
  await expect(visitor.getByRole("heading", { level: 1, name: "Shelf Keeper" })).toBeVisible();
  const library = visitor.getByRole("region", { name: "Library" });
  await expect(library.getByRole("article")).toHaveCount(1);
  await expect(library.getByRole("article")).toContainText("The Matrix");
  await expect(library.getByRole("article")).toContainText("Watched");
  await expect(visitor.getByText("Hades")).toHaveCount(0);
  await expect(visitor.getByRole("link", { name: "Edit profile" })).toHaveCount(0);

  await visitor.getByRole("link", { name: /^Lists/ }).click();
  await expect(visitor).toHaveURL(`/u/${username}?tab=lists`);
  await expect(visitor.getByRole("link", { name: /Shown on my profile.*0 titles/ })).toBeVisible();
  await visitor.getByRole("link", { name: /^Reviews/ }).click();
  const reviews = visitor.getByRole("region", { name: "Reviews" });
  await expect(reviews.getByRole("listitem")).toContainText(`Profile review by ${username}`);
  await expect(reviews.getByRole("listitem")).toContainText("Rated 9 out of 10");
  await visitor.goto(`/u/${username}`);

  await visitor.getByRole("link", { name: "Games", exact: true }).click();
  await expect(visitor).toHaveURL(`/u/${username}?type=game`);
  await expect(visitor.getByText("Nothing in this library matches these filters.")).toBeVisible();

  // The review on the title's page links back to the profile.
  await visitor.goto("/movies/603");
  await visitor.getByRole("link", { name: username }).click();
  await expect(visitor).toHaveURL(`/u/${username}`);
  await visitor.close();

  // The owner sees the same public view, with a note saying so.
  await page.goto("/account");
  await page.getByRole("link", { name: "View your profile" }).click();
  await expect(page).toHaveURL(`/u/${username}`);
  await expect(page.getByText("This is your profile as everyone sees it.")).toBeVisible();
  await expect(page.getByText("Hades")).toHaveCount(0);
});

test("shows the not-found page for a username nobody has", async ({ page }) => {
  const response = await page.goto("/u/nobody_has_this_name");

  expect(response?.status()).toBe(404);
});
