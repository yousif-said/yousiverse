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
| Auth                      | Better Auth (Google, email magic link; Apple later) stored in our own Postgres        |
| Lint / format             | Biome                                                                                 |
| Tests                     | Vitest (unit/integration), Playwright (end-to-end)                                    |
| CI                        | GitHub Actions: typecheck, lint, test on every PR                                     |
| Hosting                   | Vercel (preview deploy per PR)                                                        |

### Planned additions (add only when the first feature that needs them is built)

| Tool                 | Add when                                                                                |
| -------------------- | --------------------------------------------------------------------------------------- |
| Inngest              | Background jobs: imports, price/availability checks, alerts, release calendar ingestion |
| Resend + React Email | First feature that sends email (alerts, club invites)                                   |
| Upstash Redis        | Rate limiting, or caching external API calls beyond what Next.js caching handles        |
| Sentry, PostHog      | Shortly before launching to real users                                                  |
| Expo (Expo Router)   | Mobile app, added as `apps/mobile`, reusing `packages/api` and shared validation        |
| Hono                 | Only if the API ever needs to run outside Next.js                                       |

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

- **Pull requests:** GitHub Actions runs typecheck, Biome lint, Vitest, and Playwright on every PR. All must pass before merging. GitHub does not enforce this on the current plan, so check before merging.
- **Preview deploys:** Vercel builds every PR to its own preview URL. Each preview uses its own Neon database branch (Neon's Vercel integration), never the production database.
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
  integrations/     External API clients (tmdb, igdb, books, watchmode, itad, wikidata)
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
- **Franchise links are typed edges** (e.g. adaptation_of, same_franchise, sequel_of) between any two media items. A link is only visible in the app once it is verified. Suggested links from Wikidata or elsewhere stay hidden until reviewed.
- **Privacy:** reviews, lists, and libraries carry an explicit visibility, public by default (public or private today; friends is added with the social features). Every query that returns user content must respect it. Add tests for visibility rules.
- **Library statuses:** want, in_progress, finished, dropped.
- **Names shown to others:** credit user content to the username in `profiles`, never to `users.name` or an email address. A person without a username is shown as "A Yousiverse member" (`MemberName`). Profiles live at `/u/<username>`.
- **Clubs:** each club has an allowlist of media types; club views and queries must filter to it.
- UI should feel fast, clean, and modern. Use the frontend-design plugin for new screens. Support light and dark mode and keyboard navigation from the start.
- Write or update tests with every feature. Use Playwright for critical user flows (sign-in, adding to library, rating, reviewing).

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
- **Availability and prices** (Watchmode) are fetched the first time a title's page asks for them and kept for 7 days, like catalog data. Watchmode allows 2,500 requests a month, so never fetch offers for titles nobody opened. Prices are stored in cents.
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
