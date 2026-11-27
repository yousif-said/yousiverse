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

  // One click offers a price just under today's best; any other price goes in the field.
  await prices.getByRole("button", { name: "Other price" }).click();
  await price.fill("cheap");
  await prices.getByRole("button", { name: "Set alert" }).click();
  await expect(prices.getByRole("alert")).toHaveText("Enter a price in dollars, like 9.99.");

  // The game already costs $24.99, so an alert at that price has nothing to wait for.
  await price.fill("24.99");
  await prices.getByRole("button", { name: "Set alert" }).click();
  await expect(prices.getByRole("alert")).toContainText("No alert needed: it is now $24.99");

  await price.fill("$9.99");
  await prices.getByRole("button", { name: "Set alert" }).click();
  await expect(prices.getByRole("button", { name: "Alert at $9.99" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(prices.getByRole("button", { name: "Change price" })).toBeVisible();
  await expect(prices.getByText("Your alert $9.99")).toBeVisible();

  await page
    .getByRole("navigation", { name: "More" })
    .getByRole("link", { name: "Alerts" })
    .click();
  await expect(page).toHaveURL("/alerts");
  const waiting = page.getByRole("region", { name: "Still waiting" });
  await expect(waiting.getByRole("link", { name: "Hades" })).toBeVisible();
  await expect(waiting.getByText("$9.99 or less at a PC store")).toBeVisible();

  const emails = page.getByRole("switch", { name: "Alert emails" });
  await expect(emails).toBeChecked();
  const saved = page.waitForResponse(/alerts\.setEmails/);
  await emails.click();
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

test("offers streaming alerts on a movie only when they can be set", async ({ page }) => {
  await signIn(page);
  await page.goto("/movies/603");
  const watch = page.getByRole("region", { name: "Where to watch" });

  // The Matrix can already be streamed and this person has ticked nothing, so the page asks
  // for subscriptions instead of offering an alert that would be refused.
  await expect(watch.getByRole("link", { name: "Tick your subscriptions" })).toBeVisible();
  await expect(watch.getByRole("button", { name: /^Tell me when/ })).toHaveCount(0);

  await page.goto("/account");
  const saved = page.waitForResponse(/subscriptions\.set/);
  await page.getByRole("button", { name: "Netflix", exact: true }).click();
  await saved;

  await page.goto("/movies/603");
  const alert = watch.getByRole("button", { name: "Tell me when it's on mine" });
  await alert.click();
  const waiting = watch.getByRole("button", { name: /^Alert set/ });
  await expect(waiting).toHaveAttribute("aria-pressed", "true");
  await waiting.click();
  await expect(watch.getByRole("button", { name: "Tell me when it's on mine" })).toBeVisible();
});

test("stops alert emails from an unsubscribe link without signing in", async ({ page }) => {
  await page.goto("/alerts/unsubscribe");
  await expect(page.getByText("This link is missing its code.")).toBeVisible();

  await page.goto("/alerts/unsubscribe?token=not-a-real-token");
  await page.getByRole("button", { name: "Stop alert emails" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Done." })).toContainText(
    "Done. You will not get alert emails any more.",
  );
});
