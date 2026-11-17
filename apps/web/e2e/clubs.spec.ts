import type { Page } from "@playwright/test";
import { signIn } from "./session";
import { expect, test } from "./test";

async function chooseUsername(page: Page, username: string, name: string) {
  await page.goto("/account");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
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
  await page.getByRole("main").getByRole("link", { name: "Clubs" }).click();
  await expect(page).toHaveURL("/clubs");
  await expect(page.getByText("You are not in any clubs yet.")).toBeVisible();

  const form = page.getByRole("region", { name: "Start a club" });
  await form.getByLabel("Club name").fill(clubName);
  await form.getByLabel("Description").fill("One film a week.");
  await form.getByRole("checkbox", { name: "Movies" }).check();
  await form.getByRole("checkbox", { name: "TV" }).check();
  await form.getByRole("radio", { name: /Invite only/ }).check();
  await form.getByRole("button", { name: "Start club" }).click();

  await expect(page).toHaveURL(/\/clubs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: clubName })).toBeVisible();
  await expect(
    page.getByText("Movies and TV. Invite only club run by you, 1 member."),
  ).toBeVisible();
  const clubUrl = page.url();
  await page.getByText("Manage club").click();
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
  const form = owner.getByRole("region", { name: "Start a club" });
  await form.getByLabel("Club name").fill(clubName);
  await form.getByRole("button", { name: "Start club" }).click();
  await expect(form.getByRole("alert")).toHaveText(
    "Tick at least one kind of title for the club to cover.",
  );
  await form.getByRole("checkbox", { name: "Books" }).check();
  await form.getByRole("button", { name: "Start club" }).click();
  await expect(owner.getByText("Books. Public club run by you, 1 member.")).toBeVisible();
  await owner.close();

  await page.goto("/clubs");
  await expect(page.getByText("to start a club or join one.")).toBeVisible();
  await page
    .getByRole("region", { name: "Public clubs" })
    .getByRole("link", { name: new RegExp(clubName) })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: clubName })).toBeVisible();
  await expect(page.getByText("to join this club.")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Members" }).getByRole("link", { name: /Slow Reader/ }),
  ).toBeVisible();
});

test("asks for a username before starting a club", async ({ page }) => {
  await signIn(page);
  await page.goto("/clubs");
  const form = page.getByRole("region", { name: "Start a club" });
  await form.getByLabel("Club name").fill("No Name Yet");
  await form.getByRole("checkbox", { name: "Games" }).check();
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
  const form = page.getByRole("region", { name: "Start a club" });
  await form.getByLabel("Club name").fill(clubName);
  await form.getByRole("checkbox", { name: "Movies" }).check();
  await form.getByRole("button", { name: "Start club" }).click();
  await expect(page.getByRole("heading", { level: 1, name: clubName })).toBeVisible();
  const clubUrl = page.url();
  await expect(page.getByText(/No picks yet\. Open the page of any of the movies/)).toBeVisible();

  // A game is not offered to a film club.
  await page.goto("/games/113112");
  await expect(page.getByText("Add to a list")).toBeVisible();
  await expect(page.getByText("Pick for a club")).toHaveCount(0);

  await page.goto("/movies/603");
  let stored = page.waitForResponse(/ratings\.save/);
  await page.getByRole("slider", { name: "Your rating" }).fill("34");
  await stored;
  await page.getByText("Pick for a club").click();
  stored = page.waitForResponse(/clubs\.addPick/);
  await page.getByRole("checkbox", { name: clubName }).check();
  await stored;
  await expect(page.getByText("(picked by 1 club)")).toBeVisible();

  await page.goto(clubUrl);
  const picks = page.getByRole("region", { name: "Picks" }).getByRole("listitem");
  await expect(picks).toHaveCount(1);
  await expect(picks).toContainText("The Matrix");
  await expect(picks).toContainText("Club average 8.5 from 1 rating");

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
  const clubForm = page.getByRole("region", { name: "Start a club" });
  await clubForm.getByLabel("Club name").fill(clubName);
  await clubForm.getByRole("checkbox", { name: "Books" }).check();
  await clubForm.getByRole("button", { name: "Start club" }).click();
  await expect(page.getByRole("heading", { level: 1, name: clubName })).toBeVisible();
  const clubUrl = page.url();

  const discussions = page.getByRole("region", { name: "Discussions" });
  await expect(
    discussions.getByText("No discussions yet. Start the first one below."),
  ).toBeVisible();
  await discussions.getByText("Start a discussion").click();
  await discussions.getByLabel("Discussion title").fill("Chapter one");
  await discussions.getByLabel("What do you want to talk about?").fill("What about the house?");
  await discussions.getByRole("button", { name: "Start discussion" }).click();

  await expect(page).toHaveURL(/\/clubs\/[0-9a-f-]{36}\/discussions\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Chapter one" })).toBeVisible();
  await expect(page.getByText("What about the house?")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No replies yet" })).toBeVisible();
  const discussionUrl = page.url();

  // A signed-out visitor can read a public club's discussion but not reply.
  const visitor = await browser.newPage();
  await visitor.goto(discussionUrl);
  await expect(visitor.getByText("What about the house?")).toBeVisible();
  await expect(visitor.getByText("and join the club to reply.")).toBeVisible();
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
  await guest.getByRole("button", { name: "Post reply" }).click();
  await expect(guest.getByRole("heading", { name: "1 reply" })).toBeVisible();
  await expect(guest.getByText("Unsettling, in a good way.")).toBeVisible();
  // A member can delete their own reply but not someone else's discussion.
  await expect(guest.getByRole("button", { name: "Delete this discussion" })).toHaveCount(0);
  await expect(
    guest.getByRole("button", { name: `Delete the reply by talk_guest_${stamp}` }),
  ).toBeVisible();
  await guest.close();

  await page.goto(clubUrl);
  await expect(discussions.getByText(`Started by talk_host_${stamp}, 1 reply`)).toBeVisible();
  await discussions.getByRole("link", { name: "Chapter one" }).click();
  page.on("dialog", (dialog) => dialog.accept());
  // The owner can delete anyone's reply, and the discussion itself.
  await page.getByRole("button", { name: `Delete the reply by talk_guest_${stamp}` }).click();
  await expect(page.getByRole("heading", { name: "No replies yet" })).toBeVisible();
  await page.getByRole("button", { name: "Delete this discussion" }).click();
  await expect(page).toHaveURL(clubUrl);
  await expect(discussions.getByText("No discussions yet.")).toBeVisible();

  await page.getByText("Manage club").click();
  await page.getByRole("button", { name: "Delete club" }).click();
  await expect(page).toHaveURL("/clubs");
});
