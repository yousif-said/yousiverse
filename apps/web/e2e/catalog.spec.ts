import { expect, test } from "@playwright/test";

test("finds a show by searching, then opens it and one of its seasons", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Search", exact: true }).click();

  await page.getByRole("searchbox", { name: "Search movies and TV shows" }).fill("severance");
  await expect(page).toHaveURL("/search?q=severance");
  await page.getByRole("link", { name: /^Severance TV show, 2022/ }).click();

  await expect(page).toHaveURL("/tv/95396");
  await expect(page.getByRole("heading", { level: 1, name: "Severance" })).toBeVisible();
  await expect(page.getByText("First aired")).toBeVisible();
  await expect(page.getByText("February 17, 2022")).toBeVisible();

  await page.getByRole("link", { name: /Season 1.*9 episodes/ }).click();

  await expect(page).toHaveURL("/tv/95396/seasons/1");
  await expect(page.getByRole("heading", { level: 1, name: "Season 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Good News About Hell/ })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(9);
});

test("opens a movie page directly", async ({ page }) => {
  await page.goto("/movies/603");

  await expect(page.getByRole("heading", { level: 1, name: "The Matrix" })).toBeVisible();
  await expect(page.getByText("2h 16m")).toBeVisible();
  await expect(page).toHaveTitle("The Matrix | Yousiverse");
});

test("shows the not-found page for a title that does not exist", async ({ page }) => {
  const response = await page.goto("/movies/999999999");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page isn't on the shelf" })).toBeVisible();
});

test("says so when nothing matches a search", async ({ page }) => {
  await page.goto("/search?q=zzzzqqqqxxxx");

  await expect(page.getByText("Nothing matches “zzzzqqqqxxxx”")).toBeVisible();
});
