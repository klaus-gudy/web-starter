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

Database settings (`DB_*`, including `DB_SCHEMA`) come from `.env`. The schema is created the first time the database volume is initialised; `docker compose down -v` resets it, deleting all data.

## Database with Prisma

Prisma connects with the same `DB_*` variables from `.env` (see `prisma.config.ts`), so there is no separate `DATABASE_URL`. Models go in `prisma/schema.prisma`; the app uses them through `getPrisma()` from `lib/prisma.ts`, which runs on the same `pg` pool as `query()`.

```bash
npm run db:migrate    # create and apply a migration after editing the schema
npm run db:generate   # regenerate the client into lib/generated/prisma
npm run db:studio     # browse data at http://localhost:5555
```

These run on your machine against the database container, so start it first (`npm run dev`, or `docker compose up -d db`). The dev container regenerates the client every time it starts.

## Authentication and tenancy

Sign-up creates the user, a personal organization and an owner membership in one transaction, then signs them in. Sessions live in the `sessions` table; the `session` cookie holds a random token whose SHA-256 hash is stored, and passwords are hashed with scrypt (`lib/password.ts`).

- In components, call `getCurrentUser()` from `lib/auth.ts` behind a `<Suspense>` boundary. It returns the user and their active organization, or redirects to `/login`.
- In server actions, authorize with `readSession()` from `lib/session.ts`.
- `proxy.ts` only checks that the cookie exists, sending visitors without one to `/login`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
