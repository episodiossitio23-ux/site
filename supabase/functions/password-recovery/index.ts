import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GENERIC_RESPONSE = {
  message: "Se este e-mail pertencer a um administrador, você receberá o link de redefinição em instantes.",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let email = "";
  let redirectTo = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim().toLowerCase();
    redirectTo = String(body?.redirectTo ?? "");
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "Informe um e-mail válido." }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: smtp, error: smtpError } = await admin
    .from("smtp_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (smtpError) {
    console.error("smtp lookup failed", smtpError.message);
    return json(GENERIC_RESPONSE);
  }
  if (!smtp?.is_active || !smtp.host || !smtp.from_email) {
    console.error("smtp is not configured or inactive");
    return json(GENERIC_RESPONSE);
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });
  if (linkError || !linkData?.user || !linkData.properties?.action_link) {
    return json(GENERIC_RESPONSE);
  }

  const { data: adminRow } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", linkData.user.id)
    .maybeSingle();
  if (!adminRow) return json(GENERIC_RESPONSE);

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.username ? { user: smtp.username, pass: smtp.password } : undefined,
    });
    await transporter.sendMail({
      from: smtp.from_name ? `"${smtp.from_name}" <${smtp.from_email}>` : smtp.from_email,
      to: email,
      subject: "Redefinição de senha do painel",
      text:
        "Recebemos um pedido para redefinir a senha do painel da loja.\n\n" +
        `Use o link abaixo para criar uma nova senha:\n${linkData.properties.action_link}\n\n` +
        "Se você não fez este pedido, ignore este e-mail.",
    });
  } catch (err) {
    console.error("smtp send failed", err instanceof Error ? err.message : err);
  }

  return json(GENERIC_RESPONSE);
});
