import type { Page } from "@playwright/test";
import { signIn } from "./session";
import { expect, test } from "./test";

async function searchFromPalette(page: Page, query: string) {
  await page.getByRole("button", { name: "Search" }).click();
  await page
    .getByRole("dialog", { name: "Search" })
    .getByRole("combobox", { name: "Search" })
    .fill(query);
  await page.getByRole("option", { name: `Search everything for “${query}”` }).click();
  await expect(page).toHaveURL(`/search?q=${query}`);
}

test("finds a show by searching, then opens it and one of its seasons", async ({ page }) => {
  await signIn(page);
  await searchFromPalette(page, "severance");
  await page
    .getByRole("link", { name: "Severance", exact: true })
    .and(page.locator('[href^="/tv/"]'))
    .first()
    .click();

  await expect(page).toHaveURL("/tv/95396");
  await expect(page.getByRole("heading", { level: 1, name: "Severance" })).toBeVisible();
  await expect(page.getByText("First aired")).toBeVisible();
  await expect(page.getByText("February 17, 2022")).toBeVisible();

  await page
    .getByRole("navigation", { name: "Season" })
    .getByRole("link", { name: "Season 1" })
    .click();

  await expect(page).toHaveURL("/tv/95396?season=1");
  await expect(page.getByRole("heading", { name: /Good News About Hell/ })).toBeVisible();
  await expect(page.locator("ol.eps > li")).toHaveCount(9);

  await page.goto("/tv/95396/seasons/1");
  await expect(page.getByRole("heading", { level: 1, name: "Season 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Good News About Hell/ })).toBeVisible();
  await expect(page.locator("ol.eps > li")).toHaveCount(9);
});

test("opens a movie page directly", async ({ page }) => {
  await page.goto("/movies/603");

  await expect(page.getByRole("heading", { level: 1, name: "The Matrix" })).toBeVisible();
  await expect(page.getByText("2h 16m").first()).toBeVisible();
  await expect(page).toHaveTitle("The Matrix · Yousiverse");
});

test("shows where a movie and a show can be watched", async ({ page }) => {
  await page.goto("/movies/603");

  const whereToWatch = page.getByRole("region", { name: "Where to watch" });
  await expect(whereToWatch.getByText("Rent", { exact: true })).toBeVisible();
  const amazon = whereToWatch.getByRole("link", { name: /^Amazon \$4\.99/ });
  await expect(amazon).toHaveAttribute("href", /^https:\/\//);
  await expect(amazon).toHaveAttribute("target", "_blank");
  await expect(whereToWatch.getByText(/US only\. Checked /)).toBeVisible();

  await page.goto("/tv/95396");
  await expect(whereToWatch.getByRole("link", { name: /^AppleTV\+ \(/ })).toBeVisible();
  await expect(whereToWatch.getByText(/prices are for one episode/)).toBeVisible();

  await page.goto("/games/113112");
  await expect(page.getByRole("heading", { level: 1, name: "Hades" })).toBeVisible();
  await expect(whereToWatch).toHaveCount(0);
});

test("shows what a game costs in PC stores", async ({ page }) => {
  await page.goto("/games/113112");

  const whereToBuy = page.getByRole("region", { name: "Where to buy" });
  const steam = whereToBuy.getByRole("link", { name: /^Steam .*\$24\.99$/ });
  await expect(steam).toHaveAttribute("href", /^https:\/\//);
  await expect(steam).toHaveAttribute("target", "_blank");
  await expect(whereToBuy.getByText(/The lowest it has ever been is \$6\.24\./)).toBeVisible();
  await expect(
    whereToBuy.getByText(/US PC stores\. Console prices are not covered yet\./),
  ).toBeVisible();

  await page.goto("/movies/603");
  await expect(page.getByRole("heading", { level: 1, name: "The Matrix" })).toBeVisible();
  await expect(whereToBuy).toHaveCount(0);
});

test("shows the not-found page for a title that does not exist", async ({ page }) => {
  const response = await page.goto("/movies/999999999");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Nothing here." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Home" })).toBeVisible();
});

test("says so when nothing matches a search", async ({ page }) => {
  await page.goto("/search?q=zzzzqqqqxxxx");

  await expect(
    page.getByText("Nothing matches “zzzzqqqqxxxx”. Check the spelling, or try fewer words."),
  ).toBeVisible();

  for (const [type, plural] of [
    ["movie", "movies"],
    ["tv", "TV shows"],
    ["game", "games"],
    ["book", "books"],
  ]) {
    await page.goto(`/search?q=zzzzqqqqxxxx&type=${type}`);
    await expect(
      page.getByText(`No ${plural} match “zzzzqqqqxxxx”. Check the spelling, or try fewer words.`),
    ).toBeVisible();
  }
});

test("finds a game by searching and opens its page", async ({ page }) => {
  await page.goto("/search?q=hades");
  await page
    .getByRole("link", { name: "Hades", exact: true })
    .and(page.locator('[href="/games/113112"]'))
    .first()
    .click();

  await expect(page).toHaveURL("/games/113112");
  await expect(page.getByRole("heading", { level: 1, name: "Hades" })).toBeVisible();
  await expect(page.getByText("Supergiant Games").first()).toBeVisible();
  await expect(page.getByText("September 17, 2020")).toBeVisible();
});

test("finds a book by searching and opens its page", async ({ page }) => {
  await page.goto("/search?q=piranesi");
  await page
    .getByRole("link", { name: "Piranesi", exact: true })
    .and(page.locator('[href="/books/OL20893680W"]'))
    .first()
    .click();

  await expect(page).toHaveURL("/books/OL20893680W");
  await expect(page.getByRole("heading", { level: 1, name: "Piranesi" })).toBeVisible();
  await expect(page.getByText("Susanna Clarke").first()).toBeVisible();
});

test("sends a merged book to the page of the book it was merged into", async ({ page }) => {
  await page.goto("/books/OL893415W");

  await expect(page).toHaveURL("/books/OL893414W");
  await expect(page.getByRole("heading", { level: 1, name: "Dune" })).toBeVisible();
});

test("narrows a search to one media type and keeps the filter while typing", async ({ page }) => {
  await page.goto("/search?q=hades");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Movies",
    "TV",
    "Games",
    "Books",
  ]);

  await page
    .getByRole("navigation", { name: "Filter results by type" })
    .getByRole("link", { name: "Games" })
    .click();

  await expect(page).toHaveURL("/search?q=hades&type=game");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Games"]);
  await expect(
    page
      .getByRole("link", { name: "Hades", exact: true })
      .and(page.locator('[href="/games/113112"]'))
      .first(),
  ).toBeVisible();

  await page.getByRole("searchbox", { name: "Search the catalog" }).fill("severance");
  await expect(page).toHaveURL("/search?q=severance&type=game");
});
