<img src="assets/brand/icon.png" width="64" height="64" alt="">

# Dispensario Santísima Trinidad

Next.js 16 (App Router, Cache Components) · Supabase (Postgres + Auth) · Vercel · Tailwind CSS 4 · pnpm

## Getting started

```bash
pnpm install
cp .env.example .env.local      # or: vercel env pull .env.local
pnpm dev                        # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` / `pnpm typecheck` | ESLint / route typegen + `tsc` |
| `pnpm db:new <name>` | New SQL migration in `supabase/migrations/` |
| `pnpm db:push` | Apply pending migrations to the linked Supabase project |
| `pnpm db:types` | Regenerate `src/lib/supabase/database.types.ts` |

The `db:*` scripts use the Supabase CLI. Run `supabase login` and `supabase link --project-ref xnbinvflvurdpvbctxfh` once first.

## Layout

```
src/
  proxy.ts                    # Next 16 "middleware": refreshes the Supabase session, optimistic redirects
  lib/
    env.ts                    # validated public env vars
    auth.ts                   # data access layer: getCurrentUser / requireUser / getCurrentProfile
    safe-redirect.ts          # ?next= open-redirect guard
    supabase/
      client.ts               # browser client (Client Components)
      server.ts               # server client (Server Components, Actions, Route Handlers)
      proxy.ts                # session refresh used by src/proxy.ts
      database.types.ts       # generated types
  app/
    (auth)/login/             # email + password sign-in / sign-up (Server Actions)
    auth/confirm/route.ts     # email-link + OAuth callback (PKCE code or token_hash)
    auth/error/               # invalid/expired link page
    dashboard/                # admin platform (first design, sample data): Inicio, Agenda,
                              # Pacientes, Contabilidad, Gestión, Miembros
  lib/crm/
    roles.ts                  # the four roles and what each may see (single source)
    viewer.ts                 # current user + role; scoping and masking helpers
    sample-data.ts            # invented data for the design phase
  components/crm/             # platform UI: sidebar, cards, badges, icons
supabase/
  config.toml                 # local stack config (`supabase start`)
  migrations/                 # source of truth for the schema
```

## Auth rules

- On the server, check identity with `getCurrentUser()` / `requireUser()` from `@/lib/auth`. They use `supabase.auth.getClaims()`, which verifies the JWT. Never trust `getSession()` on the server.
- `src/proxy.ts` only does optimistic redirects. Every page, Server Action and Route Handler must still check auth itself, and RLS is the final gate.
- With Cache Components on, anything that reads cookies (including the Supabase server client) must render inside `<Suspense>`.
- To protect a new route section, add its prefix to `PROTECTED_PREFIXES` in `src/lib/supabase/proxy.ts` *and* call `requireUser()` in it.

## Admin platform (design phase)

`/dashboard` is the first design of the clinic's admin platform. It runs on invented data in `src/lib/crm/sample-data.ts`, and the role (médico, director médico, personal operativo, administrador) comes from the "Ver como" bar at the top, stored in a cookie. Before real patient data is added, the role must come from the database and be enforced by RLS, and the preview bar must be removed (see `src/lib/crm/viewer.ts`).

## Database rules

- Every schema change is a migration in `supabase/migrations/`. Do not edit the schema from the dashboard.
- Every table in `public` gets RLS plus explicit policies. The project also has an event trigger that turns RLS on for new tables automatically.
- `public.profiles` is created automatically for each new auth user by the `on_auth_user_created` trigger.

## Environments

| | Supabase | Vercel |
| --- | --- | --- |
| Project | `DST` (`xnbinvflvurdpvbctxfh`, eu-central-1) | `dispensario-santisima-trinidad` |
| Env vars | — | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` |

Pushes to `main` deploy to production. Other branches and PRs get preview deployments.

In Supabase → Authentication → URL Configuration, set **Site URL** to the production domain. Add these to **Redirect URLs**:

```
http://localhost:3000/**
https://<production-domain>/**
https://*-<vercel-team-slug>.vercel.app/**
```
