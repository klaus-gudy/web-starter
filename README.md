This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

The app and its Postgres database run in Docker, in development too. You need Docker and a `.env`:

```bash
cp .env.template .env
```

Then start the development server (Next.js dev server + Postgres, with hot reload):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. Edits under `app/`, `components/` and `lib/` reload automatically. Stop with Ctrl+C, or remove the containers with `npm run dev:down`.

After changing dependencies, run `npm install` and then `npm run dev` again: it rebuilds the image and refreshes the container's `node_modules`.

To run the production build instead:

```bash
docker compose up --build
```

Database settings (`DB_*`, including `DB_SCHEMA`) come from `.env`. The Postgres schema is created the first time the database volume is initialised; `docker compose down -v` resets it, deleting all data.

Both commands start a one-off `migrate` service first, which runs `prisma migrate deploy`; the app starts only after it succeeds. A fresh clone therefore gets its tables on the first start, and a deploy applies new migrations before the new app version runs.

## Database with Prisma

Prisma connects with the same `DB_*` variables from `.env` (see `prisma.config.ts`), so there is no separate `DATABASE_URL`. Models go in `prisma/schema.prisma`; the app uses them through `getPrisma()` from `lib/prisma.ts`, which runs on the same `pg` pool as `query()`.

```bash
npm run db:migrate    # create and apply a migration after editing the schema
npm run db:generate   # regenerate the client into lib/generated/prisma
npm run db:studio     # browse data at http://localhost:5555
```

These run on your machine against the database container, so start it first (`npm run dev`, or `docker compose up -d db`). `db:migrate` is for authoring migrations; committed migrations are applied automatically on the next start. The dev container regenerates the client every time it starts.

## Authentication and tenancy

Sign-up has two steps: first an organization name, checked against existing organizations (names are unique, ignoring case), then name, email and password. It creates the user, the organization and their owner membership in one transaction, then signs them in. An email that already has an account can still sign up with that account's password to create an organization, unless it already owns one. From an invitation link there is no organization step: signing up (or entering an existing account's password) accepts the invitation and gives the invited role. Sessions live in the `sessions` table; the `session` cookie holds a random token whose SHA-256 hash is stored, and passwords are hashed with scrypt (`lib/password.ts`).

- In components, call `getCurrentUser()` from `lib/auth.ts` behind a `<Suspense>` boundary. It returns the user and their active organization, or redirects to `/login`.
- In server actions, authorize with `readSession()` from `lib/session.ts`.
- `proxy.ts` only checks that the cookie exists, sending visitors without one to `/login`.
- For what the user may do in their active organization, call `readActiveMember()` from `lib/membership.ts` and check `permissions.has("members.invite")` and the like.

Members are managed at `/members`, which lists only the active organization's members: invite by email with a role, change roles, remove members or leave. An organization always keeps at least one owner. Inviting creates a link (`/invite/<token>`) that is copied for you to send yourself; no email goes out yet (`lib/mailer.ts` is a stub for when you connect a provider). Links work once and expire after 7 days. The sidebar's organization menu switches between the organizations you belong to; the user menu in the footer holds log out.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
