import { signIn } from "./session";
import { expect, test } from "./test";

test("shows a signed-out visitor the whole catalog's calendar, with type filters", async ({
  page,
}) => {
  await page.goto("/calendar");

  await expect(page.getByRole("heading", { level: 1, name: "Release calendar" })).toBeVisible();
  await expect(page.getByText("from every title in the catalog")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Which titles" })).toHaveCount(0);

  const types = page.getByRole("navigation", { name: "Filter by type" });
  await expect(types.getByRole("link", { name: "Books" })).toHaveCount(0);
  await types.getByRole("link", { name: "Games" }).click();
  await expect(page).toHaveURL("/calendar?type=game");
  await expect(types.getByRole("link", { name: "Games" })).toHaveAttribute("aria-current", "true");
});

test("shows a signed-in person their library's calendar, and lets them see everything", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/library");
  await page.getByRole("link", { name: "Release calendar" }).click();
  await expect(page).toHaveURL("/calendar");

  const scope = page.getByRole("navigation", { name: "Which titles" });
  await expect(scope.getByRole("link", { name: "Your library" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  // A new account's library is empty, so nothing of theirs is coming up.
  await expect(
    page.getByText("Nothing in your library has a date in the next 90 days."),
  ).toBeVisible();

  await page.getByRole("link", { name: "See the whole catalog" }).click();
  await expect(page).toHaveURL("/calendar?show=catalog");
  await expect(scope.getByRole("link", { name: "Whole catalog" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.getByText("from every title in the catalog")).toBeVisible();
});
