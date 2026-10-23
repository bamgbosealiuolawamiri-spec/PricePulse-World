/// <reference path="../_shared/deno.d.ts" />
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") || "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
  const siteUrl = Deno.env.get("SITE_URL");

  if (!supabaseUrl || !anonKey || !serviceKey || !paystackSecret || !siteUrl) {
    return json(503, { error: "Payment service is not configured yet." });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token === authHeader) return json(401, { error: "Please sign in again." });

  // Validate the caller with Supabase Auth. Never trust an applicant ID supplied by the browser.
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!userResponse.ok) return json(401, { error: "Your session is invalid or expired." });
  const user = await userResponse.json();
  if (!user?.id || !user?.email) return json(401, { error: "A verified account email is required." });

  let input: { action?: string; application_id?: string; reference?: string };
  try { input = await req.json(); } catch { return json(400, { error: "Invalid JSON body." }); }
  const restHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
  const getApplication = async (query: string) => {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/shop_verification_applications?${query}&applicant_id=eq.${encodeURIComponent(user.id)}&select=id,shop_id,applicant_id,plan,status,monthly_price_ngn,payment_status,payment_reference`,
      { headers: restHeaders },
    );
    if (!response.ok) throw new Error("Could not load your verification application.");
    const rows = await response.json();
    return Array.isArray(rows) ? rows[0] : null;
  };
  const updateApplication = async (id: string, patch: Record<string, unknown>) => {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/shop_verification_applications?id=eq.${encodeURIComponent(id)}&applicant_id=eq.${encodeURIComponent(user.id)}`,
      { method: "PATCH", headers: { ...restHeaders, Prefer: "return=minimal" }, body: JSON.stringify(patch) },
    );
    if (!response.ok) throw new Error("Could not update payment status.");
  };

  try {
    if (input.action === "initialize") {
      if (!input.application_id || !/^[0-9a-f-]{36}$/i.test(input.application_id)) {
        return json(400, { error: "A valid application is required." });
      }
      const app = await getApplication(`id=eq.${encodeURIComponent(input.application_id)}`);
      if (!app) return json(404, { error: "Verification application not found." });
      if (!["pending", "payment_pending"].includes(app.status)) {
        return json(409, { error: "This application is not eligible for payment." });
      }
      if (app.payment_status === "paid") return json(409, { error: "This application is already paid." });
      const expectedAmount = app.plan === "premium" ? 5000 : app.plan === "verified" ? 2000 : 0;
      if (!expectedAmount || Number(app.monthly_price_ngn) !== expectedAmount) {
        return json(409, { error: "The application price does not match the selected plan." });
      }

      const reference = `PPV${crypto.randomUUID().replaceAll("-", "")}`;
      const callbackUrl = `${siteUrl.replace(/\/$/, "")}/#/verification?payment=return`;
      const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount: expectedAmount * 100,
          currency: "NGN",
          reference,
          callback_url: callbackUrl,
          metadata: {
            application_id: app.id,
            applicant_id: user.id,
            shop_id: app.shop_id,
            plan: app.plan,
          },
        }),
      });
      const result = await paystackResponse.json().catch(() => null);
      if (!paystackResponse.ok || !result?.status || !result?.data?.authorization_url) {
        return json(502, { error: "Paystack could not start checkout. Please try again." });
      }
      await updateApplication(app.id, {
        payment_status: "pending",
        payment_reference: reference,
      });
      return json(200, { authorization_url: result.data.authorization_url, reference });
    }

    if (input.action === "verify") {
      const reference = String(input.reference || "");
      if (!/^[A-Za-z0-9.=\-]{8,100}$/.test(reference)) {
        return json(400, { error: "Invalid payment reference." });
      }
      const app = await getApplication(`payment_reference=eq.${encodeURIComponent(reference)}`);
      if (!app) return json(404, { error: "Payment reference not found for your account." });
      if (app.payment_status === "paid") {
        return json(200, { paid: true, status: app.status, message: "Payment was already verified. Shop approval is still separate." });
      }
      const verifyResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${paystackSecret}` } },
      );
      const verified = await verifyResponse.json().catch(() => null);
      const transaction = verified?.data;
      const expectedAmount = (app.plan === "premium" ? 5000 : 2000) * 100;
      const metadata = transaction?.metadata || {};
      const matches = verifyResponse.ok && verified?.status && transaction?.status === "success"
        && transaction?.reference === reference
        && transaction?.currency === "NGN"
        && Number(transaction?.amount) === expectedAmount
        && metadata.application_id === app.id
        && metadata.applicant_id === user.id
        && metadata.shop_id === app.shop_id
        && metadata.plan === app.plan;
      if (!matches) {
        return json(402, { paid: false, message: "Payment is not confirmed yet. If you just paid, wait briefly and try again." });
      }
      // Mark the fee paid only. Do not approve the application or enable the badge here.
      await updateApplication(app.id, {
        payment_status: "paid",
        payment_verified_at: new Date().toISOString(),
      });
      return json(200, { paid: true, status: app.status, message: "Payment verified. Your shop still needs manual approval." });
    }

    return json(400, { error: "Unsupported payment action." });
  } catch (error) {
    console.error("shop-verification-payment error", error);
    return json(500, { error: error instanceof Error ? error.message : "Payment service failed." });
  }
});
