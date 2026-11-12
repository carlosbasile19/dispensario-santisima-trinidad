-- Reportes (Contabilidad): everything the reports page draws for a period,
-- in one call, so a year of visits never meets the API's row limit.
--
-- A "visit" is an appointment that was not cancelled and not missed; those
-- two are counted apart. Visits count on the clinic day they happen, money
-- on the day it was received (payments) or paid out (expenses), as on the
-- Cobros and Gastos tabs. Amounts are US dollars (the bolívar payments and
-- expenses at their day's BCV rate) unless the key ends in _bs.
--
-- `bucket` splits the period for the charts: 'day', 'week' (Monday to
-- Sunday) or 'month'. Each slot is the first day of its bucket. Security
-- invoker: the caller's RLS applies, and only administrators may call it.

create function public.accounting_report(from_day date, to_day date, bucket text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  today constant date := public.clinic_today();
  result jsonb;
begin
  if not coalesce((select public.can_manage_accounting()), false) then
    raise exception 'Only administrators can read the accounting reports' using errcode = '42501';
  end if;
  if from_day is null or to_day is null or to_day < from_day or to_day - from_day > 400 then
    raise exception 'A report covers 1 to 401 days' using errcode = '22023';
  end if;
  if bucket is null or bucket not in ('day', 'week', 'month') then
    raise exception 'Unknown bucket %', bucket using errcode = '22023';
  end if;

  with
  slots as (
    select s::date as slot
    from generate_series(
      date_trunc(bucket, from_day::timestamp),
      date_trunc(bucket, to_day::timestamp),
      ('1 ' || bucket)::interval
    ) as s
  ),
  booked as (
    select a.id, a.patient_id, a.starts_on, a.status, a.source,
           date_trunc(bucket, a.starts_on::timestamp)::date as slot
    from public.appointments a
    where a.starts_on between from_day and to_day
  ),
  visits as (
    select * from booked where status not in ('cancelled', 'no_show')
  ),
  items as (
    select v.id as appointment_id, v.patient_id, v.slot, i.price_usd, i.professional_id,
           s.name as service, s.area
    from visits v
    join public.appointment_items i on i.appointment_id = v.id
    join public.services s on s.id = i.service_id
  ),
  -- Patients whose first visit ever falls in the period.
  newcomers as (
    select f.patient_id, date_trunc(bucket, f.first_on::timestamp)::date as slot
    from (
      select a.patient_id, min(a.starts_on) as first_on
      from public.appointments a
      where a.status not in ('cancelled', 'no_show')
        and a.patient_id in (select patient_id from visits)
      group by a.patient_id
    ) f
    where f.first_on between from_day and to_day
  ),
  paid as (
    select p.method, p.currency, p.amount_usd, p.amount_bs,
           date_trunc(bucket, p.paid_on::timestamp)::date as slot
    from public.payments p
    where p.paid_on between from_day and to_day and p.voided_at is null
  ),
  spent as (
    select e.supplier_id, e.currency, e.amount_usd, e.amount_bs,
           date_trunc(bucket, e.spent_on::timestamp)::date as slot
    from public.expenses e
    where e.spent_on between from_day and to_day
  ),
  people as (
    select pt.id, pt.sex,
           case when pt.birth_date is null then null
                else extract(year from age(least(to_day, today), pt.birth_date))::int end as years
    from public.patients pt
    where pt.id in (select patient_id from visits)
  )
  select jsonb_build_object(
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slot', s.slot,
        'patients', coalesce(v.patients, 0),
        'new_patients', coalesce(n.patients, 0),
        'visits', coalesce(v.visits, 0),
        'billed_usd', coalesce(i.usd, 0),
        'collected_usd', coalesce(p.usd, 0),
        'expenses_usd', coalesce(e.usd, 0)
      ) order by s.slot), '[]'::jsonb)
      from slots s
      left join (select slot, count(distinct patient_id) as patients, count(*) as visits from visits group by slot) v using (slot)
      left join (select slot, count(*) as patients from newcomers group by slot) n using (slot)
      left join (select slot, sum(price_usd) as usd from items group by slot) i using (slot)
      left join (select slot, sum(amount_usd) as usd from paid group by slot) p using (slot)
      left join (select slot, sum(amount_usd) as usd from spent group by slot) e using (slot)
    ),
    'totals', jsonb_build_object(
      'patients', (select count(distinct patient_id) from visits),
      'new_patients', (select count(*) from newcomers),
      'visits', (select count(*) from visits),
      'attended', (select count(*) from visits where status in ('completed', 'checked_in')),
      'unmarked', (select count(*) from visits where status in ('scheduled', 'confirmed') and starts_on <= today),
      'upcoming', (select count(*) from visits where status in ('scheduled', 'confirmed') and starts_on > today),
      'cancelled', (select count(*) from booked where status = 'cancelled'),
      'no_show', (select count(*) from booked where status = 'no_show'),
      'online', (select count(*) from visits where source = 'online'),
      'billed_usd', (select coalesce(sum(price_usd), 0) from items),
      'collected_usd', (select coalesce(sum(amount_usd), 0) from paid),
      'collected_bs', (select coalesce(sum(amount_bs), 0) from paid),
      'received_usd', (select coalesce(sum(amount_usd), 0) from paid where method in ('cash_usd', 'zelle')),
      'received_bs', (select coalesce(sum(amount_bs), 0) from paid where currency = 'VES'),
      'financed_usd', (select coalesce(sum(amount_usd), 0) from paid where method = 'cashea'),
      'expenses_usd', (select coalesce(sum(amount_usd), 0) from spent),
      'expenses_bs', (select coalesce(sum(amount_bs), 0) from spent),
      'owed_usd', (
        select coalesce(sum(greatest(b.balance_usd, 0)), 0)
        from public.appointment_balances b
        where b.appointment_id in (select id from visits where starts_on <= today)
      )
    ),
    'areas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'area', x.area, 'visits', x.visits, 'patients', x.patients, 'billed_usd', x.usd
      ) order by x.usd desc, x.visits desc), '[]'::jsonb)
      from (
        select area, count(distinct appointment_id) as visits, count(distinct patient_id) as patients, sum(price_usd) as usd
        from items group by area
      ) x
    ),
    'methods', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'method', x.method, 'payments', x.payments, 'amount_usd', x.usd, 'amount_bs', x.bs
      ) order by x.usd desc), '[]'::jsonb)
      from (
        select method, count(*) as payments, sum(amount_usd) as usd, sum(amount_bs) as bs
        from paid group by method
      ) x
    ),
    'services', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'service', x.service, 'area', x.area, 'count', x.n, 'billed_usd', x.usd
      ) order by x.n desc, x.usd desc, x.service), '[]'::jsonb)
      from (
        select service, area, count(*) as n, sum(price_usd) as usd
        from items group by service, area
        order by count(*) desc, sum(price_usd) desc, service
        limit 8
      ) x
    ),
    'professionals', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', x.name, 'visits', x.visits, 'patients', x.patients, 'billed_usd', x.usd
      ) order by x.usd desc, x.visits desc, x.name), '[]'::jsonb)
      from (
        select coalesce(nullif(btrim(pr.full_name), ''), pr.email, 'Sin asignar') as name,
               count(distinct i.appointment_id) as visits, count(distinct i.patient_id) as patients,
               sum(i.price_usd) as usd
        from items i
        left join public.profiles pr on pr.id = i.professional_id
        group by i.professional_id, 1
        order by sum(i.price_usd) desc, count(distinct i.appointment_id) desc
        limit 12
      ) x
    ),
    'suppliers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', x.name, 'expenses', x.n, 'amount_usd', x.usd
      ) order by x.usd desc, x.name), '[]'::jsonb)
      from (
        select coalesce(su.name, 'Sin proveedor') as name, count(*) as n, sum(sp.amount_usd) as usd
        from spent sp
        left join public.suppliers su on su.id = sp.supplier_id
        group by sp.supplier_id, su.name
        order by sum(sp.amount_usd) desc
        limit 6
      ) x
    ),
    -- Distinct patients seen: by sex (F, M, not recorded) and by age band.
    'sex', (
      select jsonb_build_array(
        count(*) filter (where sex = 'F'),
        count(*) filter (where sex = 'M'),
        count(*) filter (where sex is null)
      ) from people
    ),
    'ages', (
      select jsonb_build_array(
        count(*) filter (where years between 0 and 11),
        count(*) filter (where years between 12 and 17),
        count(*) filter (where years between 18 and 29),
        count(*) filter (where years between 30 and 44),
        count(*) filter (where years between 45 and 59),
        count(*) filter (where years >= 60),
        count(*) filter (where years is null)
      ) from people
    ),
    -- Visits by weekday, Monday first.
    'weekdays', (
      select jsonb_build_array(
        count(*) filter (where extract(isodow from starts_on) = 1),
        count(*) filter (where extract(isodow from starts_on) = 2),
        count(*) filter (where extract(isodow from starts_on) = 3),
        count(*) filter (where extract(isodow from starts_on) = 4),
        count(*) filter (where extract(isodow from starts_on) = 5),
        count(*) filter (where extract(isodow from starts_on) = 6),
        count(*) filter (where extract(isodow from starts_on) = 7)
      ) from visits
    )
  )
  into result;

  return result;
end;
$$;

revoke execute on function public.accounting_report(date, date, text) from public, anon;
grant execute on function public.accounting_report(date, date, text) to authenticated;
