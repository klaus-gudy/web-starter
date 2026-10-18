# Web Starter

A Next.js starter with Postgres, Prisma, email and password accounts, organizations with roles, and invitations. The app and its database run in Docker, in development too.

## Starting a project from this template

Do these once, right after copying the template.

1. **Install the tools:** Docker, and Node.js 24 with npm. Docker runs the app; Node is only needed on your machine for the Prisma commands (`npm run db:*`) and your editor.
2. **Install dependencies on your machine:**

   ```bash
   npm install
   ```

3. **Create your `.env`:**

   ```bash
   cp .env.template .env
   ```

   Then edit it:
   - `DB_PASSWORD`: replace `change-me`.
   - `DB_PORT`: the port Postgres is published on for your machine. Change it if something else already uses 5432 (such as a local Postgres).
   - `PORT` and `NEXT_PUBLIC_APP_URL`: change both together if port 3000 is taken. `NEXT_PUBLIC_APP_URL` is the address invitation links point to, so it must be the address people open.
   - `DB_NAME`, `DB_USER`: optionally rename to your project.
4. **Rename the project.** These still say `web-starter` or the create-next-app defaults:
   - `name` in `package.json`.
   - The `image:` names in `docker-compose.yml` (`web-starter`, `web-starter-migrate`) and `docker-compose.dev.yml` (`web-starter-dev`). Two projects with the same image names overwrite each other's images.
   - `title` and `description` in `metadata` in `app/layout.tsx` (currently "Create Next App").
   - The heading of this README, and `app/favicon.ico`.
5. **Start it:**

   ```bash
   npm run dev
   ```

   The first start builds the images, creates the database, and applies all migrations; nothing else needs to run. Open the `NEXT_PUBLIC_APP_URL` address (http://localhost:3000 by default) and sign up: the first account creates the first organization and owns it.

## Everyday commands

```bash
npm run dev            # app + Postgres with hot reload; Ctrl+C to stop
npm run dev:down       # remove the dev containers (data is kept)
docker compose up --build   # run the production build locally
docker compose down -v      # delete the containers and all data (fresh database)
```

Edits under `app/`, `components/` and `lib/` reload automatically. You need to do something yourself in these cases:

- **After changing dependencies:** run `npm install`, then `npm run dev` again. It rebuilds the image and refreshes the container's `node_modules`.
- **After changing `NEXT_PUBLIC_*` variables:** restart, and rebuild for production (`docker compose up --build`): they're baked in at build time.
- **After adding or changing `instrumentation.ts`:** restart `npm run dev`; it's only loaded at startup.
- **After editing `prisma/schema.prisma`:** with the app running, run `npm run db:migrate` in your own terminal (it asks for a migration name, so it needs an interactive terminal), then commit the new folder under `prisma/migrations`. Everyone else gets it applied automatically on their next start.

Database settings (`DB_*`, including `DB_SCHEMA`) come from `.env`. The Postgres schema named by `DB_SCHEMA` is created the first time the database volume is initialised. Both `npm run dev` and `docker compose up` start a one-off `migrate` service first, which runs `prisma migrate deploy`; the app starts only after it succeeds.

## Before going to production

- **Build with the real address:** set `NEXT_PUBLIC_APP_URL` to the public URL before building the image.
- **Use HTTPS:** in production the session cookie is `Secure`, so logging in only works over HTTPS (browsers make an exception for `localhost`).
- **Put a reverse proxy in front** that sets `X-Forwarded-For` and strips any value the client sent. Rate limits and session IPs use it, and without such a proxy clients can fake their IP.
- **Use a strong `DB_PASSWORD`**, and don't publish the database port publicly (remove `ports:` from the `db` service if nothing outside Docker needs it).
- **Connect an email provider** in `lib/mailer.ts` if you want invitations emailed. Until then, people share invitation links themselves.
- **Back up the `db-data` volume.** `docker compose down -v` deletes it.

## Database with Prisma

Prisma connects with the same `DB_*` variables from `.env` (see `prisma.config.ts`), so there is no separate `DATABASE_URL`. Models go in `prisma/schema.prisma`; the app uses them through `getPrisma()` from `lib/prisma.ts`, which runs on the same `pg` pool as `query()`.

```bash
npm run db:migrate    # create and apply a migration after editing the schema (interactive)
npm run db:generate   # regenerate the client into lib/generated/prisma
npm run db:studio     # browse data at http://localhost:5555
```

These run on your machine against the database container, so start it first (`npm run dev`, or `docker compose up -d db`). `db:migrate` is for authoring migrations; committed migrations are applied automatically on the next start. The dev container regenerates the client every time it starts.

## Authentication and tenancy

Sign-up has two steps: first an organization name, checked against existing organizations (names are unique, ignoring case), then name, email and password. It creates the user, the organization and their owner membership in one transaction, then signs them in. An email that already has an account can still sign up with that account's password to create an organization, unless it already owns one. From an invitation link there is no organization step: signing up (or entering an existing account's password) accepts the invitation and gives the invited role. Sessions live in the `sessions` table; the `session` cookie holds a random token whose SHA-256 hash is stored, and passwords are hashed with scrypt (`lib/password.ts`).

- In components, call `getCurrentUser()` from `lib/auth.ts` behind a `<Suspense>` boundary. It returns the user and their active organization, or redirects to `/login`.
- In server actions, authorize with `readSession()` from `lib/session.ts`.
- `proxy.ts` only checks that the cookie exists, sending visitors without one to `/login`. Signed-in visitors who open `/login` or `/sign-up` are sent on to the dashboard (or their `?next=` path) after the session is checked in the database.
- For what the user may do in their active organization, call `readActiveMember()` from `lib/membership.ts` and check `permissions.has("members.invite")` and the like.

Members are managed at `/members`, which lists only the active organization's members: invite by email with a role, change roles, remove members or leave. An organization always keeps at least one owner. Inviting creates a link (`/invite/<token>`) that is copied for you to send yourself; no email goes out yet (`lib/mailer.ts` is a stub for when you connect a provider). Links work once and expire after 7 days. The sidebar's organization menu switches between the organizations you belong to; the user menu in the footer holds log out.

### Rate limits

Login, sign-up and the organization name check are rate-limited (`lib/rate-limit.ts`), with counters in the `rate_limits` table so limits hold across restarts and instances. Limits are per IP address, and password checks are also limited per email across login and sign-up. The numbers live in `LIMITS` in `app/(auth)/actions.ts`. The IP comes from `X-Forwarded-For`: in production, run behind a proxy that sets it and strips any value sent by the client.

### Cleanup

Each server process runs `cleanUpExpired()` (`lib/cleanup.ts`) a minute after it starts and then hourly, from `instrumentation.ts`. It deletes expired sessions, rate-limit counters and verification tokens, and marks pending invitations past their expiry as `expired`. Running several instances is fine: every step is idempotent.

### Errors

`app/(core)/error.tsx` handles errors in signed-in pages and keeps the sidebar; `app/error.tsx` covers the rest; `app/global-error.tsx` replaces the root layout if it fails; `app/not-found.tsx` is the 404 page for unknown URLs and `notFound()`.
