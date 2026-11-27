# Yousiverse redesign: the plan

Written 2026-11-26. This is the plan for turning the app into the mockup in [mockup/](mockup/). Nothing in the app has been changed yet. Work starts when you say go, and section 9 lists what I need you to decide first.

## 1. Where everything is

| What                                                       | Where                                                                                                           |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| The mockup, to click through                               | [mockup/index.html](mockup/index.html), or the private link `https://claude.ai/artifact/BXPKazHcK1kctTAqQUfueK` |
| Its design system (every color, size, and component style) | [mockup/css/app.css](mockup/css/app.css)                                                                        |
| How each screen is put together                            | [mockup/js/views-a.js](mockup/js/views-a.js), [mockup/js/views-b.js](mockup/js/views-b.js)                      |
| Shared pieces (artwork, cards, scores)                     | [mockup/js/core.js](mockup/js/core.js)                                                                          |
| Sample data                                                | [mockup/js/data.js](mockup/js/data.js)                                                                          |

To open it locally with working fonts: `python3 -m http.server 4173 --directory redesign/mockup`, then visit `http://localhost:4173`. Opening the file directly also works.

**What in the mockup is real and what is invented.** The 106 titles, their artwork, descriptions, seasons, episodes, and release dates are real, fetched through the app's own TMDB, IGDB, and Open Library clients. Everything about people is invented: the signed-in person, their friends, every rating, review, club, list, price, and streaming service. Build from the layouts, never from the sample numbers.

## 2. What was wrong, and what the redesign does about it

| Problem today                                                                                                                    | What the redesign does                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every page is a title, a grey sentence, a row of pills, and a ruled list. Nothing leads.                                         | Each page has one lead element, then supporting rows, then reference details. Home leads with what to pick up; a title page leads with its artwork and your status.                        |
| Half the app is hidden. For you, Calendar, Alerts, and Import are only reachable from a row of text links on the Library page.   | A sidebar holds every destination, grouped: yours, together, your clubs, alerts and import. Search opens from anywhere with ⌘K.                                                            |
| Home is a marketing page even when you are signed in.                                                                            | Signed in, Home is a dashboard: pick up where you left off, what is coming up, what on your want list is already on your services, friends, alerts, clubs. Signed out, it is a front door. |
| Movies, shows, games, and books all look identical: the same 5:7 card.                                                           | Every medium keeps its own shape. A movie is a poster, a show is a screen, a game is a case, a book is a book with a spine. You can tell them apart before reading a word.                 |
| Title pages ignore the artwork the app already stores. `backdropUrl` and episode `stillUrl` are in the database and never shown. | Title pages open on the backdrop. The whole page takes its color from the artwork. Episodes show their stills.                                                                             |
| Rating is a browser slider.                                                                                                      | Rating is an instrument: a ruler in quarter points laid over how everyone else rated, with the people you follow marked on it.                                                             |
| Franchise links, the app's most original idea, are a small grid at the bottom of a page.                                         | Universes get their own place: a map of a story across books, films, shows, and games, with your progress through it.                                                                      |
| The feed, calendar, clubs, and lists are text only.                                                                              | All of them show artwork, and each has its own layout instead of the shared ruled list.                                                                                                    |

### The seven rules of the design

1. **The interface is monochrome; the artwork is the light.** Buttons, text, and surfaces are ink and ivory. Color comes from the titles themselves and from one hue per medium.
2. **Every medium keeps its shape**, everywhere, at every size.
3. **One lead per page.** If two things compete, one of them moves down.
4. **Serif for stories, sans for the interface, mono for measurements.** Fraunces for titles and big numbers, Hanken Grotesk for everything you operate, Geist Mono for prices, dates, and counts.
5. **Rings mean a rating or progress.** The same small ring is used for your rating, everyone's average, and how far through something you are.
6. **Night first, day equal.** Night is the default because artwork reads best on it. Day is fully designed, not inverted.
7. **Nothing is ever only color.** Medium has a shape and an icon as well as a hue; state has a word as well as a fill.

## 3. Navigation and routes

Routes stay where they are unless the table says otherwise, so no link anyone has saved breaks.

| Route                                                    | Today                             | After                                                                                                                                                |
| -------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                      | Hero, search box, shelf of spines | Signed in: Home dashboard. Signed out: front door with sign-in                                                                                       |
| `/search`                                                | Search page                       | Kept and restyled. ⌘K palette added on every page                                                                                                    |
| `/library`                                               | Flat grid with two rows of pills  | Shelves grouped by status, tabs by medium with counts, sort, and a board view                                                                        |
| `/universes`, `/universes/[id]`                          | Do not exist                      | New. Index of story universes, and the map of one                                                                                                    |
| `/recommendations`                                       | Rows of cards                     | Same route, shown in the sidebar as "For you"                                                                                                        |
| `/calendar`                                              | Text list by month                | Weeks with artwork and countdowns, plus small month grids                                                                                            |
| `/feed`                                                  | Text list                         | Posts with artwork, grouped by day, with people to follow                                                                                            |
| `/clubs`, `/clubs/[id]`, discussions                     | Text lists                        | Tiles with picks and members; club page with picks shelf                                                                                             |
| `/lists`, `/lists/[id]`                                  | Text lists                        | Tiles; a list is a numbered ranking with artwork                                                                                                     |
| `/u/[username]`, `/followers`, `/following`              | Name, grid, lists                 | Header with stats and how they rate; followers and following become tabs (the two routes stay as deep links to those tabs)                           |
| `/alerts`                                                | List                              | What came through as cards with one action; what is waiting as rows                                                                                  |
| `/import`, `/import/[id]`                                | Forms stacked                     | Pick a source, three steps, live counts                                                                                                              |
| `/account`                                               | One column                        | Sections with their own sub-navigation; subscriptions as tiles                                                                                       |
| `/admin/links`                                           | Form and list                     | Review queue of pairs with approve and reject, and A / R keys                                                                                        |
| `/movies/[id]`, `/tv/[id]`, `/games/[id]`, `/books/[id]` | Poster left, column of controls   | Backdrop hero, status control, rating instrument, offers, universe, reviews, details aside                                                           |
| `/tv/[id]/seasons/[n]`                                   | Its own page                      | Kept as a deep link. The show page gains the season picker and episode list, and the season route renders the same section with that season selected |
| `/tv/[id]/seasons/[n]/episodes/[e]`                      | Its own page                      | Kept, restyled: still, rating instrument, reviews, previous and next                                                                                 |
| `/sign-in`                                               | Form                              | Folded into the front door; the route stays and shows the same panel, including "Check your email"                                                   |

Sidebar order: Home, Library, Universes, For you, Calendar; then Feed, Clubs, Lists; then your clubs; then Alerts (with a count of what came through) and Import; then your name, which opens profile, account, night or day, link review for reviewers, and sign out. Under 760px the sidebar becomes a five-item bar at the bottom: Home, Library, Search, Calendar, You.

## 4. Design tokens

The mockup's tokens are the top of [mockup/css/app.css](mockup/css/app.css). They move into [packages/ui/src/styles/globals.css](../packages/ui/src/styles/globals.css), keeping the shadcn names the components already read so nothing else has to change.

| shadcn name                          | Night                 | Day                   |
| ------------------------------------ | --------------------- | --------------------- |
| `--background`                       | `#0b0b0d`             | `#f3f2ee`             |
| `--foreground`                       | `#f4f1ea`             | `#131316`             |
| `--card`, `--popover`                | `#141417`             | `#ffffff`             |
| `--primary` / `--primary-foreground` | `#f4f1ea` / `#0b0b0d` | `#131316` / `#f6f5f1` |
| `--secondary`, `--accent`, `--muted` | white at 8%           | ink at 7.5%           |
| `--muted-foreground`                 | ivory at 72%          | ink at 74%            |
| `--border` / `--input`               | white at 9% / 18%     | ink at 10% / 22%      |
| `--ring`                             | `#f4f1ea`             | `#131316`             |
| `--destructive`                      | `#ff8a7a`             | `#b83a2a`             |
| `--movie`                            | `#ff7566`             | `#c8402f`             |
| `--tv`                               | `#62adff`             | `#1f6fd1`             |
| `--game`                             | `#b796ff`             | `#6d43d9`             |
| `--book`                             | `#f2c14e`             | `#94660a`             |

New tokens: `--fg-3` (third level of text, checked at 4.5:1 in both modes), `--good`, `--tone` (the current page's color, see 6.3), and the two shadows. Radii: 5 to 11px on artwork by medium, 11px on controls, 18 to 22px on panels. The current `--radius: 0.5rem` becomes `0.6875rem`.

Fonts load through `next/font/google` in [apps/web/src/app/layout.tsx](../apps/web/src/app/layout.tsx), replacing Bricolage Grotesque and Instrument Sans: Fraunces (variable, with optical size and italics) as `--font-display`, Hanken Grotesk as `--font-sans`, Geist Mono as `--font-mono`.

Night becomes the default in `next-themes`. The class stays `.dark`, so no component changes.

## 5. Components to build

Everything below exists in the mockup. "Replaces" names what it takes over in [apps/web/src/components](../apps/web/src/components).

| Component                                                     | Replaces                                                                          | Notes                                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `AppShell`, `Sidebar`, `TabBar`, `AmbientLight`               | `site-header.tsx`, `nav-link.tsx`                                                 | Sidebar is a server component: session, your clubs, alert count                                 |
| `CommandPalette`                                              | (new)                                                                             | Titles, people, universes, lists, clubs, pages. Arrow keys and Enter                            |
| `Artwork`                                                     | `cover.tsx`                                                                       | Four shapes. Shows use the backdrop with the title set over it                                  |
| `TitleCard`, `Shelf`, `Wall`                                  | `title-card.tsx`, `shelf.tsx`                                                     | Shelf scrolls sideways; Wall wraps. Cards keep one height and vary in width                     |
| `TitleRow`                                                    | the `divide-y` lists                                                              | Fixed artwork column so titles line up                                                          |
| `Score`, `Ring`                                               | the bold numerals                                                                 | Your rating in full strength, everyone's average dimmed                                         |
| `Avatar`                                                      | (new)                                                                             | Initials on a gradient made from the username. No uploads                                       |
| `MediumBadge`, `Chip`, `Segmented`, `Tabs`, `Panel`, `Switch` | `filter-pill.tsx`                                                                 | Tabs carry counts. Filters stay links so every view keeps its URL                               |
| `Hero`, `StatusControl`                                       | `media-header.tsx`, `library-control.tsx`                                         | Four states, worded for the medium, one click                                                   |
| `RatingDial`                                                  | `rating-control.tsx`, `rating-panel.tsx`, `episode-rating.tsx`                    | Drag, click, arrow keys, Page Up and Down, Home and End. Same save-after-rest behavior as today |
| `Offers`, `PriceBar`                                          | `where-to-watch.tsx`, `where-to-buy.tsx`, `title-alerts.tsx`, `alert-control.tsx` | Your subscriptions lead with one button; alerts sit in the same panel                           |
| `EpisodeHeatmap`, `EpisodeList`                               | season page list                                                                  | Heatmap is a grid of links; every cell has a text label                                         |
| `UniverseStrip`, `UniverseMap`                                | `related-titles.tsx`                                                              | The map's lines are drawn in SVG after layout                                                   |
| `ReviewItem`, `Composer`                                      | `review-section.tsx`, `review-editor.tsx`, `discussion-form.tsx`                  | People you follow first                                                                         |
| `Tile`                                                        | club and list rows                                                                | Used by clubs, lists, and universes                                                             |
| `MonthGrid`                                                   | (new)                                                                             | Small month with a dot per medium on days that have something                                   |
| `Dialog`, `Menu`, `Toast`                                     | `list-control.tsx`, `club-control.tsx`, `<details>` forms                         | Add to a list, pick for a club, new list, new club, new discussion                              |

Icons come from `lucide-react`, which the app already has (Film, Tv, Gamepad2, BookOpen, Orbit, and the rest). The mockup's hand-drawn icons are stand-ins.

## 6. What the design needs from the API

### 6.1 Uses data the app already stores (no migration)

| Need                             | Change                                                                                                                                                                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backdrops and stills             | Return `backdropUrl` wherever a title summary is returned (`media.shelf`, `library.list`, `profiles.library`, `calendar.upcoming`, `feed.following`, `clubs.picks`, `lists`, `links.forTitle`). Return `stillUrl` with episodes. One shared "title summary" shape in `packages/api` |
| Smaller backdrops for cards      | A helper that swaps the size in a TMDB or IGDB image URL (`w1280` to `w780`, `t_1080p` to `t_720p`). No new columns                                                                                                                                                                 |
| The rating instrument            | `ratings.distribution` (count per half point) and `ratings.fromFollowing` (the ratings of people you follow, honoring visibility). Tests for the visibility rules                                                                                                                   |
| Episode heatmap                  | `ratings.forShow`: every episode's average in one query, instead of `forSeason` once per season                                                                                                                                                                                     |
| Home                             | One `home.summary` query: in-progress entries, the next dated item per library title, came-through alerts, three feed items, latest discussions                                                                                                                                     |
| "Ready when you are"             | Want-list titles whose **already stored** offers include one of your subscriptions. It must never fetch: Watchmode allows 2,500 requests a month, and CLAUDE.md forbids fetching offers for titles nobody opened. Titles with no stored offers are simply left out                  |
| Universes                        | `links.universe` (every title connected to this one through verified links) and `links.universes`. A universe is computed from `media_links`; see decision 6 for its name                                                                                                           |
| Profile numbers                  | `profiles.stats`: counts and averages by medium, the rating histogram, highest rated. Honors visibility                                                                                                                                                                             |
| "In tune" percentage             | `profiles.match`: how closely two people's ratings agree on what both rated, from public and friends-visible ratings only                                                                                                                                                           |
| Tiles                            | `clubs.mine` and `clubs.discover` return four picks' artwork and the latest discussion; list queries return four items' artwork                                                                                                                                                     |
| Reviews, people you follow first | An order change in `reviews.list`                                                                                                                                                                                                                                                   |
| Library shelves                  | `library.list` returns counts per medium and status, and takes a sort                                                                                                                                                                                                               |

### 6.2 Needs a small migration

| Need                                           | Change                                                                                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shows as screens in search and recommendations | Search results and `similar_titles` only carry a poster. Add `backdropUrl` to `CatalogSearchResult` (TMDB already returns it) and a nullable column to `similar_titles`. Until then shows fall back to their poster |
| Notes on list items                            | Nullable `note` on list items                                                                                                                                                                                       |

### 6.3 The page's color

The mockup knows each title's dominant hue because I measured every poster ahead of time. The app has two ways to get the same effect:

- **A. No stored color.** The glow behind a page is the artwork itself, blurred, which needs nothing new. Controls that are tinted in the mockup (the dial's fill, the "Watch on" button, the heatmap) use ivory instead.
- **B. Stored color.** Two small nullable columns on `media` (`artHue`, `artSaturation`), measured once when a title is first saved or refreshed, by reading its poster on the server. This needs an image library; `sharp` is the usual one and is already what Next.js uses on Vercel, but it would be a new direct dependency.

I recommend starting with A and adding B as its own PR once the title page is in, because B is what makes each page feel like its title.

### 6.4 New capabilities the mockup shows

These are features, not restyling. Each one is its own decision and its own PR, and none of the restyling depends on them.

| In the mockup                                                                                              | What it would take                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Progress**: "Season 2, episode 7 is next", "Page 141 of 279", "38 hours played", and episode check marks | An `episode_watches` table, plus nullable `pagesRead` and `minutesPlayed` on `library_entries`. Trakt and Steam imports already see this data and could fill it. Without it, Home falls back to "the episode after the last one you rated" |
| **How long have you got?**                                                                                 | Already in PRODUCT.md as the time budget filter. A query over runtimes and page counts; games are left out until there is a source for their length                                                                                        |
| **Something for two**                                                                                      | Already in PRODUCT.md. A query over your want list and a friend's high ratings                                                                                                                                                             |
| **Library board** with drag                                                                                | Interface only. Uses `library.save`. Every row also needs a status menu so it works without a mouse                                                                                                                                        |
| **Want the other N** in a universe                                                                         | A loop over `library.save`, or one `library.saveMany`                                                                                                                                                                                      |
| **Universe descriptions**                                                                                  | The one-line descriptions are invented. Real ones need a small `universes` table that reviewers fill, or they are dropped                                                                                                                  |
| **Authors in search results**                                                                              | Already in PRODUCT.md                                                                                                                                                                                                                      |

## 7. Build order

Rules that shape the order:

- `main` stays deployable. Every PR leaves the whole app coherent, so the redesign lands page by page, never as one giant branch.
- The foundation goes first and changes every page at once: after PR 1.1 the whole app is night-first with the new type, even though the layouts are still the old ones.
- One logical change per PR, small enough to review in one sitting, with its tests.
- Neon allows 10 preview branches. I will stop after every 9 PRs and tell you to clear the merged ones.
- PRODUCT.md is updated in the same PR whenever what the app does changes.
- The 18 Playwright specs find things by role, label, and text (about 470 lookups). Every PR updates the specs it affects. Where a name can stay the same, it stays.

### Phase 1: Foundation

- [ ] **1.1 `feat(ui): new color, type, and night-first theme`**: tokens in `globals.css`, fonts in `layout.tsx`, restyled `Button`, `Input`, `Label`, focus ring, night as default. Check: every existing page still works and passes contrast in both modes.
- [ ] **1.2 `feat(web): sidebar, mobile bar, and ambient light`**: `AppShell` replaces `SiteHeader`. Removes the row of links from the Library page. Footer credits move to the bottom of the content area, wording unchanged.
- [ ] **1.3 `feat(web): artwork in each medium's shape`**: `Artwork`, `TitleCard`, `Shelf`, `Wall`, `TitleRow`, `Score`, `Avatar`, `MediumBadge`, `Chip`, `Segmented`, `Tabs`, `Panel`. API returns `backdropUrl` in title summaries. Swaps `Cover`, `TitleCard`, and `FilterPill` everywhere.

### Phase 2: Title pages

- [ ] **2.1 `feat(web): title page hero and status control`**: all four media. Details aside. Blurred-artwork glow.
- [ ] **2.2 `feat: rating instrument`**: `RatingDial`, `ratings.distribution`, `ratings.fromFollowing`, visibility tests. Used for titles and episodes.
- [ ] **2.3 `feat(web): where to watch and buy, with alerts in place`**: `Offers`, `PriceBar`.
- [ ] **2.4 `feat(web): reviews, lists, and club picks on title pages`**: `ReviewItem`, `Composer`, dialogs for lists and clubs.
- [ ] **2.5 `feat: episodes with heatmap and stills`**: `ratings.forShow`, `EpisodeHeatmap`, `EpisodeList`; season and episode pages.

### Phase 3: Library and Home

- [ ] **3.1 `feat: library shelves`**: grouping, tabs with counts, sort.
- [ ] **3.2 `feat(web): library board`**: drag between statuses, with a keyboard path.
- [ ] **3.3 `feat: home dashboard and front door`**: `home.summary`; the signed-out page and sign-in panel, including "Check your email".

### Phase 4: Finding things

- [ ] **4.1 `feat(web): search from anywhere`**: `CommandPalette`, restyled search page.
- [ ] **4.2 `feat(web): For you`**: restyled rows.
- [ ] **4.3 `feat(web): calendar by week`**: weeks, countdowns, `MonthGrid`.
- [ ] **4.4 `feat: universes`**: `links.universe`, `links.universes`, the index, the map, and the strip on title pages. Moves "Related titles" into it.

### Phase 5: Together

- [ ] **5.1 `feat(web): feed with artwork`**
- [ ] **5.2 `feat(web): clubs`**: index tiles, club page, discussion page, dialogs to start a club and a discussion.
- [ ] **5.3 `feat(web): lists`**: tiles and the ranked list page.
- [ ] **5.4 `feat: profiles`**: header, `profiles.stats`, `profiles.match`, tabs.

### Phase 6: The rest

- [ ] **6.1 `feat(web): alerts`**
- [ ] **6.2 `feat(web): import`**: source picker, steps, live progress and results.
- [ ] **6.3 `feat(web): account and link review`**: sections, subscription tiles, the review queue.
- [ ] **6.4 `feat(web): empty, loading, error, and not-found states`**: skeletons in the shape of what is loading; `error.tsx` and `not-found.tsx` in the new look.

### Phase 7: New capabilities (only the ones you approve)

- [ ] **7.1** Artwork color stored per title (6.3 B)
- [ ] **7.2** Progress tracking
- [ ] **7.3** Notes on list items, and reordering by hand
- [ ] **7.4** How long have you got?
- [ ] **7.5** Something for two
- [ ] **7.6** Backdrops in search results and recommendations
- [ ] **7.7** Universe names and descriptions

### Phase 8: Finish

- [ ] **8.1** Motion: the clicked poster growing into the next page's poster (the browser's View Transitions API, as the mockup does), page entrances, all switched off under reduced motion.
- [ ] **8.2** Accessibility pass: contrast in both modes, every flow by keyboard, names for every icon button, the dial and board with a screen reader.
- [ ] **8.3** Phone pass at 390px on every screen.
- [ ] **8.4** Remove what is no longer used; update CLAUDE.md's conventions with the seven rules; final PRODUCT.md check.

That is 27 PRs for the redesign itself and up to 7 for new capabilities.

### What "done" means for each PR

1. Typecheck, lint, Vitest, and Playwright pass locally, then in CI, and the Vercel preview is green.
2. I compare the built screen with the mockup side by side at 1440px and 390px, in night and day, and list anything that differs on purpose.
3. Every state is handled: signed out, empty, loading, error, long titles, missing artwork.
4. PRODUCT.md is updated if behavior changed.

## 8. Risks

| Risk                                            | How it is handled                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Watchmode quota                                 | Nothing new fetches availability. Home and the calendar read only what is stored               |
| Test churn                                      | Accessible names stay the same where they can. Specs change in the same PR as the screen       |
| Shows without a backdrop, books without a cover | `Artwork` falls back to the poster, then to the title set in type on a tinted panel            |
| Book covers vary in shape                       | Books use one fixed ratio (about 2:3) and crop. Measuring each cover would ride along with 7.1 |
| Blur is expensive on slow machines              | One blurred layer per page, fixed in place, switched off under reduced motion                  |
| Halfway states                                  | After Phase 1 old layouts sit in the new shell. That is expected and still coherent            |
| Third-level text contrast                       | Checked at 4.5:1 in both modes in the mockup; re-checked in 8.2                                |

## 9. What I need from you before starting

1. **The direction.** Is the mockup the target? Tell me anything you want changed first; changing the mockup is cheap, changing the app is not.
2. **Words.** The mockup says "Watched" for a finished movie and "Read" for a finished book, where the app says "Finished" for everything. Keep the new words? (I recommend yes.)
3. **Universes in the sidebar**, as a top-level place. (I recommend yes; it is the thing no other app has.)
4. **Default look.** Night for everyone, or follow each person's system setting? (I recommend night, with the switch in the menu.)
5. **Page color**: option A now and B later, as in 6.3? B needs `sharp` as a dependency.
6. **Universe names.** Use the oldest title's name and no description (no new table), or let reviewers name and describe them (new table)? (I recommend the first, then 7.7.)
7. **New components from shadcn/ui**: Dialog, Dropdown Menu, Tabs, Switch, Tooltip, and Command. They bring Radix packages and `cmdk`. Toasts would use `sonner`. All are part of shadcn/ui, which is already the stack, but they are new packages, so I am asking.
8. **Which new capabilities in 6.4 you want.** I recommend progress tracking first: it is what makes Home and "in progress" worth opening every day.
9. **Whether `redesign/` is committed.** I suggest committing this plan and the mockup's code, and ignoring `redesign/mockup/img` (18 MB of artwork that belongs to its owners).

CLAUDE.md asks for the frontend-design plugin on new screens. It was not available when this was written; if you want it used, install it before Phase 2.
