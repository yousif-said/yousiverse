# Yousiverse

Yousiverse is a web app (mobile later) for cataloging movies, TV shows, video games, and books in one place: a personal library, ratings, reviews, lists, social features, and where-to-watch/buy info.

- **Product scope:** see `PRODUCT.md`. It is the source of truth for what is built and what is planned.
- **Market:** US only for now (pricing, availability, and regional data).

## Keeping PRODUCT.md current

When a feature ships, move it from "Future features" to "In the app" in `PRODUCT.md` in the same PR. If a feature's scope changes during implementation, update its entry.

## Tech stack

Do not swap out or add to the core stack without asking first.

### Core (use from day one)

| Area                      | Choice                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Language                  | TypeScript (strict) everywhere                                                        |
| Package manager / scripts | Bun (installs and script running; the app itself runs on Node, locally and on Vercel) |
| Monorepo                  | Bun workspaces + Turborepo                                                            |
| Web framework             | Next.js 16 (App Router, React Server Components)                                      |
| Styling / UI              | Tailwind CSS v4 + shadcn/ui                                                           |
| API                       | tRPC, defined in `packages/api`, mounted as a route in the Next.js app                |
| Validation                | Zod (API inputs, forms, env vars, external API responses)                             |
| Database                  | Postgres: Docker locally, Neon for preview and production                             |
| ORM                       | Drizzle ORM + drizzle-kit migrations                                                  |
| Auth                      | Better Auth (Google, emailed sign-in link; Apple later) stored in our own Postgres    |
| Email                     | Resend, called over HTTP from `packages/integrations/resend`; plain HTML emails       |
| Background jobs           | Inngest, defined in `packages/api/src/jobs.ts` and served at `/api/inngest`           |
| Lint / format             | Biome                                                                                 |
| Tests                     | Vitest (unit/integration), Playwright (end-to-end)                                    |
| CI                        | GitHub Actions: typecheck, lint, test on every PR                                     |
| Hosting                   | Vercel (preview deploy per PR)                                                        |

### Planned additions (add only when the first feature that needs them is built)

| Tool               | Add when                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| React Email        | Only if emails outgrow the plain layout in `packages/email`                      |
| Upstash Redis      | Rate limiting, or caching external API calls beyond what Next.js caching handles |
| Sentry, PostHog    | Shortly before launching to real users                                           |
| Expo (Expo Router) | Mobile app, added as `apps/mobile`, reusing `packages/api` and shared validation |
| Hono               | Only if the API ever needs to run outside Next.js                                |

### External data sources

| Data                                     | Source                                       |
| ---------------------------------------- | -------------------------------------------- |
| Movies, TV (incl. seasons/episodes)      | TMDB                                         |
| Video games                              | IGDB (via Twitch developer credentials)      |
| Books                                    | Open Library, Google Books                   |
| Streaming availability + rent/buy prices | Watchmode                                    |
| PC game prices / historical lows         | IsThereAnyDeal                               |
| Franchise link suggestions               | Wikidata (suggestions only; see Conventions) |

Wrap every external API in its own module under `packages/integrations/<provider>` with typed, Zod-validated responses. Never call providers directly from UI code. Cache responses and respect each provider's rate limits and attribution requirements.

## CI/CD

- **Pull requests:** GitHub Actions runs typecheck, Biome lint, Vitest, and Playwright on every PR. All must pass before merging. GitHub does not enforce this on the current plan, so check before merging. Check the Vercel preview too: it reports as a commit status, separate from the Actions check run, and a PR whose preview failed must not be merged.
- **Preview deploys:** Vercel builds every PR to its own preview URL. Each preview uses its own Neon database branch (Neon's Vercel integration), never the production database. Neon's free plan allows 10 branches per project, and a preview fails at "Provisioning Integrations" once they run out, so branches of merged PRs have to be deleted (automatic deletion is a setting of the Neon integration).
- **Production:** merging to `main` deploys to production automatically. No manual deploy steps.
- **Migrations:** Drizzle migrations run automatically as part of every deploy (preview and production) before the new code serves traffic. Migrations must be backward compatible with the previously deployed code (add columns before using them; remove in a later deploy).
- **Caching:** use Turborepo remote caching on Vercel so CI and builds skip unchanged packages.
- **Rollback:** use Vercel's instant rollback for a bad deploy; fix forward with a new migration rather than editing an applied one.

## Repo layout (target)

```
apps/
  web/              Next.js app
  mobile/           Expo app (later)
packages/
  api/              tRPC routers and business logic
  db/               Drizzle schema, migrations, seed scripts
  auth/             Better Auth config
  email/            Email layout, sending, and the limits on how many go out
  integrations/     External API clients (tmdb, igdb, open-library, watchmode, itad, steam, trakt, wikidata, resend)
  ui/               Shared UI components (shadcn/ui based)
  config/           Shared tsconfig
```

## Conventions

- Prefer React Server Components; add `"use client"` only where interactivity requires it.
- Business logic lives in `packages/api`, not in React components or route files.
- Validate all environment variables at startup with Zod. Keep `.env.example` up to date whenever a new variable is added. Never commit secrets.
- Database changes always go through Drizzle migrations; never edit the database by hand.
- **Ratings:** 0 to 10 in 0.25 steps. Store as an integer 0 to 40 (quarter points); convert only for display (`formatRating`). A rating or review is about a whole title or one episode; `packages/api/src/targets.ts` defines that choice.
- **Media model:** one shared `media` concept with a `type` (movie, tv, game, book) plus type-specific detail tables. TV has seasons and episodes as first-class records so episodes can be rated/reviewed.
- **Franchise links are typed edges** (adaptation_of, sequel_of, same_franchise) between any two media items. A link is only visible in the app once it is verified: `media_links` holds verified links and nothing else, and suggestions from Wikidata wait in `link_suggestions` until a reviewer approves them. Never show a suggestion outside the review page.
- **Reviewers** are the people whose sign-in emails are in `ADMIN_EMAILS`. Anything only they may do uses `adminProcedure`, and its pages answer "not found" to everyone else.
- **Privacy:** reviews, lists, and libraries carry an explicit visibility: public (the default), friends, or private. Every query that returns user content must respect it, using the helpers in `packages/api/src/visibility.ts`. Add tests for visibility rules.
- **Library statuses:** want, in_progress, finished, dropped.
- **Names shown to others:** credit user content to the username in `profiles`, never to `users.name` or an email address. A person without a username is shown as "A Yousiverse member" (`MemberName`). Profiles live at `/u/<username>`.
- **Following:** anyone can follow anyone who has a username, with no approval. Two people who follow each other are friends. Who follows whom is public.
- **Imports** never overwrite: an existing library entry, rating, or review is kept. A row is added only when it matches one title with confidence; otherwise it is reported as not found. Rows are matched a few per request, driven by the open import page, so no request runs long.
- **Clubs:** each club has an allowlist of media types; club views and queries must filter to it. An invite-only club answers "not found" to anyone who is not a member and does not hold its invite code. Everything inside a club (picks, discussions) goes through `requireVisibleClub` to read and `requireMembership` to write.
- **Email** always goes through `sendEmail` in `packages/email`, which records each one and enforces the limits (three sign-in links to an address in 15 minutes; 95 emails a day, of which alerts may use 60). Build the message with `renderEmail`, which escapes everything it is given. Outside production nothing is emailed: sign-in links are printed to the terminal.
- **Background jobs** are plain functions in `packages/api` that take a step runner (see `alerts/check.ts`), wrapped by a thin Inngest function in `jobs.ts`, so they can be tested without Inngest. Keep each step short, give it a name that is the same on every replay, and return only counts and catalog ids from it: Inngest stores what steps return, so nothing about a person may go there.
- **Calendar dates** are US calendar days (`usToday` in `packages/api/src/calendar/dates.ts`), never the server's own date. The daily calendar job refreshes only titles in someone's library whose dates could still change, within `TITLES_PER_RUN`.
- **Alerts** fire once. The daily job is the only thing that spends provider requests on titles nobody opened, and it keeps to a daily budget (`STREAMING_REFRESHES_PER_RUN`); never add another path that refreshes availability in bulk.
- UI follows the design system below. Support night and day and keyboard navigation from the start.
- Write or update tests with every feature. Use Playwright for critical user flows (sign-in, adding to library, rating, reviewing).

### Design system

Seven rules hold everywhere:

1. **The interface is monochrome; the artwork is the light.** Buttons, text, and surfaces are ink and ivory. Color comes from titles and from one hue per medium (`--movie`, `--tv`, `--game`, `--book`).
2. **Every medium keeps its shape**, at every size: a movie is a 2:3 poster, a show is a 16:9 screen with its name set over it, a game is a 3:4 case, a book is a book with a spine.
3. **One lead per page.** If two things compete, one moves down.
4. **Serif for stories, sans for the interface, mono for measurements**: Fraunces (`--display`) for titles and big numbers, Hanken Grotesk (`--sans`) for what you operate, Geist Mono (`--mono`) for prices, dates, and counts.
5. **Rings mean a rating or progress** (`Meter`, `Score`, `Average`). Nothing else is a ring.
6. **Night first, day equal.** Night is the default; day is designed, not inverted. Check both.
7. **Nothing is only color.** A medium has a shape and an icon; a state has a word.

How it is built:

- **Styles** are component classes in `packages/ui/src/styles/design.css` (`.btn`, `.card`, `.row`, `.hero`, `.panel`, `.dial`, `.offers`, `.tile` ...), with tokens in `globals.css` and page-specific additions in `styles/parts/*.css`. Use those classes; reach for Tailwind utilities only for one-off layout (`min-w-0`, `mt-4`, `sr-only`). Never hard-code a color: use the tokens (`var(--fg)`, `--fg-2`, `--fg-3`, `--surface`, `--line`, `--good`, `--warn`).
- **A page** is `<div className="page">` (or `page page--narrow`) directly inside the layout's `<main>`, with at most one `<Ambient src>` as its sibling for the blurred-artwork glow. Title pages are a `.hero` followed by a `.tgrid`.
- **Tone:** a page or part takes a title's color with `className="toned"` and `style={toneStyle(title)}` (`lib/titles.ts`). `.night` keeps a part dark in day mode (artwork with type over it).
- **Titles** are drawn with `Artwork`, `Thumb`, `TitleCard`, `Shelf`, `Wall`, and `TitleRow` (`components/media`). Queries that return titles select `titleSummary` (`packages/api/src/titles.ts`), which carries what those need. `getMarks` (`lib/marks.ts`) gives the viewer's status and rating for a set of titles.
- **Parts:** `Icon` (the app's own icon set), `Avatar`, `PageHeader`, `SectionHead`, `Crumb`, `LinkTabs`, `LinkSegmented`, `Ambient`, `VisibilityChip`, `toast()` in `components/ui`; `Medium`, `Score`, `Average`, `Meter`, `ServiceMark` in `components/media`; `Button`, `Input`, `Textarea`, `Label`, `Switch`, `Dialog`, `DropdownMenu` in `packages/ui`. A streaming service or store is always shown with its `ServiceMark`.
- **Filters are links** (`LinkTabs`, `LinkSegmented`), so every view has its own address. Buttons are for things that change data.
- **Loading:** a page that redirects (sign-in) or can answer "not found" has no `loading.tsx`, because a route-level one starts the response before the page can do either. It checks first, then wraps the rest in `<Suspense>` with its skeleton from `components/states/page-skeletons.tsx`. Title routes have none at all: the artwork a person clicked grows into the page's poster (`Artwork` with `arrives`), which only works when the page arrives in one piece.
- **Anything that scrolls sideways is `position: relative`.** Hidden text for screen readers inside it (`sr-only`) is absolutely positioned, and otherwise escapes the scroller and widens the page on a phone.
- **Words:** the place for franchises is "Youniverses" (`/youniverses`); one of them is "a universe". A finished movie is "Watched", a finished book is "Read" (`statusLabel`).

### Database schema

- Write columns in camelCase and let Drizzle's `casing: "snake_case"` name them; never pass a column name by hand. Tables are plural snake_case.
- Primary keys are `uuid().primaryKey().defaultRandom()`. A detail table (`movies`, `tv_shows`) uses its parent's id as its primary key.
- Every foreign key states its `onDelete`.
- Timestamps use `timestamp({ withTimezone: true })`; calendar dates with no time use `date()`.
- A fixed set of values is a `pgEnum` built from an exported `as const` array, so the type and the database agree.
- Rules about uniqueness are database constraints, not only checks in code.
- Use `text`, not `varchar`. Store quantities as integers in their smallest unit (minutes, quarter points), never floats.

### Errors

- `packages/integrations` throws only `ProviderError`, with a `kind` (`not_found`, `rate_limited`, `unavailable`, `invalid_response`). Its messages must never include credentials or full provider URLs.
- `packages/api` throws `TRPCError` with an accurate code. `publicProcedure` already converts a `ProviderError` into the matching code, so routers do not catch provider errors just to rethrow them.
- A page built around one record wraps its query in `orNotFound` (`apps/web/src/trpc/server.ts`). Anything else reaches the nearest `error.tsx`.
- Never swallow an error. When the app carries on with less (an out-of-date copy, search missing one provider), log the cause and tell the user what is missing.
- Messages shown to users say what happened and what to do next, in plain words. Never show a provider's raw error text.

### Provider data

- **Fetch on demand.** Search goes straight to the provider. An item is saved to Postgres the first time someone opens its page, and that stored copy is what the app reads from then on. Do not bulk-import provider catalogs.
- **Refresh:** a stored item older than 7 days is fetched again the next time it is opened. If the provider is down, serve the stored copy.
- **Updates happen in place.** A refresh never deletes seasons or episodes, because ratings and reviews attach to them.
- **URLs** use the provider's id: `/movies/<id>`, `/tv/<id>`, `/games/<id>`, `/books/<id>`. Seasons and episodes go by number under their show: `/tv/<id>/seasons/<n>/episodes/<n>`.
- **Tests never call a provider.** With `PROVIDER_FIXTURES=true` (set by the Vitest and Playwright configs), requests are answered from recorded responses in `packages/integrations/src/fixtures`. To cover a new request, add it to `packages/integrations/scripts/record.ts` and run the `record` script.
- **Availability and prices** (Watchmode for movies and TV, IsThereAnyDeal for PC games) are fetched the first time a title's page asks for them and kept for 7 days, like catalog data. Watchmode allows 2,500 requests a month, so never fetch offers for titles nobody opened. Prices are stored in cents.
- **Similar titles** (TMDB recommendations, IGDB similar games, an author's other books from Open Library) are fetched for a title the first time a recommendation needs them and kept for 30 days in `similar_titles`. They are stored as the provider described them, not as `media` rows, so suggesting a title does not add it to the catalog.
- **Wikidata's query service is slow and fails now and then.** Ask it about one title per request, give it a longer timeout, and let the caller retry. Its data is public domain (CC0) and only ever feeds suggestions, so it needs no footer credit.
- **Attribution:** every provider whose data is shown is credited in the site footer, in the wording its terms require.

## Source control

- **`main` is always deployable.** Never commit to it directly; every change goes through a pull request.
- **Branches:** one short-lived branch per change, cut from an up-to-date `main`, named `<type>/<short-description>` (e.g. `feat/library-status`, `fix/sign-in-redirect`). Delete the branch after merging.
- **Commits:** Conventional Commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`), with an optional scope for the package or app (`feat(api): ...`). Imperative summary under ~70 characters; use the body for the why.
- **Pull requests:** one logical change each, small enough to review in one sitting. The title follows Conventional Commits because it becomes the commit on `main`. The description says what changed, why, and how it was verified.
- **Merging:** squash and merge once CI is green, so `main` has one commit per PR. Never merge with failing checks.
- **Keeping up to date:** rebase a branch on `main` rather than merging `main` into it. Force-push only to your own unmerged branch, with `--force-with-lease`; never to `main`.
- **Database migrations:** one PR should not edit a migration that has already merged. Add a new one.
- **Never commit** secrets, `.env` files, build output, or local tool settings.

## Commands

Use `bun` for everything (`bun install`, `bun run <script>`, `bunx`); never npm, pnpm, or yarn. Use Vitest for tests, not `bun test`. Local Postgres runs in Docker (OrbStack).

Run everything from the repo root. All scripts read the root `.env` (copy `.env.example`).

| Command                                      | What it does                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `bun install`                                | Install all workspace dependencies                                                       |
| `bun dev`                                    | Start the web app at http://localhost:3000                                               |
| `bun run build`                              | Production build                                                                         |
| `bun run lint`                               | Biome lint + format check                                                                |
| `bun run format`                             | Biome auto-fix and format                                                                |
| `bun run typecheck`                          | TypeScript in every package                                                              |
| `bun run test`                               | Vitest. API tests run against a throwaway `<database>_test` database, recreated each run |
| `bun run e2e`                                | Playwright. Starts its own dev server on port 3000, so stop `bun dev` first              |
| `bun run db:up` / `bun run db:down`          | Start / stop local Postgres (Docker)                                                     |
| `bun run db:generate`                        | Generate a migration from schema changes in `packages/db/src/schema`                     |
| `bun run db:migrate`                         | Apply migrations                                                                         |
| `bun run db:seed`                            | Add starter titles; safe to run again. Details load from the provider when a page opens  |
| `bun run db:studio`                          | Open Drizzle Studio                                                                      |
| `bun run --cwd packages/integrations record` | Re-record the provider responses used by tests (needs real API keys in `.env`)           |

- Run one package's script with `bun run --cwd packages/api test`.
- Add shadcn/ui components from `packages/ui`: `bunx shadcn@latest add <component>`.
- Deploys run `bun run vercel-build` (migrate, then build) via `apps/web/vercel.json`.
- Biome is configured in the root `biome.json` (Biome allows only one root config).
