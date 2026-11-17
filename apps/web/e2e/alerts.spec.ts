import { signIn } from "./session";
import { expect, test } from "./test";

test("asks a signed-out visitor to sign in before showing alerts, and offers them none", async ({
  page,
}) => {
  await page.goto("/alerts");
  await expect(page).toHaveURL("/sign-in?next=%2Falerts");

  await page.goto("/games/113112");
  await expect(page.getByRole("heading", { name: "Where to buy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alerts" })).toHaveCount(0);
});

test("sets a price alert on a game, sees it on the alerts page, and removes it", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/games/113112");
  const prices = page.getByRole("region", { name: "Where to buy" });
  const price = prices.getByLabel("Tell me when it costs this or less");

  await price.fill("cheap");
  await prices.getByRole("button", { name: "Set alert" }).click();
  await expect(prices.getByRole("alert")).toHaveText("Enter a price in dollars, like 9.99.");

  // The game already costs $24.99, so an alert at that price has nothing to wait for.
  await price.fill("24.99");
  await prices.getByRole("button", { name: "Set alert" }).click();
  await expect(prices.getByRole("alert")).toContainText("No alert needed: it is now $24.99");

  await price.fill("$9.99");
  await prices.getByRole("button", { name: "Set alert" }).click();
  await expect(prices.getByText("We will tell you when it costs $9.99 or less.")).toBeVisible();

  await page.goto("/library");
  await page.getByRole("link", { name: "Your alerts" }).click();
  await expect(page).toHaveURL("/alerts");
  const waiting = page.getByRole("region", { name: "Still waiting" });
  await expect(waiting.getByRole("link", { name: "Hades" })).toBeVisible();
  await expect(waiting.getByText("Waiting until it costs $9.99 or less")).toBeVisible();

  const emails = page.getByRole("checkbox", { name: "Email me when an alert comes through" });
  await expect(emails).toBeChecked();
  const saved = page.waitForResponse(/alerts\.setEmails/);
  await emails.uncheck();
  await saved;
  await page.reload();
  await expect(emails).not.toBeChecked();

  await waiting
    .getByRole("button", {
      name: "Remove the alert on Hades for when it costs $9.99 or less",
    })
    .click();
  await expect(page.getByText("You have no alerts yet.")).toBeVisible();
});

test("offers streaming alerts on a movie and explains what is missing", async ({ page }) => {
  await signIn(page);
  await page.goto("/movies/603");
  const watch = page.getByRole("region", { name: "Where to watch" });

  // The Matrix can already be streamed, so there is nothing to wait for.
  await watch.getByRole("button", { name: "Tell me when it can be streamed" }).click();
  await expect(watch.getByRole("alert")).toContainText("No alert needed: it is now streaming on");

  await watch
    .getByRole("button", { name: "Tell me when it is on one of your subscriptions" })
    .click();
  await expect(watch.getByRole("alert")).toHaveText(
    "Tick the services you subscribe to on your account page first.",
  );
});

test("stops alert emails from an unsubscribe link without signing in", async ({ page }) => {
  await page.goto("/alerts/unsubscribe");
  await expect(page.getByText("This link is missing its code.")).toBeVisible();

  await page.goto("/alerts/unsubscribe?token=not-a-real-token");
  await page.getByRole("button", { name: "Stop alert emails" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Done. You will not get alert emails any more.",
  );
});
