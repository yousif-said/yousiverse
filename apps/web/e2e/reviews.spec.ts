import { signIn } from "./session";
import { expect, test } from "./test";

test("writes, edits, hides, and deletes a review of a book", async ({ page, browser }) => {
  await signIn(page);
  await page.goto("/books/OL20893680W");
  const body = `The House is beautiful. ${Date.now()}`;

  await page.getByLabel("Your review").fill(body);
  await page.getByRole("button", { name: "Post review" }).click();
  await expect(page.getByRole("heading", { name: "Your review", exact: true })).toBeVisible();
  await expect(page.getByText(body)).toBeVisible();

  // Someone who is not signed in can read a public review.
  const visitor = await browser.newPage();
  await visitor.goto("/books/OL20893680W");
  await expect(visitor.getByText(body)).toBeVisible();
  await expect(visitor.getByText("to write a review.")).toBeVisible();

  await page.getByRole("button", { name: "Edit review" }).click();
  await page.getByLabel("Your review").fill(`${body} Edited.`);
  await page.getByRole("checkbox", { name: "Only I can see this review" }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Your review, visible only to you" }),
  ).toBeVisible();
  await expect(page.getByText(`${body} Edited.`)).toBeVisible();

  await visitor.reload();
  await expect(visitor.getByRole("heading", { name: "Reviews" })).toBeVisible();
  await expect(visitor.getByText(body)).toHaveCount(0);
  await visitor.close();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete review" }).click();
  await expect(page.getByLabel("Your review")).toHaveValue("");
  await page.reload();
  await expect(page.getByText(body)).toHaveCount(0);
});

test("opens an episode from its season, then rates and reviews it", async ({ page }) => {
  await signIn(page);
  await page.goto("/tv/95396/seasons/1");
  await page.getByRole("link", { name: "Episode 3: In Perpetuity" }).click();

  await expect(page).toHaveURL("/tv/95396/seasons/1/episodes/3");
  await expect(page.getByRole("heading", { level: 1, name: "In Perpetuity" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Season 1");

  await page.getByRole("slider", { name: "Your rating" }).fill("34");
  await expect(page.getByRole("status")).toHaveText("8.5");
  const body = `The wellness session. ${Date.now()}`;
  await page.getByLabel("Your review").fill(body);
  await page.getByRole("button", { name: "Post review" }).click();
  await expect(page.getByText(body)).toBeVisible();

  // An episode's review stays on the episode, not on the show's page.
  await page.goto("/tv/95396");
  await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();
  await expect(page.getByText(body)).toHaveCount(0);
});

test("shows the not-found page for an episode that does not exist", async ({ page }) => {
  const response = await page.goto("/tv/95396/seasons/1/episodes/99");

  expect(response?.status()).toBe(404);
});
