import { signIn } from "./session";
import { expect, test } from "./test";

test("asks a signed-out visitor to sign in before showing recommendations", async ({ page }) => {
  await page.goto("/recommendations");
  await expect(page).toHaveURL("/sign-in?next=%2Frecommendations");
});

test("suggests titles like one rated highly, and none before anything is rated", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/library");
  await page.getByRole("link", { name: "For you" }).click();
  await expect(page).toHaveURL("/recommendations");
  await expect(page.getByRole("heading", { level: 1, name: "For you" })).toBeVisible();
  await expect(
    page.getByText("Rate a title 7 or higher and suggestions will appear"),
  ).toBeVisible();

  await page.goto("/books/OL20893680W");
  const stored = page.waitForResponse(/ratings\.save/);
  await page.getByRole("slider", { name: "Your rating" }).fill("34");
  await stored;

  await page.goto("/recommendations");
  const row = page.getByRole("region", { name: "Because you rated Piranesi 8.5" });
  await expect(row.getByRole("link", { name: "Piranesi" })).toHaveAttribute(
    "href",
    "/books/OL20893680W",
  );
  await expect(row.getByRole("listitem")).toHaveCount(3);
  // The book itself is by the same author, and is not suggested back.
  await expect(row.getByRole("listitem").filter({ hasText: "Piranesi" })).toHaveCount(0);
  await row.getByRole("link", { name: /Jonathan Strange and Mr\. Norrell/ }).click();
  await expect(page).toHaveURL("/books/OL5703422W");
});
