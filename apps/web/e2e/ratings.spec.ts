import { signIn } from "./session";
import { expect, test } from "./test";

test("rates a movie in quarter points, keeps the rating, and clears it", async ({ page }) => {
  await signIn(page);
  await page.goto("/movies/603");

  // Other people may already have rated this title, so only this person's own rating is checked.
  const slider = page.getByRole("slider", { name: "Your rating" });
  await expect(slider).toHaveAttribute("aria-valuetext", "Not rated");
  const stored = page.waitForResponse(/ratings\.save/);
  await slider.fill("33");
  await expect(page.getByRole("status")).toHaveText("8.25");
  await stored;
  await expect(page.getByText(/Average [\d.]+ out of 10 from \d+ ratings?\./)).toBeVisible();

  await page.reload();
  await expect(slider).toHaveValue("33");
  await expect(slider).toHaveAttribute("aria-valuetext", "8.25 out of 10");

  const cleared = page.waitForResponse(/ratings\.remove/);
  await page.getByRole("button", { name: "Clear rating" }).click();
  await cleared;
  await expect(page.getByRole("button", { name: "Clear rating" })).toBeHidden();
  await page.reload();
  await expect(slider).toHaveAttribute("aria-valuetext", "Not rated");
});

test("rates one episode of a show from its season page", async ({ page }) => {
  await signIn(page);
  await page.goto("/tv/95396/seasons/1");

  await page.getByRole("button", { name: "Rate episode 2" }).click();
  await page.getByRole("slider", { name: "Your rating" }).fill("38");

  await expect(page.getByRole("button", { name: "Your rating of episode 2: 9.5" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rate episode 1" })).toBeVisible();

  // Rating an episode does not rate the show.
  await page.goto("/tv/95396");
  await expect(page.getByRole("slider", { name: "Your rating" })).toHaveAttribute(
    "aria-valuetext",
    "Not rated",
  );
});

test("shows ratings to signed-out visitors without letting them rate", async ({ page }) => {
  await page.goto("/tv/95396/seasons/1");

  await expect(page.getByRole("heading", { name: /Good News About Hell/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Rate episode/ })).toHaveCount(0);
});
