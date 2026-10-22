-- PricePulse World: support photos attached to submitted price reports.
-- Run this migration in the Supabase SQL Editor if it has not already been applied.

alter table public.price_reports
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('price-report-images', 'price-report-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public can view price report images" on storage.objects;
create policy "Public can view price report images"
on storage.objects for select
to public
using (bucket_id = 'price-report-images');

drop policy if exists "Users can upload own price report images" on storage.objects;
create policy "Users can upload own price report images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'price-report-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own price report images" on storage.objects;
create policy "Users can delete own price report images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'price-report-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
