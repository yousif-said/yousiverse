import { signIn } from "./session";
import { expect, test } from "./test";

test("chooses a username, which then credits a public review", async ({ page, browser }) => {
  await signIn(page);
  const username = `e2e_${Date.now().toString(36)}`;
  const body = `Credited review ${username}`;

  // Before choosing a username, a review shows no name.
  await page.goto("/games/113112");
  await page.getByLabel("Your review").fill(body);
  await page.getByRole("button", { name: "Post review" }).click();
  await expect(page.getByRole("heading", { name: "Your review", exact: true })).toBeVisible();
  const visitor = await browser.newPage();
  await visitor.goto("/games/113112");
  const review = visitor.getByRole("listitem").filter({ hasText: body });
  await expect(review).toContainText("A Yousiverse member");

  await page.goto("/account");
  await page.getByLabel("Username").fill(username.toUpperCase());
  await page.getByLabel("Display name").fill("E2E Tester");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await page.reload();
  await expect(page.getByLabel("Username")).toHaveValue(username);
  await expect(page.getByLabel("Display name")).toHaveValue("E2E Tester");

  await visitor.reload();
  await expect(review).toContainText(username);
  await expect(review).not.toContainText("A Yousiverse member");
  await visitor.close();
});

test("refuses a username that someone else has", async ({ page, browser }) => {
  const username = `taken_${Date.now().toString(36)}`;
  await signIn(page);
  await page.goto("/account");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Display name").fill("First");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  const context = await browser.newContext();
  const second = await context.newPage();
  await second.route(
    (url) => url.hostname !== "localhost",
    (route) => route.abort(),
  );
  await signIn(second);
  await second.goto("/account");
  await second.getByLabel("Username").fill(username);
  await second.getByLabel("Display name").fill("Second");
  await second.getByRole("button", { name: "Save profile" }).click();
  await expect(second.getByText("That username is taken. Try another.")).toBeVisible();
  await context.close();
});
