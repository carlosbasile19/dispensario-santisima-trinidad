-- Gastos: what the centre pays out, to whom and into which account, so a
-- week's spending can be set against what it took in.
--
-- · suppliers: the people and businesses the centre pays, with where the
--   money goes (bank account, pago móvil, Zelle or other notes).
-- · expenses: one payment out. Like a payment in, it is recorded in the
--   currency it was paid in and the database derives the other one from the
--   BCV rate of that day (expenses_apply_rate). Correcting a day's rate
--   recalculates that day's expenses too.
-- · destination keeps the account the money was sent to at the time, so
--   changing a supplier's account later does not rewrite past expenses.
-- · Administrators only (can_manage_accounting). Expenses are deleted, not
--   edited: a mistake is deleted and entered again.

-- Suppliers -------------------------------------------------------------------

create table public.suppliers (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(btrim(name)) between 2 and 120),
  -- RIF or cédula, as written.
  document          text check (char_length(document) <= 30),
  bank              text check (char_length(bank) <= 80),
  account_number    text check (char_length(account_number) <= 30),
  pago_movil_phone  text check (char_length(pago_movil_phone) <= 20),
  -- Zelle e-mail, a second account, anything else about paying them.
  notes             text check (char_length(notes) <= 300),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index suppliers_name_key on public.suppliers (lower(btrim(name)));

create trigger suppliers_touch_updated_at
  before update on public.suppliers
  for each row execute function public.touch_updated_at();

alter table public.suppliers enable row level security;

create policy "suppliers_select_accounting" on public.suppliers
  for select to authenticated
  using ((select public.can_manage_accounting()));

create policy "suppliers_insert_accounting" on public.suppliers
  for insert to authenticated
  with check ((select public.can_manage_accounting()));

create policy "suppliers_update_accounting" on public.suppliers
  for update to authenticated
  using ((select public.can_manage_accounting()))
  with check ((select public.can_manage_accounting()));

revoke all on public.suppliers from anon, authenticated;
grant select on public.suppliers to authenticated;
grant insert (name, document, bank, account_number, pago_movil_phone, notes) on public.suppliers to authenticated;
grant update (name, document, bank, account_number, pago_movil_phone, notes) on public.suppliers to authenticated;

-- Expenses --------------------------------------------------------------------

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  -- The clinic's day the money was paid. Its BCV rate is the one applied.
  spent_on     date not null references public.exchange_rates (rate_date),
  description  text not null check (char_length(btrim(description)) between 2 and 200),
  supplier_id  uuid references public.suppliers (id) on delete restrict,
  method       text not null check (method in ('pago_movil', 'transfer_bs', 'cash_bs', 'zelle', 'cash_usd')),
  -- Derived from the method: zelle and cash_usd are dollars, the rest bolívares.
  currency     text not null check (currency in ('USD', 'VES')),
  rate         numeric(20, 8) not null,
  -- What was paid in its currency and its equivalent in the other. A very
  -- small bolívar amount can round to 0,00 dollars, hence >= 0.
  amount_usd   numeric(12, 2) not null check (amount_usd >= 0),
  amount_bs    numeric(16, 2) not null check (amount_bs >= 0),
  reference    text check (char_length(reference) <= 60),
  destination  text check (char_length(destination) <= 200),
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index expenses_spent_on_idx on public.expenses (spent_on);
create index expenses_supplier_idx on public.expenses (supplier_id);
create index expenses_created_by_idx on public.expenses (created_by);

-- The conversion, the same as payments_apply_rate.
create or replace function public.expenses_apply_rate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  day_rate numeric(20, 8);
begin
  select bs_per_usd into day_rate from public.exchange_rates where rate_date = new.spent_on;
  if day_rate is null then
    raise exception 'There is no BCV rate for %', new.spent_on using errcode = 'P0001', hint = 'missing_expense_rate';
  end if;

  new.rate := day_rate;
  if new.method in ('cash_usd', 'zelle') then
    if new.amount_usd is null or new.amount_usd <= 0 then
      raise exception 'The amount must be greater than zero' using errcode = '22023';
    end if;
    new.currency := 'USD';
    new.amount_bs := round(new.amount_usd * day_rate, 2);
  else
    if new.amount_bs is null or new.amount_bs <= 0 then
      raise exception 'The amount must be greater than zero' using errcode = '22023';
    end if;
    new.currency := 'VES';
    new.amount_usd := round(new.amount_bs / day_rate, 2);
  end if;
  return new;
end;
$$;

revoke execute on function public.expenses_apply_rate() from public, anon, authenticated;

create trigger expenses_apply_rate
  before insert or update of spent_on, method, amount_usd, amount_bs, rate on public.expenses
  for each row execute function public.expenses_apply_rate();

-- When a day's rate is corrected, that day's payments and expenses follow it.
create or replace function public.exchange_rates_recalculate_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payments set rate = new.bs_per_usd where paid_on = new.rate_date;
  update public.expenses set rate = new.bs_per_usd where spent_on = new.rate_date;
  return null;
end;
$$;

revoke execute on function public.exchange_rates_recalculate_day() from public, anon, authenticated;

alter table public.expenses enable row level security;

create policy "expenses_select_accounting" on public.expenses
  for select to authenticated
  using ((select public.can_manage_accounting()));

create policy "expenses_insert_accounting" on public.expenses
  for insert to authenticated
  with check ((select public.can_manage_accounting()));

create policy "expenses_delete_accounting" on public.expenses
  for delete to authenticated
  using ((select public.can_manage_accounting()));

revoke all on public.expenses from anon, authenticated;
grant select, delete on public.expenses to authenticated;
grant insert (spent_on, description, supplier_id, method, amount_usd, amount_bs, reference, destination)
  on public.expenses to authenticated;
