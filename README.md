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
    dashboard/                # admin platform: Inicio, Agenda, Calendarios, Pacientes,
                              # Contabilidad, Gestión, Miembros, Mi cuenta
    agendar/                  # public booking pages: /agendar (all calendars), /agendar/<slug>
    acceso-pendiente/         # signed-in account with no role yet
  lib/crm/
    roles.ts                  # the four roles and what each may see (single source)
    viewer.ts                 # current member + role from the database
    clinic.ts                 # labels (areas, statuses, payment methods) and America/Caracas dates
    money.ts                  # exact USD/Bs arithmetic, the same rounding as the database
    data.ts                   # shared reads: agenda, balances, rates, services, professionals
    calendars.ts              # reads of the booking calendars: hours, special days, a week's visits
    schedule.ts               # weekly hours, slot lengths, half hours and month grids (shared)
    form-state.ts             # what Server Actions answer, Spanish messages for DB errors
  lib/booking/                # public booking: calendar reads (service role), phone numbers,
                              # slugs, "add to my calendar" (.ics / Google Calendar)
  lib/bcv/                    # reads the BCV rate (bcv.org.ve, DolarAPI mirror) and records it
  app/api/cron/bcv/           # the daily job that runs it (Vercel Cron, see vercel.json)
  components/crm/             # platform UI: sidebar, cards, badges, icons, forms, rate form,
                              # select / date-picker / modal (the platform's pickers and dialogs)
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
- **BCV rate.** One rate per day (`exchange_rates`, Bs per dollar, 8 decimals), fetched automatically:
  - The BCV publishes each afternoon the rate of its next business day, its *fecha valor*: Friday's publication is Monday's rate. Weekends and holidays have no rate of their own and use the last fecha valor before them.
  - `lib/bcv/sync.ts` reads bcv.org.ve and records the published day and today, plus tomorrow when it is a Saturday or Sunday (`record_official_rate`, service role only). If the BCV site fails it uses the [DolarAPI](https://ve.dolarapi.com) mirror, which keeps the BCV history by fecha valor (`source` = `bcv` or `dolarapi`).
  - bcv.org.ve serves an incomplete certificate chain, so the missing Sectigo intermediate is bundled in `lib/bcv/sectigo-r36.ts`. TLS verification stays on.
  - **When it runs.** Vercel Cron calls `/api/cron/bcv` twice a day (`vercel.json`): at 01:10 UTC (about 21:10 in Caracas, after the BCV has published the next day's rate) and at 10:10 UTC (about 06:10, as a safety net before opening). On the Hobby plan each job fires at some point within its hour. A page that needs today's rate also fetches it on the spot when it is missing, and the front desk has a "Traer la tasa del BCV" button.
  - A rate typed by hand (`set_exchange_rate`: the front desk today's, administrators any day's) is never replaced by the job. The official figure is kept beside it (`official_bs_per_usd`) and the screens point out any difference.
  - The route needs `CRON_SECRET` (Vercel sends it as a bearer token) and `SUPABASE_SECRET_KEY`.
- **Payments** are taken today, at today's rate, in the currency received: cash or Zelle in dollars, pago móvil, punto, transferencia or cash in bolívares. The database derives the other currency (`payments_apply_rate`, `payment_method_currency`) and refuses a payment above the balance. Correcting a day's rate recalculates every payment of that day, so a day never mixes two rates. Payments are never edited: administrators void them with a reason (`void_payment`). Balances are in dollars (`appointment_balances`).
- **Cashea** (buy now, pay later). The patient pays an *inicial* in the centre and Cashea finances the rest, which the patient pays in cuotas that Cashea guarantees. The front desk enters the Cashea order number, the order total in dollars and how the inicial was paid.
  - `record_cashea_payment` records both parts in one transaction. The inicial is a normal payment with its own method. The financed rest is a payment with method `cashea`, in dollars, which settles the visit.
  - Both lines carry the order number (`cashea_order`).
  - Contabilidad shows the financed amount apart from money actually received, since it reaches the centre later in cuotas.
- The clinic's calendar is America/Caracas time, in the database (`clinic_today()`, `appointments.starts_on`) and on the screens (`lib/crm/clinic.ts`).

## Calendarios and online booking

Each professional (a member with the `doctor` or `director` role) can have one booking calendar, with a public link the centre sends to patients: `/agendar/<slug>`. `/agendar` lists every calendar that takes bookings.

- **Calendarios** (`/dashboard/calendarios`). Everyone sees the calendars, a doctor only their own ("Mi calendario"); administrators create and edit them (`manageCalendars` in `roles.ts`, `can_manage_calendars()` in the database). Each calendar has three views:
  - **Semana**: the week in a grid, the professional's hours in white and the rest hatched, each visit in its status colour (online bookings carry a globe). The front desk and administrators get a "+" on every free half hour, which opens Nueva cita with the day, time and professional filled in.
  - **Horario**: the weekly hours (one or more ranges per day, on half hours) and the special days: a day off, or other hours on one date, which replace that date's weekly hours.
  - **Servicios y reservas**: the services patients can book, each with **30-minute or 1-hour slots**, whether the calendar takes bookings (a paused one asks patients to write on WhatsApp), the specialty and intro patients read, the minimum notice, how far ahead and the link.
- **Slots** last as long as the service and follow each other from the start of each range: in 07:30–12:00 a 1-hour service is offered at 07:30, 08:30, 09:30 and 10:30, a 30-minute one every half hour. A slot is free when it is past the minimum notice and within the horizon and overlaps no visit of the professional (cancelled and no-shows do not count), whoever booked it. The rules live in the database (`calendar_windows`, `calendar_free_slots`), so the page and the booking use the same ones.
- **Booking.** The patient picks a service, a day and a time, then gives the patient's cédula (V or E) or passport. A document the centre knows books straight away with that patient's record; a document is one person, so a family that shares a phone still books each child on their own record. A new document asks for name, last name, email and mobile and registers the patient with it (`patients.source = 'online'`). A child without a cédula is booked by WhatsApp. The patient's note goes on the visit (`appointments.patient_notes`); the visit is `scheduled` with `source = 'online'`, for the front desk to confirm.
- **Privacy.** Patients have no account and never reach the database directly: the pages and the booking action call `booking_calendar`, `booking_directory` and `book_online` with the service role (`SUPABASE_SECRET_KEY`), and those functions are not executable by `anon` or members. They return public information and statuses only, never anything about a patient, and an unverified visitor can only add a visit to a record, never read or change it. Documents follow the patients form's rules (a cédula has 5 to 10 digits, a passport 4 to 15 letters and digits; `src/lib/booking/document.ts` mirrors them), and a new patient's mobile is checked and kept in international form too (`patients.phone_e164`, from `normalize_phone()`).
- **Abuse limits** (`book_online`): 12 attempts per client in 15 minutes and 40 a day (by a keyed hash of the IP, never the IP itself; `booking_attempts`, kept two days), 20 online bookings per calendar per hour, 3 upcoming online visits per patient, and one booking at a time per calendar (an advisory lock), so two patients cannot take the same slot.
- Without `SUPABASE_SECRET_KEY` the booking pages show a WhatsApp fallback instead of failing.

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
| Env vars | — | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SECRET_KEY` and `CRON_SECRET` (server only) |

Pushes to `main` deploy to production. Other branches and PRs get preview deployments.

In Supabase → Authentication → URL Configuration, set **Site URL** to the production domain. Add these to **Redirect URLs**:

```
http://localhost:3000/**
https://<production-domain>/**
https://*-<vercel-team-slug>.vercel.app/**
```
