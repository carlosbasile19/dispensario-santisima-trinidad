-- Both search functions run as the caller, so existing patient/report RLS
-- still decides which rows appear. The look-ahead row drives "Siguiente".
create function public.search_patients_page(
  query text default '', page_offset integer default 0, page_size integer default 51
)
returns table (
  id uuid, first_name text, last_name text, id_type text, id_number text,
  birth_date date, phone text, created_at timestamptz
)
language sql stable security invoker
set search_path = ''
as $$
  with q as (
    select array_remove(
      regexp_split_to_array(extensions.unaccent(lower(btrim(left(coalesce(query, ''), 80)))), '\s+'), ''
    ) as words,
    regexp_replace(left(coalesce(query, ''), 80), '[^0-9]', '', 'g') as digits
  )
  select p.id, p.first_name, p.last_name, p.id_type, p.id_number,
         p.birth_date, p.phone, p.created_at
  from public.patients p, q
  where cardinality(q.words) = 0
     or not exists (
       select 1 from unnest(q.words) as word
       where strpos(extensions.unaccent(lower(p.first_name || ' ' || p.last_name)), word) = 0
     )
     or (char_length(q.digits) >= 3 and strpos(coalesce(p.id_number, ''), q.digits) > 0)
  order by lower(p.last_name), lower(p.first_name), p.id
  limit least(greatest(coalesce(page_size, 51), 1), 101)
  offset least(greatest(coalesce(page_offset, 0), 0), 1000000);
$$;

-- Filter reports inside Postgres. A matching patient after the first 200
-- search results must still be able to appear in the report list.
-- Returning the table type lets PostgREST join patients and deliveries in
-- the same request; the caller selects only the list columns.
create function public.search_lab_reports_page(
  query text default '', report_status public.lab_report_status default null,
  patient uuid default null, page_offset integer default 0, page_size integer default 51
)
returns setof public.lab_reports
language sql stable security invoker
set search_path = ''
as $$
  with q as (
    select array_remove(
      regexp_split_to_array(extensions.unaccent(lower(btrim(left(coalesce(query, ''), 80)))), '\s+'), ''
    ) as words,
    regexp_replace(left(coalesce(query, ''), 80), '[^0-9]', '', 'g') as digits
  )
  select r.*
  from public.lab_reports r, q
  where (report_status is null or r.status = report_status)
    and (patient is null or r.patient_id = patient)
    and (cardinality(q.words) = 0 or exists (
      select 1 from public.patients p
      where p.id = r.patient_id
        and (not exists (
          select 1 from unnest(q.words) as word
          where strpos(extensions.unaccent(lower(p.first_name || ' ' || p.last_name)), word) = 0
        ) or (char_length(q.digits) >= 3 and strpos(coalesce(p.id_number, ''), q.digits) > 0))
    ))
  order by r.updated_at desc, r.id desc
  limit least(greatest(coalesce(page_size, 51), 1), 101)
  offset least(greatest(coalesce(page_offset, 0), 0), 1000000);
$$;

revoke execute on function public.search_patients_page(text, integer, integer) from public, anon;
revoke execute on function public.search_lab_reports_page(text, public.lab_report_status, uuid, integer, integer) from public, anon;
grant execute on function public.search_patients_page(text, integer, integer) to authenticated;
grant execute on function public.search_lab_reports_page(text, public.lab_report_status, uuid, integer, integer) to authenticated;

-- Extend the existing ordering indexes with a unique tie-breaker.
drop index public.patients_name_idx;
create index patients_name_idx on public.patients (lower(last_name), lower(first_name), id);
drop index public.lab_reports_status_idx;
create index lab_reports_status_idx on public.lab_reports (status, updated_at desc, id desc);
create index lab_reports_updated_idx on public.lab_reports (updated_at desc, id desc);
create index lab_reports_patient_updated_idx on public.lab_reports (patient_id, updated_at desc, id desc);

-- Totals describe the entire visible record, not just the visits on a page.
create function public.patient_visit_summary(patient uuid)
returns table (appointments bigint, owed_usd numeric)
language sql stable security invoker
set search_path = ''
as $$
  select (select count(*) from public.appointments a where a.patient_id = patient),
    case when public.can_collect_payments() or public.can_manage_accounting() then (
      select coalesce(sum(greatest(b.balance_usd, 0)), 0)
      from public.appointment_balances b
      where b.patient_id = patient
        and b.starts_on <= public.clinic_today()
        and b.status not in ('cancelled', 'no_show')
    ) else null end;
$$;
revoke execute on function public.patient_visit_summary(uuid) from public, anon;
grant execute on function public.patient_visit_summary(uuid) to authenticated;

drop index public.appointments_patient_idx;
create index appointments_patient_idx on public.appointments (patient_id, starts_at desc, id desc);
