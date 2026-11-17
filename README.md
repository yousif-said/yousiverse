# Yousiverse

Your movies, shows, games, and books on one shelf. See [PRODUCT.md](PRODUCT.md) for what is built and what is planned, and [CLAUDE.md](CLAUDE.md) for the stack and conventions.

## Local setup

You need [Bun](https://bun.sh) 1.4+, Node 22+, Docker (OrbStack works), a free [TMDB API key](https://www.themoviedb.org/settings/api) for movie and TV data, a free [Twitch developer app](https://dev.twitch.tv/console) for game data (IGDB uses Twitch credentials), a free [Watchmode API key](https://api.watchmode.com) for where-to-watch data, a free [IsThereAnyDeal API key](https://isthereanydeal.com/apps/my/) for PC game prices, a free [Steam Web API key](https://steamcommunity.com/dev/apikey) for importing Steam libraries, and a free [Trakt app](https://trakt.tv/oauth/applications) for importing Trakt histories (only its Client ID is used). Book data comes from Open Library, which needs no key.

```sh
bun install
cp .env.example .env        # then set BETTER_AUTH_SECRET (openssl rand -base64 32) and the provider keys
bun run db:up               # start Postgres in Docker
bun run db:migrate          # apply migrations
bun run db:seed             # add starter titles to the home page shelf
bun dev                     # http://localhost:3000
```

To sign in locally, enter any email on the sign-in page. The sign-in link prints in the terminal running `bun dev`; open it in the browser. Google sign-in appears once its credentials are set in `.env`.

## Checks

```sh
bun run lint                # Biome
bun run typecheck
bun run test                # Vitest; uses a separate <database>_test database
bun run e2e                 # Playwright; stop `bun dev` first, it starts its own server on port 3000
```

Tests never call TMDB, IGDB, Open Library, Watchmode, IsThereAnyDeal, Steam, or Trakt: they replay recorded responses, so they need no API keys.

The first time, install the Playwright browser: `cd apps/web && bunx playwright install chromium`.

A test that passes here can still fail on CI, whose machines are slower. To see how the browser tests behave there, slow the test browser down: `E2E_CPU_SLOWDOWN=8 bun run e2e`.

## Deploying

Vercel project settings: set the root directory to `apps/web`. The build command in `apps/web/vercel.json` applies database migrations and then builds, so a failed migration stops the deploy before it serves traffic.

Environment variables on Vercel:

- `DATABASE_URL` and `DATABASE_URL_UNPOOLED`: set by Neon's Vercel integration (one database branch per preview).
- `BETTER_AUTH_SECRET`: all environments.
- `TMDB_API_TOKEN`, `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`, `WATCHMODE_API_KEY`, `ITAD_API_KEY`, `STEAM_API_KEY`, `TRAKT_CLIENT_ID`, `RESEND_API_KEY`, `EMAIL_FROM`: all environments.
- `BETTER_AUTH_URL`: production only, set to the public origin. Previews fall back to their own deploy URL.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: optional.
- `ADMIN_EMAILS`: optional. The sign-in emails, separated by commas, of the people who review franchise links at `/admin/links`.
- `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`: set by Inngest's Vercel integration. Without the signing key the job address `/api/inngest` refuses every request, so no background job runs.

Sign-in links are emailed through Resend in production and previews. Everywhere else they are printed in the server terminal and no email is sent.

## Background jobs

Jobs run on [Inngest](https://www.inngest.com), which calls the app at `/api/inngest`. The one job so far checks alerts every morning at 9, US Eastern time. In production Inngest finds the app through its Vercel integration.

To run a job locally, start `bun dev`, start the Inngest dev server (`inngest-cli dev -u http://localhost:3000/api/inngest`, see Inngest's docs for installing it), and invoke the function from its page at http://localhost:8288. Emails a job would send are printed in the `bun dev` terminal instead.
