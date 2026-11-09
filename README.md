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
    dashboard/                # admin platform: Inicio, Agenda, Pacientes, Contabilidad,
                              # Gestión, Miembros, Mi cuenta
    acceso-pendiente/         # signed-in account with no role yet
  lib/crm/
    roles.ts                  # the four roles and what each may see (single source)
    viewer.ts                 # current member + role from the database
    clinic.ts                 # labels (areas, statuses, payment methods) and America/Caracas dates
    money.ts                  # exact USD/Bs arithmetic, the same rounding as the database
    data.ts                   # shared reads: agenda, balances, rates, services, professionals
    form-state.ts             # what Server Actions answer, Spanish messages for DB errors
  components/crm/             # platform UI: sidebar, cards, badges, icons, forms, rate form
supabase/
  config.toml                 # local stack config (`supabase start`)
  migrations/                 # source of truth for the schema
```

## Auth rules

- On the server, check identity with `getCurrentUser()` / `requireUser()` from `@/lib/auth`. They use `supabase.auth.getClaims()`, which verifies the JWT. Never trust `getSession()` on the server.
- `src/proxy.ts` only does optimistic redirects. Every page, Server Action and Route Handler must still check auth itself, and RLS is the final gate.
- With Cache Components on, anything that reads cookies (including the Supabase server client) must render inside `<Suspense>`.
- To protect a new route section, add its prefix to `PROTECTED_PREFIXES` in `src/lib/supabase/proxy.ts` *and* call `requireUser()` in it.

## Admin platform

`/dashboard` is the clinic's admin platform: accounts and roles, patients, the agenda, the price list, the daily BCV rate and payments.

- **Roles.** Each member has one role on `profiles.role` (`doctor`, `director`, `staff`, `admin`); what each may see is defined once in `src/lib/crm/roles.ts`. A signed-in account with no role lands on `/acceso-pendiente`. Members cannot change their own role: only administrators can, from Miembros (`set_member_role`).
- **No public sign-up.** Administrators create accounts in Miembros ("Crear cuenta") and can give a member a new temporary password there. Both use `SUPABASE_SECRET_KEY` on the server (`src/lib/supabase/admin.ts`), set in Vercel. The very first administrator is created by hand: add the user in Supabase → Authentication, then `update public.profiles set role = 'admin' where email = '…'`. `scripts/create-members.mjs` does the same from a terminal. Turn off "Allow new users to sign up" in Supabase → Authentication so the API matches the UI.
- **Passkeys.** Members add them in Mi cuenta and can then use "Entrar con passkey". In Supabase → Authentication, enable passkeys and set the relying party ID to the production domain (no scheme) and its origin to `https://<production-domain>`. Passkeys are bound to that domain, so they do not work on preview deployments.

## Agenda, prices and payments

- **Patients** are registered by the front desk (`staff`) and administrators, from Pacientes or straight from "Nueva cita". Doctors see only patients they have a service with.
- **Appointments** are one visit of one patient. A visit carries one or more services (`appointment_items`), each with its own professional (a member with the `doctor` or `director` role) and price, so one visit can have a consultation, a lab test and a dental cleaning with three different people. Doctors see the visits where they have a service.
- **Prices** are the centre's, in US dollars, set by administrators in Contabilidad › Tarifas (`services`). A booked service copies that price (`list_price_usd`); the front desk may charge another one (`price_usd`) and the original stays on record. Changing a price affects new bookings only.
- **BCV rate.** One rate per day (`exchange_rates`, Bs per dollar, 8 decimals), entered from bcv.org.ve. The front desk sets today's; administrators any day's (`set_exchange_rate`). There is no automatic fetch.
- **Payments** are taken today, at today's rate, in the currency received: cash or Zelle in dollars, pago móvil, punto, transferencia or cash in bolívares. The database derives the other currency (`payments_apply_rate`) and refuses a payment above the balance. Correcting a day's rate recalculates every payment of that day, so a day never mixes two rates. Payments are never edited: administrators void them with a reason (`void_payment`). Balances are in dollars (`appointment_balances`).
- The clinic's calendar is America/Caracas time, in the database (`clinic_today()`, `appointments.starts_on`) and on the screens (`lib/crm/clinic.ts`).

## Database rules

- Every schema change is a migration in `supabase/migrations/`. Do not edit the schema from the dashboard.
- The project's migration history must list exactly the files in `supabase/migrations/`, or `pnpm db:push` refuses to run. A migration applied any other way (for example through the Supabase MCP `apply_migration` tool) is recorded under the time it ran, so name its local file with that version.
- History from before the `20261108195127` baseline belongs to an earlier schema. It is archived in the database in `supabase_migrations.schema_migrations_pre_baseline` and is not part of this repo.
- Every table in `public` gets RLS plus explicit policies. The project also has an event trigger that turns RLS on for new tables automatically.
- `public.profiles` is created automatically for each new auth user by the `on_auth_user_created` trigger.

## Environments

| | Supabase | Vercel |
| --- | --- | --- |
| Project | `DST` (`xnbinvflvurdpvbctxfh`, eu-central-1) | `dispensario-santisima-trinidad` |
| Env vars | — | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SECRET_KEY` (server only) |

Pushes to `main` deploy to production. Other branches and PRs get preview deployments.

In Supabase → Authentication → URL Configuration, set **Site URL** to the production domain. Add these to **Redirect URLs**:

```
http://localhost:3000/**
https://<production-domain>/**
https://*-<vercel-team-slug>.vercel.app/**
```
