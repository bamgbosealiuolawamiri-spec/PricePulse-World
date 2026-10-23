# PricePulse World shop verification payments

> **Current status (2026-10-23): Payments are postponed.** The shop verification screen now accepts free applications and does not call the Paystack function. Do not configure secrets, deploy this payment function, or enable checkout until the project owner has an authorized payment account and explicitly chooses to turn payments on. Manual review remains required for every badge.

This integration uses Paystack-hosted checkout. The Paystack secret key is used only inside a Supabase Edge Function; it must never be placed in Vite variables, React code, or Git.

## What it does

- Starts checkout for the selected shop verification application.
- Calculates the amount on the server from the saved plan: ₦2,000 for `verified`, ₦5,000 for `premium`.
- Verifies a transaction against Paystack's server API, checking success status, NGN currency, exact amount, reference, application, shop, applicant, and plan metadata.
- Marks the application fee as paid only after server-side verification.
- Does **not** approve the application or grant a blue badge. Those remain a separate manual-review decision.

The checkout currently collects one month's fee as a one-time transaction. Automatic monthly renewal/subscription billing is not implemented.

## Setup before enabling checkout

If you are under 18, ask a parent/guardian or another authorized adult to own/manage the payment-provider account and handle its identity, business verification, and secret keys. Do not share secret keys in chat.

1. Apply the migrations in order in the linked Supabase project's SQL Editor:
   - `supabase/migrations/20261023020000_shop_connect_verification.sql`
   - `supabase/migrations/20261023030000_shop_verification_payments.sql`
2. In the Supabase project, open **Edge Functions → Secrets** and add:
   - `PAYSTACK_SECRET_KEY`: your Paystack **test** secret key first.
   - `SITE_URL`: `https://pricepulse-world-app.bamgbosealiuolawamiri.workers.dev` (origin only; no trailing slash).
   Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions automatically. Never put the service-role key in the browser or commit it to Git.
3. Deploy the function from the repository root with the Supabase CLI:
   `supabase functions deploy shop-verification-payment`
4. Test in Paystack test mode using a test account and test payment methods. Confirm the application shows **Payment: paid** while its review status remains **pending**.
5. Before accepting real payments, complete the merchant account's required verification, set the live secret key as an Edge Function secret (not in code), and test the live-mode configuration carefully.

## Required safety checks

- Do not treat a browser redirect as proof of payment; the function verifies the transaction directly with Paystack.
- Never send a badge or mark an application approved just because payment succeeded.
- If the function reports that payment service is not configured, check the Edge Function secrets and deployment.
- Do not share API keys in chat, screenshots, GitHub, or client-side environment variables.
