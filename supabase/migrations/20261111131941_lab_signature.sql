-- The bioanalyst's handwritten signature, as an image, for the PDF.
--
-- · lab_settings.signer_signature is the path of the image in the private
--   bucket lab-signatures. Administrators upload it from Laboratorio; the
--   server stores the file with the service role and saves the path here
--   (RLS still limits the update to administrators).
-- · Only the PDF draws it (the copy sent by WhatsApp and the one members
--   download), and only on validated reports whose signer is the one in
--   lab_settings. The printed boleta keeps an empty line: it is signed by hand.
-- · Each upload gets a new file name; the old file is deleted once the new
--   path is saved.

alter table public.lab_settings
  add column signer_signature text
    constraint lab_settings_signer_signature check (signer_signature ~ '^[a-z0-9-]+\.(png|jpg)$');

comment on column public.lab_settings.signer_signature is
  'Path in the private bucket lab-signatures of the signer''s signature image, drawn on validated PDFs. Null: no image.';

grant update (signer_signature) on public.lab_settings to authenticated;

-- Private: no policies, so only the service role reads or writes it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lab-signatures', 'lab-signatures', false, 1048576, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
