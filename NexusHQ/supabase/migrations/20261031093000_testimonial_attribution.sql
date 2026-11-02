alter table public.testimonials
  add column if not exists source_label text not null default '',
  add column if not exists source_url text,
  add column if not exists reviewed_on date;

alter table public.testimonials
  add constraint testimonials_source_url_http_check
  check (source_url is null or source_url ~ '^https?://[^[:space:]]+$');

comment on column public.testimonials.source is 'Collection method: request, open, or manual. External platform attribution belongs in source_label and source_url.';
comment on column public.testimonials.source_label is 'Public attribution label for the review source, such as Upwork.';
comment on column public.testimonials.source_url is 'Optional public HTTP or HTTPS source link for the testimonial.';
comment on column public.testimonials.reviewed_on is 'Date of the original review when supplied; distinct from the import timestamp.';
