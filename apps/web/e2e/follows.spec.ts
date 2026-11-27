import type { Page } from "@playwright/test";
import { signIn } from "./session";
import { expect, test } from "./test";

async function chooseUsername(page: Page, username: string, name: string) {
  await page.goto("/account");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
}

test("finds a person by searching, follows them, and is followed back", async ({
  page,
  browser,
}) => {
  const stamp = Date.now().toString(36);
  const [ada, grace] = [`ada_${stamp}`, `grace_${stamp}`];
  await signIn(page);
  await chooseUsername(page, ada, "Ada Follower");
  const other = await browser.newPage();
  await signIn(other);
  await chooseUsername(other, grace, "Grace Followed");

  // Ada finds Grace through search and follows her.
  await page.goto(`/search?q=${grace}`);
  await page
    .getByRole("region", { name: "People" })
    .getByRole("link", { name: /Grace Followed/ })
    .click();
  await expect(page).toHaveURL(`/u/${grace}`);
  await expect(page.getByRole("link", { name: "0 followers" })).toBeVisible();
  const followed = page.waitForResponse(/follows\.follow/);
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await followed;
  await expect(page.getByRole("button", { name: "Following" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("link", { name: "1 follower", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "1 follower", exact: true }).click();
  await expect(page).toHaveURL(`/u/${grace}/followers`);
  await expect(page.getByRole("region", { name: "Followers" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Followers/ })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.getByRole("link", { name: /Ada Follower/ })).toHaveAttribute(
    "href",
    `/u/${ada}`,
  );

  // Grace sees that Ada follows her, and follows back.
  await other.goto(`/u/${ada}`);
  await expect(other.getByText("Follows you", { exact: true })).toBeVisible();
  await expect(other.getByRole("link", { name: "1 following" })).toBeVisible();
  const followedBack = other.waitForResponse(/follows\.follow/);
  await other.getByRole("button", { name: "Follow back", exact: true }).click();
  await followedBack;
  await expect(other.getByText("Friends", { exact: true })).toBeVisible();

  // Ada changes her mind.
  await page.goto(`/u/${grace}`);
  const unfollowed = page.waitForResponse(/follows\.unfollow/);
  await page.getByRole("button", { name: "Following" }).click();
  await unfollowed;
  await expect(page.getByRole("button", { name: "Follow back", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "0 followers" })).toBeVisible();
  await other.close();
});

test("shows friends-only library entries to friends and to no one else", async ({
  page,
  browser,
}) => {
  const stamp = Date.now().toString(36);
  const [owner, friend] = [`owner_${stamp}`, `friend_${stamp}`];
  await signIn(page);
  await chooseUsername(page, owner, "Careful Owner");
  const other = await browser.newPage();
  await signIn(other);
  await chooseUsername(other, friend, "Close Friend");

  await page.goto("/movies/603");
  let stored = page.waitForResponse(/library\.save/);
  await page.getByRole("button", { name: "Watched" }).click();
  await stored;
  stored = page.waitForResponse(/library\.save/);
  await page.getByRole("button", { name: "Who can see this in your library: Everyone" }).click();
  await stored;
  await expect(
    page.getByRole("button", { name: "Who can see this in your library: Friends" }),
  ).toBeVisible();
  await page.goto("/library");
  const finished = page.getByRole("region", { name: "Finished" }).getByRole("article");
  await expect(finished).toHaveCount(1);
  await expect(finished).toContainText("The Matrix");
  await expect(finished).toContainText("Friends only");

  // Following one way is not friendship.
  await other.goto(`/u/${owner}`);
  let followed = other.waitForResponse(/follows\.follow/);
  await other.getByRole("button", { name: "Follow", exact: true }).click();
  await followed;
  await other.reload();
  await expect(other.getByText("Nothing in this library yet.")).toBeVisible();

  await page.goto(`/u/${friend}`);
  followed = page.waitForResponse(/follows\.follow/);
  await page.getByRole("button", { name: "Follow back", exact: true }).click();
  await followed;

  await other.reload();
  await expect(other.getByRole("link", { name: /The Matrix/ })).toBeVisible();
  const visitor = await browser.newPage();
  await visitor.goto(`/u/${owner}`);
  await expect(visitor.getByText("Nothing in this library yet.")).toBeVisible();
  await visitor.close();
  await other.close();
});

test("asks a signed-out visitor to sign in before following", async ({ page, browser }) => {
  const username = `solo_${Date.now().toString(36)}`;
  const owner = await browser.newPage();
  await signIn(owner);
  await chooseUsername(owner, username, "Solo Shelf");
  await owner.close();

  await page.goto(`/u/${username}`);
  await expect(page.getByText("to follow Solo Shelf.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Follow", exact: true })).toHaveCount(0);

  await page.goto(`/u/${username}/following`);
  await expect(page.getByText("Not following anyone yet.")).toBeVisible();
});
