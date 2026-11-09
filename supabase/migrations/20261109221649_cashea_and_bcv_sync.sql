-- Cashea sales, and the BCV rate fetched automatically.
--
-- · Cashea (buy now, pay later). The patient pays an inicial in the centre
--   with any method and Cashea finances the rest, which the centre collects
--   in cuotas that Cashea guarantees. A Cashea sale is recorded by
--   record_cashea_payment() as two payments in one transaction: the inicial,
--   with the method it was paid in, and the financed part with method
--   'cashea', in dollars, which settles the visit. Both carry the Cashea
--   order number (cashea_order) so they can be matched later.
-- · BCV rate. A scheduled job (src/lib/bcv, /api/cron/bcv) reads the rate the
--   BCV publishes and records it with record_official_rate(). The BCV
--   publishes in the afternoon the rate of its next business day (its
--   "fecha valor"); a weekend or holiday uses the rate of the last fecha
--   valor before it. A rate typed by hand is never replaced by the job: the
--   official value is kept beside it, so the screens can point out a
--   difference.

-- The currency each method's amount is typed in ------------------------------

create or replace function public.payment_method_currency(method public.payment_method)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when method in ('cash_usd', 'zelle', 'cashea') then 'USD' else 'VES' end;
$$;

revoke execute on function public.payment_method_currency(public.payment_method) from public, anon;
grant execute on function public.payment_method_currency(public.payment_method) to authenticated, service_role;

create or replace function public.payments_apply_rate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  day_rate numeric(20, 8);
begin
  select bs_per_usd into day_rate from public.exchange_rates where rate_date = new.paid_on;
  if day_rate is null then
    raise exception 'There is no BCV rate for %', new.paid_on using errcode = 'P0001', hint = 'missing_rate';
  end if;

  new.rate := day_rate;
  new.currency := public.payment_method_currency(new.method);
  if new.currency = 'USD' then
    new.amount_bs := round(new.amount_usd * day_rate, 2);
  else
    new.amount_usd := round(new.amount_bs / day_rate, 2);
  end if;
  return new;
end;
$$;

-- Cashea -----------------------------------------------------------------------

alter table public.payments
  add column cashea_order text constraint payments_cashea_order_format check (cashea_order ~ '^[0-9A-Z][0-9A-Z-]{2,39}$'),
  add constraint payments_cashea_order_required check (method <> 'cashea' or cashea_order is not null);

comment on column public.payments.cashea_order is
  'Cashea order number. Set on the financed part (method cashea) and on the inicial paid with it.';

create index payments_cashea_order_idx on public.payments (cashea_order) where cashea_order is not null;

grant insert (cashea_order) on public.payments to authenticated;

-- Records a Cashea sale: the inicial (if any) with the method it was paid in,
-- in that method's currency, and the financed rest in dollars. The order
-- total is in dollars, like Cashea's own amounts. Runs with the caller's
-- rights, so RLS and the payment triggers (rate, balance) apply to both rows.
create or replace function public.record_cashea_payment(
  appointment uuid,
  order_number text,
  order_total_usd numeric,
  initial_method public.payment_method default null,
  initial_amount numeric default null,
  initial_reference text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  order_ref text := regexp_replace(upper(coalesce(order_number, '')), '[^0-9A-Z-]', '', 'g');
  initial_usd numeric(12, 2) := 0;
begin
  if char_length(order_ref) < 3 or char_length(order_ref) > 40 then
    raise exception 'Write the Cashea order number' using errcode = '22023', hint = 'missing_cashea_order';
  end if;
  if order_total_usd is null or order_total_usd <= 0 then
    raise exception 'The order total must be greater than zero' using errcode = '22023';
  end if;

  if coalesce(initial_amount, 0) > 0 then
    if initial_method is null or initial_method = 'cashea' then
      raise exception 'Choose how the inicial was paid' using errcode = '22023', hint = 'invalid_initial_method';
    end if;
    insert into public.payments (appointment_id, method, amount_usd, amount_bs, reference, cashea_order)
    values (
      appointment,
      initial_method,
      case when public.payment_method_currency(initial_method) = 'USD' then initial_amount end,
      case when public.payment_method_currency(initial_method) = 'VES' then initial_amount end,
      nullif(btrim(coalesce(initial_reference, '')), ''),
      order_ref
    )
    returning amount_usd into initial_usd;
  end if;

  if order_total_usd - initial_usd <= 0 then
    raise exception 'The inicial covers the whole order: Cashea finances nothing'
      using errcode = 'P0001', hint = 'cashea_nothing_financed';
  end if;

  insert into public.payments (appointment_id, method, amount_usd, cashea_order)
  values (appointment, 'cashea', order_total_usd - initial_usd, order_ref);
end;
$$;

revoke execute on function public.record_cashea_payment(uuid, text, numeric, public.payment_method, numeric, text) from public, anon;
grant execute on function public.record_cashea_payment(uuid, text, numeric, public.payment_method, numeric, text) to authenticated;

-- The BCV rate, fetched -------------------------------------------------------

alter table public.exchange_rates
  add column source text not null default 'manual' constraint exchange_rates_source_check
    check (source in ('manual', 'bcv', 'dolarapi')),
  add column fecha_valor date,
  add column official_bs_per_usd numeric(20, 8) constraint exchange_rates_official_positive check (official_bs_per_usd > 0),
  add column fetched_at timestamptz,
  add constraint exchange_rates_fecha_valor_not_after check (fecha_valor is null or fecha_valor <= rate_date);

comment on column public.exchange_rates.source is
  'manual: typed by a member. bcv: read from bcv.org.ve. dolarapi: from the ve.dolarapi.com mirror when the BCV site was unreachable.';
comment on column public.exchange_rates.fecha_valor is
  'The BCV fecha valor the rate belongs to: the same day on business days, the last business day before it on weekends and holidays.';
comment on column public.exchange_rates.official_bs_per_usd is
  'The rate the job read for this day. Differs from bs_per_usd only when a member typed another one.';

-- A member's rate is a manual one.
create or replace function public.set_exchange_rate(rate_day date, bs_per_usd numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    (select public.can_manage_accounting())
    or ((select public.can_collect_payments()) and rate_day = public.clinic_today())
  ) then
    raise exception 'Not allowed to set the rate for %', rate_day using errcode = '42501';
  end if;
  if bs_per_usd is null or bs_per_usd <= 0 then
    raise exception 'The rate must be greater than zero' using errcode = '22023';
  end if;

  insert into public.exchange_rates (rate_date, bs_per_usd, updated_by, source, fecha_valor)
  values (rate_day, set_exchange_rate.bs_per_usd, (select auth.uid()), 'manual', null)
  on conflict (rate_date) do update
    set bs_per_usd = excluded.bs_per_usd,
        updated_by = excluded.updated_by,
        source = 'manual',
        fecha_valor = null;
end;
$$;

-- Records the official rate of a day, for the scheduled job only.
-- rate_day is the day it applies to; valid_since the fecha valor it comes
-- from (earlier than rate_day on weekends and holidays). Returns what it did:
-- inserted, updated, unchanged, or kept_manual (a member's rate stays).
create or replace function public.record_official_rate(
  rate_day date,
  bs_per_usd numeric,
  rate_source text,
  valid_since date
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.exchange_rates%rowtype;
begin
  if bs_per_usd is null or bs_per_usd <= 0 then
    raise exception 'The rate must be greater than zero' using errcode = '22023';
  end if;
  if rate_source is null or rate_source not in ('bcv', 'dolarapi') then
    raise exception 'Unknown rate source %', rate_source using errcode = '22023';
  end if;
  if valid_since is null or valid_since > rate_day then
    raise exception 'The fecha valor must be on or before the day' using errcode = '22023';
  end if;

  select * into existing from public.exchange_rates where rate_date = rate_day for update;

  if not found then
    insert into public.exchange_rates (rate_date, bs_per_usd, updated_by, source, fecha_valor, official_bs_per_usd, fetched_at)
    values (rate_day, record_official_rate.bs_per_usd, null, rate_source, valid_since, record_official_rate.bs_per_usd, now());
    return 'inserted';
  end if;

  if existing.source = 'manual' then
    update public.exchange_rates
    set official_bs_per_usd = record_official_rate.bs_per_usd, fetched_at = now()
    where rate_date = rate_day;
    return case when existing.bs_per_usd = record_official_rate.bs_per_usd then 'unchanged' else 'kept_manual' end;
  end if;

  -- A fetched rate follows a newer fecha valor (a provisional weekend or
  -- holiday rate replaced by the day's own), or the BCV itself correcting
  -- the same fecha valor. A mirror never replaces the BCV's own figure.
  if existing.fecha_valor is null
     or valid_since > existing.fecha_valor
     or (valid_since = existing.fecha_valor
         and rate_source = 'bcv'
         and (existing.source <> 'bcv' or existing.bs_per_usd <> record_official_rate.bs_per_usd)) then
    update public.exchange_rates
    set bs_per_usd = record_official_rate.bs_per_usd,
        official_bs_per_usd = record_official_rate.bs_per_usd,
        source = rate_source,
        fecha_valor = valid_since,
        fetched_at = now(),
        updated_by = null
    where rate_date = rate_day;
    return case when existing.bs_per_usd = record_official_rate.bs_per_usd then 'unchanged' else 'updated' end;
  end if;

  update public.exchange_rates set fetched_at = now() where rate_date = rate_day;
  return 'unchanged';
end;
$$;

revoke execute on function public.record_official_rate(date, numeric, text, date) from public, anon, authenticated;
grant execute on function public.record_official_rate(date, numeric, text, date) to service_role;
