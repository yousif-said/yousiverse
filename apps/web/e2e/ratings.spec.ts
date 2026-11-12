import { signIn } from "./session";
import { expect, test } from "./test";

test("rates a movie in quarter points, keeps the rating, and clears it", async ({ page }) => {
  await signIn(page);
  await page.goto("/movies/603");
  await expect(page.getByText("No ratings yet.")).toBeVisible();

  const slider = page.getByRole("slider", { name: "Your rating" });
  await slider.fill("33");
  await expect(page.getByRole("status")).toHaveText("8.25");
  await expect(page.getByText("Average 8.25 out of 10 from 1 rating.")).toBeVisible();

  await page.reload();
  await expect(slider).toHaveValue("33");
  await expect(slider).toHaveAttribute("aria-valuetext", "8.25 out of 10");

  await page.getByRole("button", { name: "Clear rating" }).click();
  await expect(page.getByText("No ratings yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear rating" })).toBeHidden();
});

test("rates one episode of a show from its season page", async ({ page }) => {
  await signIn(page);
  await page.goto("/tv/95396/seasons/1");

  await page.getByRole("button", { name: "Rate episode 2" }).click();
  await page.getByRole("slider", { name: "Your rating" }).fill("38");

  await expect(page.getByRole("button", { name: "Your rating of episode 2: 9.5" })).toBeVisible();
  await expect(page.getByText("average 9.5 from 1 rating")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rate episode 1" })).toBeVisible();

  await page.goto("/tv/95396");
  await expect(page.getByText("No ratings yet.")).toBeVisible();
});

test("shows ratings to signed-out visitors without letting them rate", async ({ page }) => {
  await page.goto("/tv/95396/seasons/1");

  await expect(page.getByRole("heading", { name: /Good News About Hell/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Rate episode/ })).toHaveCount(0);
});
