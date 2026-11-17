import { signIn } from "./session";
import { expect, test } from "./test";

const REVIEWER = "e2e-reviewer@example.com";
const LINK = "The Matrix Reloaded (movie) is a sequel to The Matrix (movie)";

test("hides the review page from people who are not reviewers", async ({ page }) => {
  await signIn(page);

  expect((await page.goto("/admin/links"))?.status()).toBe(404);
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Review franchise links" })).toHaveCount(0);
});

test("a reviewer links two titles, which then point at each other, and removes the link", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await signIn(page, REVIEWER);
  await page.goto("/account");
  await page.getByRole("link", { name: "Review franchise links" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Franchise links" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Look for suggestions" })).toBeVisible();

  // A run that stopped halfway can leave the link behind.
  const verified = page.getByRole("region", { name: "Recently verified" });
  const leftover = verified.getByRole("button", { name: `Remove link: ${LINK}` });
  if (await leftover.isVisible()) {
    await leftover.click();
    await expect(leftover).toHaveCount(0);
  }

  const form = page.getByRole("region", { name: "Link two titles yourself" });
  await form.getByLabel("First title's page address").fill("http://localhost:3000/movies/604");
  await form.getByLabel("Second title's page address").fill("/movies/603");
  await form.getByRole("radio", { name: "The first title is a sequel to the second" }).check();
  await form.getByRole("button", { name: "Link titles" }).click();
  await expect(form.getByRole("status")).toContainText("Linked.");
  await expect(verified.getByRole("listitem")).toContainText([LINK]);

  // The same pair cannot be linked twice.
  await form.getByLabel("First title's page address").fill("/movies/603");
  await form.getByLabel("Second title's page address").fill("/movies/604");
  await form.getByRole("button", { name: "Link titles" }).click();
  await expect(form.getByRole("alert")).toHaveText("These two titles are already linked.");

  await page.goto("/movies/603");
  const related = page.getByRole("region", { name: "Related titles" });
  await expect(related.getByRole("heading", { name: "Followed by" })).toBeVisible();
  await related.getByRole("link", { name: /The Matrix Reloaded/ }).click();
  await expect(page).toHaveURL("/movies/604");
  const relatedToSequel = page.getByRole("region", { name: "Related titles" });
  await expect(relatedToSequel.getByRole("heading", { name: "Follows" })).toBeVisible();
  await expect(relatedToSequel.getByRole("link", { name: /The Matrix/ })).toHaveAttribute(
    "href",
    "/movies/603",
  );

  await page.goto("/admin/links");
  await verified.getByRole("button", { name: `Remove link: ${LINK}` }).click();
  await expect(verified.getByText(LINK)).toHaveCount(0);
  await page.goto("/movies/603");
  await expect(page.getByRole("heading", { level: 1, name: "The Matrix" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Related titles" })).toHaveCount(0);
});
