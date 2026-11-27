import { signIn } from "./session";
import { expect, test } from "./test";

const csv = (name: string, text: string) => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from(text),
});

test("sends a signed-out visitor to sign in before importing", async ({ page }) => {
  await page.goto("/import");
  await expect(page).toHaveURL("/sign-in?next=%2Fimport");
});

test("imports a Letterboxd export into the library", async ({ page }) => {
  await signIn(page);
  await page.goto("/library");
  await page.getByRole("link", { name: "Import your history" }).click();
  await expect(page).toHaveURL("/import");

  await page
    .getByLabel(/Drop the files here/)
    .setInputFiles([
      csv(
        "ratings.csv",
        "Date,Name,Year,Letterboxd URI,Rating\n2024-01-05,The Matrix,1999,https://boxd.it/2a1m,4.5\n",
      ),
      csv(
        "watched.csv",
        "Date,Name,Year,Letterboxd URI\n2024-01-05,The Matrix,1999,https://boxd.it/2a1m\n2024-01-06,Zzzzqqqqxxxx,1999,https://boxd.it/zzzz\n",
      ),
    ]);
  await page
    .getByRole("group", { name: "Who can see what is imported" })
    .getByRole("button", { name: "Only you" })
    .click();
  await page.getByRole("button", { name: "Start import" }).click();

  await expect(page).toHaveURL(/\/import\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Letterboxd import finished" }),
  ).toBeVisible();
  const results = page.locator(".counts b");
  await expect(page.getByText("Added to your library")).toBeVisible();
  await expect(results).toHaveText(["1", "0", "1"]);
  await expect(
    page
      .getByRole("region", { name: "Could not be matched" })
      .getByRole("link", { name: "Search for Zzzzqqqqxxxx" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Open your library" }).click();
  const titles = page.getByRole("main").getByRole("article");
  await expect(titles).toHaveCount(1);
  const finished = page.getByRole("region", { name: "Finished" });
  await expect(finished.getByRole("article")).toContainText("The Matrix");
  await expect(finished.getByRole("article")).toContainText("Only you");

  await page.goto("/movies/603");
  await expect(page.getByRole("slider", { name: "Your rating" })).toHaveAttribute(
    "aria-valuetext",
    /9 out of 10/,
  );

  await page.goto("/import");
  await expect(
    page.getByRole("region", { name: "Your imports" }).getByRole("link", { name: /Letterboxd/ }),
  ).toContainText("2 titles");
});

test("imports a Steam library and explains a profile it cannot read", async ({ page }) => {
  await signIn(page);
  await page.goto("/import");
  await page
    .getByRole("group", { name: "Import from" })
    .getByRole("button", { name: /^Steam/ })
    .click();
  const steam = page.getByRole("region", { name: "From Steam" });

  await steam.getByLabel("Steam profile address or ID").fill("76561198000000002");
  await steam.getByRole("button", { name: "Start import" }).click();
  await expect(steam.getByRole("alert")).toContainText("set Game details to Public");

  await steam
    .getByLabel("Steam profile address or ID")
    .fill("https://steamcommunity.com/id/fixtureplayer");
  await steam
    .getByRole("group", { name: "Games you have played go in as" })
    .getByRole("button", { name: "Finished" })
    .click();
  await steam.getByRole("button", { name: "Start import" }).click();

  await expect(page).toHaveURL(/\/import\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Steam import finished" }),
  ).toBeVisible();
  await expect(page.getByText("Added to your library")).toBeVisible();
  await expect(page.locator(".counts b")).toHaveText(["2", "0", "1"]);

  await page.goto("/library?type=game");
  await expect(page.getByRole("main").getByRole("article")).toHaveCount(2);
  await expect(
    page
      .getByRole("region", { name: "Finished" })
      .getByRole("article")
      .filter({ hasText: "Hades" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Want" }).getByRole("article").filter({ hasText: "Portal 2" }),
  ).toHaveCount(1);
});

test("imports a Trakt profile and explains a private one", async ({ page }) => {
  await signIn(page);
  await page.goto("/import");
  await page
    .getByRole("group", { name: "Import from" })
    .getByRole("button", { name: /^Trakt/ })
    .click();
  const trakt = page.getByRole("region", { name: "From Trakt" });

  await trakt.getByLabel("Trakt username").fill("privatewatcher");
  await trakt.getByRole("button", { name: "Start import" }).click();
  await expect(trakt.getByRole("alert")).toContainText("That Trakt profile is private.");

  await trakt.getByLabel("Trakt username").fill("fixturewatcher");
  await trakt.getByRole("button", { name: "Start import" }).click();

  await expect(page).toHaveURL(/\/import\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Trakt import finished" }),
  ).toBeVisible();
  await expect(page.getByText("Added to your library")).toBeVisible();
  await expect(page.locator(".counts b")).toHaveText(["2", "0", "1"]);
  await expect(page.getByText("1 entry in the export was left out")).toBeVisible();

  await page.goto("/library");
  await expect(page.getByRole("main").getByRole("article")).toHaveCount(2);
  await expect(
    page
      .getByRole("region", { name: "Finished" })
      .getByRole("article")
      .filter({ hasText: "The Matrix" }),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole("region", { name: "In progress" })
      .getByRole("article")
      .filter({ hasText: "Severance" }),
  ).toHaveCount(1);
});

test("explains what is wrong with a file from a different service", async ({ page }) => {
  await signIn(page);
  await page.goto("/import");

  await page
    .getByRole("group", { name: "Import from" })
    .getByRole("button", { name: /^IMDb/ })
    .click();
  await page
    .getByLabel(/Drop the files here/)
    .setInputFiles(csv("watched.csv", "Date,Name,Year,Letterboxd URI\n2024-01-05,Heat,1995,x\n"));
  await page.getByRole("button", { name: "Start import" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "watched.csv" })).toHaveText(
    "watched.csv does not look like an IMDb export: it has no Const and Title columns.",
  );
  await expect(page).toHaveURL("/import");
});
