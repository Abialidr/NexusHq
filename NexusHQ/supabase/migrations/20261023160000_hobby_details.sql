-- Long write-up for each hobby (the short `body` stays the card text). The 3D café opens it with the photo
-- in a floating frame from the DJ booth panel. Visibility follows the row's existing RLS.
alter table public.hobbies
  add column if not exists details text not null default '';
