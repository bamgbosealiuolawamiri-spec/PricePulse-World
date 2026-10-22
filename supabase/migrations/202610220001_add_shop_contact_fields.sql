-- PricePulse World: optional seller contact details.
-- Run this migration in the Supabase SQL Editor before deploying/using seller contact fields.
alter table public.shops
  add column if not exists phone text,
  add column if not exists whatsapp text;

comment on column public.shops.phone is 'Public shop phone number, including country code.';
comment on column public.shops.whatsapp is 'Public WhatsApp number in international digits format, without a leading plus sign.';
