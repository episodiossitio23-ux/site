import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const url = new URL(req.url);
  let type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  let paymentId = url.searchParams.get("data.id") ?? "";
  if (req.method === "POST") {
    try {
      const body = await req.json();
      type = String(body?.type ?? body?.topic ?? type);
      paymentId = String(body?.data?.id ?? paymentId);
    } catch {
      // Mercado Pago may send notifications without a body; the query string is used instead.
    }
  }
  if (type !== "payment" || !/^\d+$/.test(paymentId)) return json({ received: true });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    const { data: settings, error: settingsError } = await admin
      .from("payment_settings")
      .select("mp_enabled, mp_access_token")
      .eq("id", 1)
      .maybeSingle();
    if (settingsError) throw new Error(settingsError.message);
    if (!settings?.mp_enabled || !settings.mp_access_token) return json({ received: true });

    // The payment is re-read from Mercado Pago, so a forged notification cannot approve an order.
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${settings.mp_access_token}` },
    });
    if (!paymentResponse.ok) {
      console.error("mercadopago payment lookup failed", paymentResponse.status);
      return json({ error: "Pagamento indisponível." }, 502);
    }
    const payment = (await paymentResponse.json()) as {
      id?: number;
      status?: string;
      external_reference?: string;
      transaction_amount?: number;
    };

    const orderId = String(payment.external_reference ?? "");
    if (payment.status !== "approved" || !UUID_PATTERN.test(orderId)) return json({ received: true });

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, status, total_cents")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order || order.status !== "aguardando_pagamento") return json({ received: true });

    if (Math.round(Number(payment.transaction_amount) * 100) !== order.total_cents) {
      console.error("mercadopago amount mismatch for order", order.id);
      return json({ received: true });
    }

    const { error: updateError } = await admin
      .from("orders")
      .update({
        status: "pagamento_aprovado",
        mp_payment_id: String(payment.id),
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("status", "aguardando_pagamento");
    if (updateError) throw new Error(updateError.message);

    return json({ received: true });
  } catch (err) {
    console.error("mercadopago webhook failed", err instanceof Error ? err.message : err);
    return json({ error: "Não foi possível processar a notificação." }, 500);
  }
});
