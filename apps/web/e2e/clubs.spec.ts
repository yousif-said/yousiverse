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

async function startClub(page: Page, name: string, covers: string[], inviteOnly = false) {
  await page.getByRole("button", { name: "Start a club" }).click();
  const dialog = page.getByRole("dialog", { name: "Start a club" });
  await dialog.getByLabel("Name").fill(name);
  // The dialog starts with Books chosen.
  const books = dialog.getByRole("button", { name: "Books", exact: true });
  if (!covers.includes("Books")) await books.click();
  for (const kind of covers) {
    if (kind !== "Books") await dialog.getByRole("button", { name: kind, exact: true }).click();
  }
  if (inviteOnly) await dialog.getByRole("button", { name: "Invite link only" }).click();
  return dialog;
}

test("starts an invite-only club that only people with its link can see and join", async ({
  page,
  browser,
}) => {
  const stamp = Date.now().toString(36);
  const clubName = `Friday Films ${stamp}`;
  await signIn(page);
  await chooseUsername(page, `host_${stamp}`, "Club Host");

  await page.goto("/library");
  await page.getByRole("navigation").getByRole("link", { name: "Clubs", exact: true }).click();
  await expect(page).toHaveURL("/clubs");
  await expect(page.getByText("You are not in any clubs yet.")).toBeVisible();

  const form = await startClub(page, clubName, ["Movies", "TV"], true);
  await form.getByLabel("What is it about?").fill("One film a week.");
  await form.getByRole("button", { name: "Start club" }).click();

  await expect(page).toHaveURL(/\/clubs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: clubName })).toBeVisible();
  const head = page.getByRole("main");
  await expect(head.getByText("Invite only", { exact: true })).toBeVisible();
  await expect(head.getByText("Movies", { exact: true })).toBeVisible();
  await expect(head.getByText("TV", { exact: true })).toBeVisible();
  await expect(head.getByText("1 member, run by you")).toBeVisible();
  const clubUrl = page.url();
  await page.getByRole("button", { name: "Edit club" }).click();
  const inviteLink = await page.getByLabel("Invite link", { exact: true }).inputValue();
  expect(inviteLink).toContain(`${new URL(clubUrl).pathname}?invite=`);

  // Someone without the link is told there is no such club, and it is not listed.
  const guest = await browser.newPage();
  await signIn(guest);
  await chooseUsername(guest, `guest_${stamp}`, "Club Guest");
  expect((await guest.goto(clubUrl))?.status()).toBe(404);
  await guest.goto("/clubs");
  await expect(guest.getByText(clubName)).toHaveCount(0);

  // With the link they can look, then join.
  await guest.goto(inviteLink);
  await expect(guest.getByRole("heading", { level: 1, name: clubName })).toBeVisible();
  await expect(guest.getByText("You have been invited to this club.")).toBeVisible();
  await expect(guest.getByRole("heading", { name: "Members" })).toHaveCount(0);
  const joined = guest.waitForResponse(/clubs\.join/);
  await guest.getByRole("button", { name: "Join club" }).click();
  await joined;
  await expect(guest).toHaveURL(clubUrl);
  const members = guest.getByRole("region", { name: "Members" });
  await expect(members.getByRole("link")).toHaveCount(2);
  await expect(members.getByRole("link", { name: /Club Host/ })).toBeVisible();

  await guest.goto("/clubs");
  await expect(
    guest
      .getByRole("region", { name: "Your clubs" })
      .getByRole("link", { name: new RegExp(clubName) }),
  ).toContainText("2 members");

  // Leaving puts the club out of sight again.
  await guest.goto(clubUrl);
  guest.once("dialog", (dialog) => dialog.accept());
  const left = guest.waitForResponse(/clubs\.leave/);
  await guest.getByRole("button", { name: "Leave club" }).click();
  await left;
  await expect(guest).toHaveURL("/clubs");
  expect((await guest.goto(clubUrl))?.status()).toBe(404);
  await guest.close();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete club" }).click();
  await expect(page).toHaveURL("/clubs");
  await expect(page.getByText(clubName)).toHaveCount(0);
});

test("lists a public club for everyone and asks visitors to sign in before joining", async ({
  page,
  browser,
}) => {
  const stamp = Date.now().toString(36);
  const clubName = `Slow Readers ${stamp}`;
  const owner = await browser.newPage();
  await signIn(owner);
  await chooseUsername(owner, `reader_${stamp}`, "Slow Reader");
  await owner.goto("/clubs");
  const form = await startClub(owner, clubName, []);
  await form.getByRole("button", { name: "Start club" }).click();
  await expect(form.getByRole("alert")).toHaveText(
    "Choose at least one kind of title for the club to cover.",
  );
  await form.getByRole("button", { name: "Books", exact: true }).click();
  await form.getByRole("button", { name: "Start club" }).click();
  await expect(owner.getByRole("heading", { level: 1, name: clubName })).toBeVisible();
  const head = owner.getByRole("main");
  await expect(head.getByText("Public", { exact: true })).toBeVisible();
  await expect(head.getByText("Books", { exact: true })).toBeVisible();
  await expect(head.getByText("1 member, run by you")).toBeVisible();
  await owner.close();

  await page.goto("/clubs");
  await expect(page.getByRole("link", { name: "Start a club" })).toHaveAttribute(
    "href",
    "/sign-in?next=%2Fclubs",
  );
  await page
    .getByRole("region", { name: "Open to join" })
    .getByRole("link", { name: new RegExp(clubName) })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: clubName })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to join" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Members" }).getByRole("link", { name: /Slow Reader/ }),
  ).toBeVisible();
});

test("asks for a username before starting a club", async ({ page }) => {
  await signIn(page);
  await page.goto("/clubs");
  const form = await startClub(page, "No Name Yet", ["Games"]);
  await form.getByRole("button", { name: "Start club" }).click();

  await expect(form.getByRole("alert")).toContainText(
    "Choose a username on your account page first.",
  );
});

test("picks titles for a club from their pages, limited to what the club covers", async ({
  page,
}) => {
  const stamp = Date.now().toString(36);
  const clubName = `Pick Club ${stamp}`;
  await signIn(page);
  await chooseUsername(page, `picker_${stamp}`, "Club Picker");
  await page.goto("/clubs");
  const form = await startClub(page, clubName, ["Movies"]);
  await form.getByRole("button", { name: "Start club" }).click();
  await expect(page.getByRole("heading", { level: 1, name: clubName })).toBeVisible();
  const clubUrl = page.url();
  await expect(page.getByText(/No picks yet\. Open the page of any of the movies/)).toBeVisible();

  // A game is not offered to a film club.
  await page.goto("/games/113112");
  await expect(page.getByRole("button", { name: "Add to a list" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pick for a club" })).toHaveCount(0);

  await page.goto("/movies/603");
  let stored = page.waitForResponse(/ratings\.save/);
  const slider = page.getByRole("slider", { name: "Your rating" });
  await slider.focus();
  await slider.press("End");
  for (let step = 0; step < 6; step++) await slider.press("ArrowLeft");
  await expect(page.locator(".dial__num")).toHaveText("8.5");
  await stored;
  await page.getByRole("button", { name: "Pick for a club" }).click();
  stored = page.waitForResponse(/clubs\.addPick/);
  await page.getByRole("checkbox", { name: new RegExp(`^${clubName}`) }).click();
  await stored;
  await page.getByRole("button", { name: "Done" }).click();
  await expect(
    page.getByRole("main").getByRole("link", { name: new RegExp(clubName) }),
  ).toBeVisible();

  await page.goto(clubUrl);
  const picks = page.getByRole("region", { name: "Picks" }).getByRole("article");
  await expect(picks).toHaveCount(1);
  await expect(picks).toContainText("The Matrix");
  await expect(picks).toContainText(/Club average:\s*8\.5\s*from 1\s*rating/);

  stored = page.waitForResponse(/clubs\.removePick/);
  await page.getByRole("button", { name: "Remove The Matrix from this club's picks" }).click();
  await stored;
  await expect(picks).toHaveCount(0);
});

test("members discuss in a club: start a discussion, reply, and delete", async ({
  page,
  browser,
}) => {
  const stamp = Date.now().toString(36);
  const clubName = `Talkers ${stamp}`;
  await signIn(page);
  await chooseUsername(page, `talk_host_${stamp}`, "Talk Host");
  await page.goto("/clubs");
  const clubForm = await startClub(page, clubName, ["Books"]);
  await clubForm.getByRole("button", { name: "Start club" }).click();
  await expect(page.getByRole("heading", { level: 1, name: clubName })).toBeVisible();
  const clubUrl = page.url();

  const discussions = page.getByRole("region", { name: "Discussions" });
  await expect(discussions.getByText("No discussions yet. Start the first one.")).toBeVisible();
  await discussions.getByRole("button", { name: "Start a discussion" }).click();
  const discussionForm = page.getByRole("dialog", { name: "Start a discussion" });
  await discussionForm.getByLabel("Title").fill("Chapter one");
  await discussionForm.getByLabel("Opening post").fill("What about the house?");
  await discussionForm.getByRole("button", { name: "Post", exact: true }).click();

  await expect(page).toHaveURL(/\/clubs\/[0-9a-f-]{36}\/discussions\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Chapter one" })).toBeVisible();
  await expect(page.getByText("What about the house?")).toBeVisible();
  await expect(page.getByText("0 replies")).toBeVisible();
  const discussionUrl = page.url();

  // A signed-out visitor can read a public club's discussion but not reply.
  const visitor = await browser.newPage();
  await visitor.goto(discussionUrl);
  await expect(visitor.getByText("What about the house?")).toBeVisible();
  await expect(visitor.getByText(`and join ${clubName} to reply.`)).toBeVisible();
  await expect(visitor.getByLabel("Your reply")).toHaveCount(0);
  await visitor.close();

  // Someone signed in has to join before replying.
  const guest = await browser.newPage();
  await signIn(guest);
  await chooseUsername(guest, `talk_guest_${stamp}`, "Talk Guest");
  await guest.goto(discussionUrl);
  await guest.getByRole("link", { name: `Join ${clubName}` }).click();
  await expect(guest).toHaveURL(clubUrl);
  const joined = guest.waitForResponse(/clubs\.join/);
  await guest.getByRole("button", { name: "Join club" }).click();
  await joined;
  // The page has caught up with the membership once it offers to leave.
  await expect(guest.getByRole("button", { name: "Leave club" })).toBeVisible();
  await guest
    .getByRole("region", { name: "Discussions" })
    .getByRole("link", { name: "Chapter one" })
    .click();
  await guest.getByLabel("Your reply").fill("Unsettling, in a good way.");
  await guest.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(guest.getByText("1 reply")).toBeVisible();
  await expect(guest.getByText("Unsettling, in a good way.")).toBeVisible();
  // A member can delete their own reply but not someone else's discussion.
  await expect(guest.getByRole("button", { name: "Delete this discussion" })).toHaveCount(0);
  await expect(
    guest.getByRole("button", { name: `Delete the reply by talk_guest_${stamp}` }),
  ).toBeVisible();
  await guest.close();

  await page.goto(clubUrl);
  await expect(discussions.getByText(`Started by talk_host_${stamp}`)).toContainText("last reply");
  await discussions.getByRole("link", { name: "Chapter one" }).click();
  page.on("dialog", (dialog) => dialog.accept());
  // The owner can delete anyone's reply, and the discussion itself.
  await page.getByRole("button", { name: `Delete the reply by talk_guest_${stamp}` }).click();
  await expect(page.getByText("0 replies")).toBeVisible();
  await page.getByRole("button", { name: "Delete this discussion" }).click();
  await expect(page).toHaveURL(clubUrl);
  await expect(discussions.getByText("No discussions yet.")).toBeVisible();

  await page.getByRole("button", { name: "Edit club" }).click();
  await page.getByRole("button", { name: "Delete club" }).click();
  await expect(page).toHaveURL("/clubs");
});
