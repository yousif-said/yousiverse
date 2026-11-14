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
    .getByLabel("Files")
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
  await page.getByLabel("Who can see what is imported").selectOption("Only me");
  await page.getByRole("button", { name: "Start import" }).click();

  await expect(page).toHaveURL(/\/import\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Letterboxd import" })).toBeVisible();
  const results = page.getByRole("definition");
  await expect(page.getByText("Added to your library")).toBeVisible();
  await expect(results).toHaveText(["1", "1"]);
  await expect(
    page.getByRole("region", { name: "Not found" }).getByRole("link", { name: "Zzzzqqqqxxxx" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Open your library" }).click();
  const titles = page.getByRole("main").getByRole("listitem");
  await expect(titles).toHaveCount(1);
  await expect(titles).toContainText("The Matrix");
  await expect(titles).toContainText("Finished, only you");

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

test("explains what is wrong with a file from a different service", async ({ page }) => {
  await signIn(page);
  await page.goto("/import");

  await page.getByText("IMDb", { exact: true }).click();
  await page
    .getByLabel("Files")
    .setInputFiles(csv("watched.csv", "Date,Name,Year,Letterboxd URI\n2024-01-05,Heat,1995,x\n"));
  await page.getByRole("button", { name: "Start import" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "watched.csv" })).toHaveText(
    "watched.csv does not look like an IMDb export: it has no Const and Title columns.",
  );
  await expect(page).toHaveURL("/import");
});
