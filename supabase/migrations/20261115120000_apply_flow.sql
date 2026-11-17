-- Apply flow: contact details are snapshotted onto the application so the candidate
-- can edit them per job without changing their profile, and employers only see
-- what the candidate chose to send.

alter table public.applications
  add column contact_phone text check (contact_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  add column contact_country text check (char_length(contact_country) <= 80);
