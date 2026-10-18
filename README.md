# Web Starter

A Next.js starter with Postgres, Prisma, email and password accounts, organizations with roles, and invitations.

Everything runs in Docker, in development too: the app, the database, migrations, Prisma commands, type checks and lint. The only thing you need on your machine is Docker, so everyone runs the same Node.js and the same dependencies.

## Starting a project from this template

Do these once, right after copying the template.

1. **Install Docker** (Docker Desktop, or Docker Engine with the Compose plugin). You don't need Node.js or npm on your machine.
2. **Create your `.env`:**

   ```bash
   cp .env.template .env
   ```

   Then edit it:
   - `DB_PASSWORD`: replace `change-me`.
   - `PORT` and `NEXT_PUBLIC_APP_URL`: change both together if port 3000 is taken. `NEXT_PUBLIC_APP_URL` is the address invitation links point to, so it must be the address people open.
   - `DB_PORT`: the port Postgres is published on, for database tools on your machine. Change it if something else already uses 5432 (such as a local Postgres).
   - `DB_NAME`, `DB_USER`: optionally rename to your project.
3. **Rename the project.** These still say `web-starter` or the create-next-app defaults:
   - `name` in `package.json`.
   - The `image:` names in `docker-compose.yml` (`web-starter`, `web-starter-migrate`) and `docker-compose.override.yml` (`web-starter-dev`). Two projects with the same image names overwrite each other's images.
   - `title` and `description` in `metadata` in `app/layout.tsx` (currently "Create Next App").
   - The heading of this README, and `app/favicon.ico`.
4. **Start it:**

   ```bash
   docker compose up --build -V
   ```

   The first start builds the images, installs dependencies inside them, creates the database and applies all migrations. Open the `NEXT_PUBLIC_APP_URL` address (http://localhost:3000 by default) and sign up: the first account creates the first organization and owns it.

## How the Docker setup works

- `docker-compose.yml` is the production setup: the `db` service, a one-off `migrate` service that runs `prisma migrate deploy` and exits, and the `web` app, which starts only after `migrate` succeeds.
- `docker-compose.override.yml` turns it into the development setup. Docker Compose loads it automatically, so a plain `docker compose ...` command is always development: `web` runs `next dev` with your source folder mounted for hot reload. It also defines `studio`, which only starts when you ask for it.
- `node_modules` lives inside the container, not in your folder, so it always matches the container's Linux and Node.js versions.

## Everyday commands

Run these from the project folder.

```bash
docker compose up --build -V          # start app + database with hot reload (Ctrl+C to stop)
docker compose down                   # remove the containers (data is kept)
docker compose down -v                # remove the containers and all data (fresh database)

docker compose exec web npm run typecheck   # type check
docker compose exec web npm run lint        # lint
docker compose up studio                    # Prisma Studio at http://localhost:5555

docker compose -f docker-compose.yml up --build   # run the production build locally
```

`--build` rebuilds the image when the Dockerfile or dependencies changed, and `-V` gives the container a fresh `node_modules` from that image; both are quick when nothing changed. `exec` commands need the app running (`docker compose up` in another terminal). In Prisma Studio, pick the `app` schema (or your `DB_SCHEMA`) at the top left.

If you do have Node.js installed, the same commands exist as npm scripts (`npm run dev`, `npm run dev:down`, `npm run db:migrate`, `npm run db:studio`), which call Docker for you.

Edits under `app/`, `components/` and `lib/` reload automatically. You need to do something yourself in these cases:

- **Adding a dependency:** `docker compose exec web npm install <package>` (add `-D` for a dev dependency). It updates `package.json` and `package-lock.json` in your folder and installs it in the running container; commit both files. Everyone else gets it on their next `docker compose up --build -V`.
- **After pulling changes to dependencies:** `docker compose up --build -V`.
- **After changing `NEXT_PUBLIC_*` variables:** restart, and rebuild for production: they're baked in at build time.
- **After adding or changing `instrumentation.ts`:** restart; it's only loaded at startup.
- **After editing `prisma/schema.prisma`:** create a migration (see below), then commit the new folder under `prisma/migrations`. Everyone else gets it applied automatically on their next start.

**On Linux:** the dev container runs as root, so files it creates in your folder (new migrations, `package-lock.json`, `lib/generated`) end up owned by root. Take them back with `sudo chown -R "$USER": .` when your editor can't save them. Docker Desktop on macOS and Windows maps ownership for you.

**Editor support:** your editor's TypeScript features need `node_modules` in the folder. Either open the project in the container with VS Code's Dev Containers extension ("Attach to Running Container", folder `/app`), or, if you have Node.js, run `npm install` on your machine for the editor only. Running the app still happens in Docker either way.

## Before going to production

- **Run only the base file:** `docker compose -f docker-compose.yml up -d --build`. Without `-f`, Compose also loads the development override.
- **Build with the real address:** set `NEXT_PUBLIC_APP_URL` to the public URL before building the image.
- **Use HTTPS:** in production the session cookie is `Secure`, so logging in only works over HTTPS (browsers make an exception for `localhost`).
- **Put a reverse proxy in front** that sets `X-Forwarded-For` and strips any value the client sent. Rate limits and session IPs use it, and without such a proxy clients can fake their IP.
- **Use a strong `DB_PASSWORD`**, and don't publish the database port publicly (remove `ports:` from the `db` service if nothing outside Docker needs it).
- **Connect an email provider** in `lib/mailer.ts` if you want invitations emailed. Until then, people share invitation links themselves.
- **Back up the `db-data` volume.** `docker compose down -v` deletes it.

## Database with Prisma

Prisma connects with the same `DB_*` variables from `.env` (see `prisma.config.ts`), so there is no separate `DATABASE_URL`. Models go in `prisma/schema.prisma`; the app uses them through `getPrisma()` from `lib/prisma.ts`, which runs on the same `pg` pool as `query()`.

With the app running:

```bash
# Create and apply a migration after editing the schema. It asks for a name.
docker compose exec web sh -c "npx prisma migrate dev && npx prisma generate"

# Regenerate the client into lib/generated/prisma (also done on every start).
docker compose exec web npx prisma generate
```

Committed migrations are applied automatically by the `migrate` service on every start, in development and production. The Postgres schema named by `DB_SCHEMA` is created the first time the database volume is initialised.

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
