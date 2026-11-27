import { signIn } from "./session";
import { expect, test } from "./test";

test("ticks a subscription, which a show's page then points out", async ({ page }) => {
  await signIn(page);

  await page.goto("/tv/95396");
  const whereToWatch = page.getByRole("region", { name: "Where to watch" });
  await expect(whereToWatch.getByText("Subscription", { exact: true })).toBeVisible();
  await expect(
    whereToWatch.getByRole("link", { name: "Your subscriptions", exact: true }),
  ).toHaveCount(0);
  await whereToWatch.getByRole("link", { name: "Tick your subscriptions" }).click();
  await expect(page).toHaveURL("/account");

  const saved = page.waitForResponse(/subscriptions\.set/);
  await page.getByRole("button", { name: "AppleTV+", exact: true }).click();
  await saved;
  await page.reload();
  await expect(page.getByRole("button", { name: "AppleTV+", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Netflix", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await page.goto("/tv/95396");
  await expect(whereToWatch.getByText("Included with your subscriptions")).toBeVisible();
  await expect(
    whereToWatch.getByRole("link", { name: "Your subscriptions", exact: true }),
  ).toBeVisible();
  await expect(whereToWatch.getByRole("link", { name: "Watch on AppleTV+" })).toBeVisible();
  await expect(whereToWatch.getByText("Tick your subscriptions")).toHaveCount(0);
});
