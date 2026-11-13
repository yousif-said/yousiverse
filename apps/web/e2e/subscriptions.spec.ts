import { signIn } from "./session";
import { expect, test } from "./test";

test("ticks a subscription, which a show's page then points out", async ({ page }) => {
  await signIn(page);

  await page.goto("/tv/95396");
  const whereToWatch = page.getByRole("region", { name: "Where to watch" });
  await expect(whereToWatch.getByText("Stream", { exact: true })).toBeVisible();
  await expect(whereToWatch.getByText("Your subscriptions", { exact: true })).toHaveCount(0);
  await whereToWatch.getByRole("link", { name: "Tick your subscriptions" }).click();
  await expect(page).toHaveURL("/account");

  const saved = page.waitForResponse(/subscriptions\.set/);
  await page.getByRole("checkbox", { name: "AppleTV+", exact: true }).check();
  await saved;
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "AppleTV+", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Netflix", exact: true })).not.toBeChecked();

  await page.goto("/tv/95396");
  await expect(whereToWatch.getByText("Your subscriptions", { exact: true })).toBeVisible();
  await expect(whereToWatch.getByRole("link", { name: /^AppleTV\+ \(/ })).toBeVisible();
  await expect(whereToWatch.getByText("Tick your subscriptions")).toHaveCount(0);
});
