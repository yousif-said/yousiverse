import { signIn } from "./session";
import { expect, test } from "./test";

test("rates a movie in quarter points, keeps the rating, and clears it", async ({ page }) => {
  await signIn(page);
  await page.goto("/movies/603");

  // Other people may already have rated this title, so only this person's own rating is checked.
  const slider = page.getByRole("slider", { name: "Your rating" });
  await expect(slider).toHaveAttribute("aria-valuetext", "Not rated");
  const stored = page.waitForResponse(/ratings\.save/);
  await slider.focus();
  await slider.press("End");
  for (let step = 0; step < 7; step++) await slider.press("ArrowLeft");
  await expect(page.locator(".dial__num")).toHaveText("8.25");
  await stored;
  await expect(page.getByText(/Everyone [\d.]+ from \d+ ratings?/)).toBeVisible();

  await page.reload();
  await expect(slider).toHaveAttribute("aria-valuenow", "8.25");
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

  await page.getByRole("link", { name: "Rate episode 2" }).click();
  await expect(page).toHaveURL("/tv/95396/seasons/1/episodes/2");
  const slider = page.getByRole("slider", { name: "Your rating" });
  const stored = page.waitForResponse(/ratings\.save/);
  await slider.focus();
  await slider.press("End");
  await slider.press("ArrowLeft");
  await slider.press("ArrowLeft");
  await expect(page.locator(".dial__num")).toHaveText("9.5");
  await stored;

  await page.goto("/tv/95396/seasons/1");
  await expect(page.getByText("Your rating: 9.5")).toBeVisible();
  await expect(page.getByRole("link", { name: "Rate episode 1" })).toBeVisible();

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
  await expect(page.getByRole("link", { name: /Rate episode/ })).toHaveCount(0);
});
