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
    dashboard/                # admin platform: Inicio, Agenda, Calendarios, Pacientes, Laboratorio,
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
  lib/lab/                    # Laboratorio: the test catalog, reference intervals and flags, formulas,
                              # report checks, the branded PDF (pdf/) and sending it by WhatsApp
  components/lab/             # the report builder, the printed boleta, the delivery actions
  app/imprimir/               # the printable boleta, outside the platform's frame
  lib/whatsapp/               # WhatsApp through Zernio: API, templates, sending, webhook events
  app/api/whatsapp/           # Zernio's webhook and the end of the connect flow; app/api/cron/whatsapp: reminders
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
- **BCV rate.** One rate per day (`exchange_rates`, Bs per dollar, stored with the BCV's 8 decimals and shown with 2; conversions use the full figure), fetched automatically:
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

## Laboratorio

**Laboratorio** (`/dashboard/laboratorio`) is where the lab's result reports are built and handed out. It replaces the clinic's Excel boletas: the hematología, química and "formato corto" workbooks, positive/negative and with values.

- **Who.**
  - Doctors and administrators build, validate and correct reports (`labReports` in `roles.ts`, `can_build_lab_reports()` in the database). A doctor reports only on their own patients, as everywhere else.
  - Everyone who sees the patient can open a validated report, print it and send it.
  - To let the medical director build reports too, add `director` to both.
- **Building a report.**
  1. Nuevo informe: find the patient, or start from Pacientes or from a visit with a bioanálisis service ("Cargar resultados"). Then link the visit of the sample, if there is one.
  2. Add exams. Profiles mirror the clinic's sheets: Hematología completa, Perfil de rutina, Orina completa, Examen de heces, VDRL/HIV/PCR/R.A., Coagulación and the rest. Single tests come from a searchable catalog of about 200, and a test can also be typed by hand.
  3. Type the results. Enter moves to the next one, as in the spreadsheet. Numbers follow the Venezuelan format (`13,5`, `145.000`). Usual answers come as chips or lists (NEGATIVO/POSITIVO, `0 - 2 x CMP`…) and any text is accepted.
  - **Flags.** Each result is flagged ↑ alto, ↓ bajo or • anormal as it is typed, against the patient's interval by sex and age, as the sheets' `IF(SEXO=…)` did. Any flag or reference can be overridden for one report.
  - **Formulas.** These are computed as in the sheets: CHCM, LDL (Friedewald), VLDL, bilirrubina indirecta, globulina and A/G, índices de riesgo, PT (actividad, razón, INR), índice de Katz, TIBC and saturación.
  - **Suggestions.** Hb can be estimated from the Hto with the clinic's formula (Hto × 0,315 + 0,2), but only as a suggestion. VCM and HCM are computed only when the red cell count was measured; they are not derived from an estimate.
  - **Warnings.** Implausible values ("¿Valor correcto?") and a leukocyte formula that does not add up to 100 % are flagged.
  - **Autosave.** The draft saves itself a moment after typing stops. If another member saved in between, nothing is overwritten (`updated_at` check).
  4. **Revisar y validar** shows what will be signed: results, out-of-range values, empty tests (left out of the report) and the signer. `finalize_lab_report` then locks the report and copies in the patient's data and the signer. Each validated version is kept in `lab_report_versions`. **Corregir** reopens it as revision 2 with a reason, and the new documents say they replace the earlier one.
- **The signer** is one row, `lab_settings`, seeded with Lcdo. Heriberto M. Arteaga R. (C.I. 11.171.135, M.S.A.S. 9577, Colegio 05-451). Administrators change it at the bottom of Laboratorio. A validated report keeps the signer it was signed with.
- **The signature image.** Administrators can also upload the signer's handwritten signature (PNG or JPG, up to 1 MB) there. It is stored in the private bucket `lab-signatures`, and `lab_settings.signer_signature` holds its path. Only the PDF draws it: the copy sent by WhatsApp and the one members download. It goes only on validated reports signed by the bioanalyst in `lab_settings`. The printed boleta keeps an empty line, because it is signed by hand.
- **Catalog.** Tests, units, reference values and usual answers live in `src/lib/lab/catalog.ts`, taken from the clinic's workbooks. A report copies a test's unit and reference rules when the test is added, so editing the catalog never changes an issued report.
- **Two documents.**
  - **Boleta impresa** (`/imprimir/laboratorio/<id>`). The clinic's half-sheet slip: header, Nº de examen, the patient strip, one table per exam, the signature and the address box. Two slips go on a Letter or A4 sheet with "doblar aquí" marks, or one per page in Media carta.
    - The portada (cover, with the Bioanálisis logo) prints on the back of the first sheet. Print double-sided, flipping on the long edge, then fold with the results inside.
    - Results are paginated so no slip overflows (`paginate` in `components/lab/boleta.tsx`, calibrated in Chrome).
  - **PDF de marca** (`/dashboard/laboratorio/<id>/pdf`, `?descargar=1` to download). The report patients receive, rendered on request with `@react-pdf/renderer` (`lib/lab/pdf`).
    - Layout: the navy band with the mark, a patient card, a summary of what is out of range, the sections with range bars, and the validation and signature.
    - Every page carries the patient, the Nº and "Página x de y".
    - Drafts carry a BORRADOR watermark.
    - Fonts and the mark are in `assets/lab-pdf/` (OFL fonts), traced into the functions by `outputFileTracingIncludes` in `next.config.ts`.
- **Handing it out.** A validated report offers three ways:
  - Print the boleta.
  - Download the PDF.
  - Send it by WhatsApp. The clinic's number sends the template `resultados_laboratorio_clave` with the PDF as its document header.
    - **On its own when the report is validated.** `validateLabReport` calls `sendOnValidation` (`lib/lab/whatsapp.ts`) right after `finalize_lab_report`. It sends only if the "Resultados de laboratorio al validar" switch is on (`whatsapp_settings.send_lab_results`), everything below is in place, and this revision has not gone out by WhatsApp yet. A failed send leaves the report validated, with the error on its page and a button to retry. The validation dialog says beforehand whether it will go out, and to which number. A corrected revision goes out again when it is validated.
    - It needs the number connected, the template approved, the patient's WhatsApp consent and a key for the PDF.
    - **The PDF is locked** (AES-128, `lib/lab/pdf-key.ts`) with something the patient knows and a wrong recipient does not. That is the cédula (its digits), else the passport (in capitals), else the birth date as DDMMAAAA. A patient with none of them cannot get it by WhatsApp. The message says which key it is ("la clave es tu número de cédula, solo los números"), never the key itself. Members download, print and share the unlocked PDF.
    - The PDF is uploaded to the private bucket `lab-reports`, and Meta downloads it from a link signed for six hours. The daily WhatsApp job deletes those copies after two days.
    - The message carries no result and no ID number: the first name, the day of the sample, which key opens the PDF and who validated it.
    - **Tracking.** The webhook's statuses land on the delivery (`whatsapp_record_status`, by wamid): sent, delivered, read, or failed later on with Meta's code, shown in Spanish (`failureLabel`). The report page, the patient's page and the list show how far it got. The daily job marks a send cut off mid-way as interrupted.
    - Otherwise the member's phone shares the PDF straight to WhatsApp (Web Share), or a computer opens the patient's chat to attach the downloaded file.
  - Every print, download, share and send is logged in `lab_report_deliveries`, and the list shows what was delivered.
- **Submitting the template.** "Enviar a Meta para revisión" submits `resultados_laboratorio_clave` too, with `public/laboratorio/informe-de-ejemplo.pdf` (a fictitious patient) as the sample Meta reviews. That file must be reachable at `NEXT_PUBLIC_SITE_URL` (the production domain). It replaces `resultados_laboratorio`, which never got approved and is no longer used; its text did not say how to open a locked PDF.

## WhatsApp

Confirmations and reminders to patients, and alerts of new visits to doctors, go out from the clinic's own number through [Zernio](https://zernio.com), a Meta Tech Provider, with **Coexistence**: the number stays in the WhatsApp Business app on the front desk's phone and works on the WhatsApp Cloud API at the same time. Messages are mirrored both ways, so the front desk sees every automatic message, and the patient's answer, in the app.

- **What goes out.** A confirmation when a visit is booked (online or in Nueva cita) and a reminder the afternoon before (`/api/cron/whatsapp`, Vercel Cron at 20:30 UTC, about 16:30 in Caracas). Both are UTILITY templates (`lib/whatsapp/templates.ts`) with three buttons:
  - **Confirmar asistencia** makes the visit `confirmed`.
  - **Cancelar cita** makes it `cancelled`, which frees the slot.
  - **Reprogramar** changes nothing; the front desk follows up in the chat.

  `whatsapp_apply_reply` applies the answer. When two visits are pending, a tap could be about either, so it changes nothing. A short text answers each tap. Messages never carry the cédula (Meta's policy forbids ID numbers) or the service.
- **Alerts to doctors.** As soon as a visit is booked with a doctor or the medical director (online, in Nueva cita, or when they are added to a visit or given one of its services), the clinic's number sends them the `nueva_cita_medico` template: the patient's name, the day, the time and their services on the visit, never the cédula, the phone or the patient's notes. Only doctors with a number in Administración › WhatsApp › Avisos a médicos get them (`whatsapp_doctor_phones`, administrators only, added with the doctor's consent), one per doctor and visit.
  - A trigger on `appointment_items` (`whatsapp_queue_doctor_alert`) queues the row in `whatsapp_doctor_alerts`. It never makes a booking fail.
  - Every booking path then calls `deliverDoctorAlerts`, after the response; the daily job sends whatever is left over.
  - Statuses arrive through the same webhook (`whatsapp_record_status` updates whichever table has the wamid). The visit's WhatsApp card shows them, without the number.
  - With Coexistence, each alert also appears in the front desk's app, in the chat with that doctor, and a doctor's reply lands there.
  - The "Aviso al médico al agendar" switch pauses them all.
- **Who gets them.** Patients with `whatsapp_consent = true` and a mobile number (`whatsapp_reachable`). The online booking form has one checkbox, required to book: it accepts the use of the details and the WhatsApp messages (confirmation, reminder and lab results). `bookOnline` refuses a booking without it, and `whatsapp_queue_online_booking` records the consent. The front desk records the answer in the patient form. There is one message per visit and time (`whatsapp_messages`, unique), and no message text is stored. The clinic's Zernio profile has zero content retention too.
- **Pieces.**
  - `lib/whatsapp/zernio.ts`: the API calls.
  - `send.ts`: queue (database functions `whatsapp_queue_*`) and send; each row is claimed before sending.
  - `webhook.ts` behind `/api/whatsapp/webhook`: signed events, deduplicated in `whatsapp_webhook_events`. They carry delivery statuses, button answers, disconnections and template reviews.
  - `/api/whatsapp/callback`: the end of the connect flow. It checks a state cookie, the administrator and the account.
  - **Administración › WhatsApp**: connect, templates, switches and the latest messages.
  - The WhatsApp card on each visit, which can also send or retry the confirmation, and lists the doctors' alerts.
- **Setting up Zernio**, once, from a trusted machine, with a full-access key of your Zernio team owner:

  ```bash
  ZERNIO_ADMIN_KEY=<full-access key> SITE_URL=https://<production-domain> node scripts/zernio-setup.mjs
  ```

  It creates the clinic's profile in your existing Zernio team with zero content retention. It also creates an API key and a webhook, both limited to that profile, and prints `ZERNIO_API_KEY`, `ZERNIO_PROFILE_ID` and `ZERNIO_WEBHOOK_SECRET` for Vercel. Webhooks reach the production domain only.
- **Connecting the number.**
  1. Open Administración › WhatsApp › Conectar WhatsApp, with the clinic's phone at hand. Zernio's page (in Spanish) opens Meta's Embedded Signup: log in with Facebook, type the number, then scan a QR code from WhatsApp Business (Settings › Linked devices).
  2. Turn off two-step verification in the app first; turn it back on afterwards.
  3. Press "Enviar a Meta para revisión" to submit the templates; it sends only those Meta has not seen yet, so press it again after a new template is added. Nothing is sent until Meta approves a template, which takes minutes to 24 hours. The `whatsapp.template.status_updated` webhook and the daily job keep the status current.
- **Coexistence limits.**
  - Broadcast lists are disabled in the app, and disappearing and view-once messages are off.
  - The profile photo is managed in the app.
  - WhatsApp for Windows cannot be linked; WhatsApp Web can.
  - The phone must open the app at least every ~14 days, or Meta disconnects the number. `account.disconnected` shows that on the WhatsApp page, and nothing is sent until an administrator reconnects.
  - To leave Coexistence, use the phone: Settings › Account › Business Platform › Disconnect.
- **Costs.** Meta bills each delivered template to the clinic's WhatsApp Business Account, the doctors' alerts included: about US$0.0113 per utility message for Venezuela, charged in dollars to a card in Meta Business Suite. Answers to a patient's tap are service messages: 1,000 a month free per number. Zernio adds no markup to Meta's fees.

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
| Env vars | — | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`; server only: `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `ZERNIO_API_KEY`, `ZERNIO_PROFILE_ID`, `ZERNIO_WEBHOOK_SECRET` |

Pushes to `main` deploy to production. Other branches and PRs get preview deployments.

In Supabase → Authentication → URL Configuration, set **Site URL** to the production domain. Add these to **Redirect URLs**:

```
http://localhost:3000/**
https://<production-domain>/**
https://*-<vercel-team-slug>.vercel.app/**
```
