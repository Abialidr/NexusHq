-- Company logo for each experience row, shown in the 3D café's framed photos (latest three roles).
-- Storage path in the public "portfolio" bucket; visibility follows the row's existing RLS.
alter table public.experiences
  add column if not exists logo_path text;
