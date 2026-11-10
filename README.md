# Yousiverse

Your movies, shows, games, and books on one shelf. See [PRODUCT.md](PRODUCT.md) for what is built and what is planned, and [CLAUDE.md](CLAUDE.md) for the stack and conventions.

## Local setup

You need [Bun](https://bun.sh) 1.4+, Node 22+, and Docker (OrbStack works). No external accounts are required.

```sh
bun install
cp .env.example .env        # then set BETTER_AUTH_SECRET: openssl rand -base64 32
bun run db:up               # start Postgres in Docker
bun run db:migrate          # apply migrations
bun run db:seed             # add sample titles
bun dev                     # http://localhost:3000
```

To sign in locally, enter any email on the sign-in page. The sign-in link prints in the terminal running `bun dev`; open it in the browser. Google and Apple sign-in appear once their credentials are set in `.env`.

## Checks

```sh
bun run lint                # Biome
bun run typecheck
bun run test                # Vitest; uses a separate <database>_test database
bun run e2e                 # Playwright; stop `bun dev` first, it starts its own server on port 3000
```

The first time, install the Playwright browser: `cd apps/web && bunx playwright install chromium`.

## Deploying

Vercel project settings: set the root directory to `apps/web`. The build command in `apps/web/vercel.json` applies database migrations and then builds, so a failed migration stops the deploy before it serves traffic.

Environment variables on Vercel:

- `DATABASE_URL` and `DATABASE_URL_UNPOOLED`: set by Neon's Vercel integration (one database branch per preview).
- `BETTER_AUTH_SECRET`: all environments.
- `BETTER_AUTH_URL`: production only, set to the public origin. Previews fall back to their own deploy URL.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`: optional.

Email sign-in is development-only until an email provider is added, so a deploy needs Google or Apple configured for anyone to sign in.
