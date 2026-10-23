-- Paystack checkout support for shop verification applications.
-- Payment confirms the fee only; it never approves a shop or grants a badge.
alter table public.shop_verification_applications
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed')),
  add column if not exists payment_verified_at timestamptz;

alter table public.shop_verification_applications
  drop constraint if exists shop_verification_application_once_pending;

create unique index if not exists shop_verification_one_open_application_idx
  on public.shop_verification_applications (shop_id, applicant_id)
  where status in ('pending', 'payment_pending');

create unique index if not exists shop_verification_payment_reference_uidx
  on public.shop_verification_applications (payment_reference)
  where payment_reference is not null;
