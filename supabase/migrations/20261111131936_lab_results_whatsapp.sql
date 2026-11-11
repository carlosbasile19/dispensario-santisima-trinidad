-- Lab results over WhatsApp, the parts still missing:
--
-- · Automatic sending. When the laboratory validates a report, the server
--   sends its PDF to the patient's WhatsApp, if they accepted WhatsApp
--   messages. The PDF is locked with a key the patient knows (their cédula,
--   passport or birth date). whatsapp_settings.send_lab_results lets the
--   administrators pause it; a report can still be sent by hand.
-- · Tracking. Once the message is out, lab_report_deliveries follows it:
--   delivered, read, or failed later on. whatsapp_record_status writes the
--   webhook's statuses onto the delivery with the same wamid.
--   `automatic` says the send happened at validation, not by hand.

-- Switch -------------------------------------------------------------------------------

alter table public.whatsapp_settings
  add column send_lab_results boolean not null default true;

grant update (send_lab_results) on public.whatsapp_settings to authenticated;

-- Deliveries ---------------------------------------------------------------------------

alter table public.lab_report_deliveries
  drop constraint lab_report_deliveries_status,
  add constraint lab_report_deliveries_status
    check (status in ('done', 'sending', 'sent', 'delivered', 'read', 'failed')),
  add column automatic    boolean not null default false,
  add column delivered_at timestamptz,
  add column read_at      timestamptz,
  add column failed_at    timestamptz,
  add column error_code   text constraint lab_report_deliveries_error_code check (char_length(error_code) <= 40);

comment on column public.lab_report_deliveries.status is
  'done: printed, shared or downloaded. whatsapp: sending, then sent, delivered and read, or failed (at send time or later, from the webhook).';
comment on column public.lab_report_deliveries.automatic is
  'Sent by the server when the report was validated, not by a member.';

-- The webhook finds a delivery by its WhatsApp message id.
create unique index lab_report_deliveries_wamid_key on public.lab_report_deliveries (wamid) where wamid is not null;

-- Delivery status ----------------------------------------------------------------------

-- As before for the patients' messages and the doctors' alerts, and now
-- also for lab results sent by WhatsApp. The webhook's statuses land on
-- whichever row has the wamid. Statuses only move forward; "failed" always
-- lands. Answers the row's id, or null. The signature is unchanged, so the
-- grants (service role only) are kept.
create or replace function public.whatsapp_record_status(
  ref text,
  new_status text,
  status_at timestamptz,
  code text default null,
  detail text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  target uuid;
  new_rank integer := case new_status when 'sent' then 2 when 'delivered' then 3 when 'read' then 4 end;
  stamp timestamptz := coalesce(status_at, now());
begin
  if coalesce(ref, '') = '' or (new_rank is null and new_status <> 'failed') then
    return null;
  end if;

  update public.whatsapp_messages m
  set
    status = case
      when new_status = 'failed' then 'failed'
      when (case m.status when 'pending' then 0 when 'sending' then 1 when 'sent' then 2
                          when 'delivered' then 3 when 'read' then 4 else -1 end) < new_rank then new_status
      else m.status
    end,
    sent_at = case when new_status in ('sent', 'delivered', 'read') then coalesce(m.sent_at, stamp) else m.sent_at end,
    delivered_at = case when new_status in ('delivered', 'read') then coalesce(m.delivered_at, stamp) else m.delivered_at end,
    read_at = case when new_status = 'read' then coalesce(m.read_at, stamp) else m.read_at end,
    failed_at = case when new_status = 'failed' then coalesce(m.failed_at, stamp) else m.failed_at end,
    error_code = case when new_status = 'failed' then left(code, 40) else m.error_code end,
    error = case when new_status = 'failed' then left(detail, 500) else m.error end
  where m.wamid = ref
  returning m.id into target;

  if target is null then
    update public.whatsapp_doctor_alerts al
    set
      status = case
        when new_status = 'failed' then 'failed'
        when (case al.status when 'pending' then 0 when 'sending' then 1 when 'sent' then 2
                             when 'delivered' then 3 when 'read' then 4 else -1 end) < new_rank then new_status
        else al.status
      end,
      sent_at = case when new_status in ('sent', 'delivered', 'read') then coalesce(al.sent_at, stamp) else al.sent_at end,
      delivered_at = case when new_status in ('delivered', 'read') then coalesce(al.delivered_at, stamp) else al.delivered_at end,
      read_at = case when new_status = 'read' then coalesce(al.read_at, stamp) else al.read_at end,
      failed_at = case when new_status = 'failed' then coalesce(al.failed_at, stamp) else al.failed_at end,
      error_code = case when new_status = 'failed' then left(code, 40) else al.error_code end,
      error = case when new_status = 'failed' then left(detail, 500) else al.error end
    where al.wamid = ref
    returning al.id into target;
  end if;

  if target is null then
    update public.lab_report_deliveries d
    set
      status = case
        when new_status = 'failed' then 'failed'
        when (case d.status when 'sending' then 1 when 'sent' then 2
                            when 'delivered' then 3 when 'read' then 4 else -1 end) < new_rank then new_status
        else d.status
      end,
      delivered_at = case when new_status in ('delivered', 'read') then coalesce(d.delivered_at, stamp) else d.delivered_at end,
      read_at = case when new_status = 'read' then coalesce(d.read_at, stamp) else d.read_at end,
      failed_at = case when new_status = 'failed' then coalesce(d.failed_at, stamp) else d.failed_at end,
      error_code = case when new_status = 'failed' then left(code, 40) else d.error_code end,
      error = case when new_status = 'failed' then left(detail, 500) else d.error end
    where d.wamid = ref and d.channel = 'whatsapp'
    returning d.id into target;
  end if;

  return target;
end;
$$;
