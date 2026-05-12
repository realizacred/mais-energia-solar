// signature-test-connection: validates Autentique/ZapSign tokens by hitting their "me" endpoint
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_URL = "https://api.autentique.com.br/v2/graphql";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Não autenticado" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims) return json({ ok: false, error: "Não autenticado" }, 401);

    // Resolve tenant
    const userId = claims.claims.sub;
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .maybeSingle();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return json({ ok: false, error: "Tenant não resolvido" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: settings } = await admin
      .from("signature_settings")
      .select("provider, api_token_encrypted, sandbox_mode")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!settings?.api_token_encrypted) {
      return json({ ok: false, error: "Nenhum token configurado. Salve o token antes de testar." }, 400);
    }

    const provider = settings.provider || "autentique";
    const token = settings.api_token_encrypted;

    if (provider === "autentique") {
      const query = `query { me { name email } }`;
      const resp = await fetch(AUTENTIQUE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query }),
      });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || data?.errors?.length) {
        const msg = data?.errors?.[0]?.message || `HTTP ${resp.status}`;
        return json({
          ok: false,
          error: `Autentique rejeitou o token: ${msg}`,
          provider,
          httpStatus: resp.status,
          body: data,
        });
      }
      const me = data?.data?.me;
      if (!me?.email) {
        return json({ ok: false, error: "Resposta inesperada do Autentique", provider, body: data });
      }
      return json({
        ok: true,
        provider,
        name: me.name || null,
        email: me.email,
        plan: null,
        sandbox: settings.sandbox_mode,
      });
    }

    if (provider === "zapsign") {
      const baseUrl = settings.sandbox_mode
        ? "https://sandbox.api.zapsign.com.br/api/v1"
        : "https://api.zapsign.com.br/api/v1";
      const resp = await fetch(`${baseUrl}/users/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return json({
          ok: false,
          error: `ZapSign rejeitou o token: HTTP ${resp.status}`,
          provider,
          body: data,
        });
      }
      return json({
        ok: true,
        provider,
        name: data?.name || data?.full_name || null,
        email: data?.email || null,
        plan: data?.plan || null,
        sandbox: settings.sandbox_mode,
      });
    }

    return json({ ok: false, error: `Provider '${provider}' não suportado para teste` }, 400);
  } catch (err: any) {
    return json({ ok: false, error: err?.message || "Erro inesperado" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
