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
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let accessToken = "";
  let siteUrl = "";
  try {
    const body = await req.json();
    accessToken = String(body?.access_token ?? "");
    siteUrl = String(body?.site_url ?? "");
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }
  if (!UUID_PATTERN.test(accessToken)) return json({ error: "Pedido inválido." }, 400);

  let origin: URL;
  try {
    origin = new URL(siteUrl);
    if (origin.protocol !== "https:" && origin.protocol !== "http:") throw new Error("protocol");
  } catch {
    return json({ error: "Endereço do site inválido." }, 400);
  }

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
    if (!settings?.mp_enabled || !settings.mp_access_token) return json({ checkout_url: null });

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, status, customer_name, customer_email, total_cents, shipping_cents, shipping_method_name")
      .eq("access_token", accessToken)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) return json({ error: "Pedido não encontrado." }, 404);
    if (order.status !== "aguardando_pagamento") {
      return json({ error: "Este pedido não está aguardando pagamento." }, 409);
    }

    const { data: items, error: itemsError } = await admin
      .from("order_items")
      .select("position, format_label, quantity, unit_price_cents")
      .eq("order_id", order.id)
      .order("position");
    if (itemsError) throw new Error(itemsError.message);
    if (!items?.length) return json({ error: "Este pedido não tem fotos." }, 409);

    const mpItems = items.map((item) => ({
      id: String(item.position),
      title: `Foto ${item.position} - ${item.format_label}`,
      quantity: item.quantity,
      unit_price: item.unit_price_cents / 100,
      currency_id: "BRL",
    }));
    if (order.shipping_cents > 0) {
      mpItems.push({
        id: "frete",
        title: `Frete - ${order.shipping_method_name || "Entrega"}`,
        quantity: 1,
        unit_price: order.shipping_cents / 100,
        currency_id: "BRL",
      });
    }

    const returnUrl = `${origin.origin}/pedido/${accessToken}`;
    const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.mp_access_token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `order-${order.id}`,
      },
      body: JSON.stringify({
        items: mpItems,
        payer: { name: order.customer_name, email: order.customer_email },
        external_reference: order.id,
        back_urls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
        auto_return: "approved",
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
      }),
    });
    if (!preferenceResponse.ok) {
      console.error("mercadopago preference failed", preferenceResponse.status, await preferenceResponse.text());
      return json({ error: "Não foi possível abrir o pagamento agora. Tente novamente." }, 502);
    }

    const preference = (await preferenceResponse.json()) as { init_point?: unknown };
    if (typeof preference.init_point !== "string") {
      console.error("mercadopago preference missing init_point");
      return json({ error: "Não foi possível abrir o pagamento agora. Tente novamente." }, 502);
    }
    return json({ checkout_url: preference.init_point });
  } catch (err) {
    console.error("mercadopago checkout failed", err instanceof Error ? err.message : err);
    return json({ error: "Não foi possível abrir o pagamento agora. Tente novamente." }, 500);
  }
});
