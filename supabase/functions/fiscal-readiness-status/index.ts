import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReadinessItem {
  key: string;
  label: string;
  status: "green" | "yellow" | "red";
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user.id).single();
    if (!profile?.tenant_id) return new Response(JSON.stringify({ error: "No tenant" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const items: ReadinessItem[] = [];

    // 1. Check payment gateway config (API key)
    const { data: gwConfig } = await supabase
      .from("payment_gateway_config")
      .select("id, api_key, environment, is_active")
      .eq("provider", "asaas")
      .maybeSingle();

    if (!gwConfig || !gwConfig.api_key) {
      items.push({ key: "api_key", label: "Credenciais Asaas", status: "red", message: "API Key não configurada. Vá em Configurações → Pagamentos." });
    } else if (!gwConfig.is_active) {
      items.push({ key: "api_key", label: "Credenciais Asaas", status: "yellow", message: "API Key configurada mas integração desativada." });
    } else {
      items.push({ key: "api_key", label: "Credenciais Asaas", status: "green", message: `Conectado (${gwConfig.environment})` });
    }

    // 2. Check fiscal settings
    const { data: fiscalSettings } = await supabase
      .from("fiscal_settings")
      .select("id, cnpj_emitente, inscricao_municipal, municipio_emitente, uf_emitente, regime_tributario, portal_nacional_enabled, homologation_tested, is_active")
      .maybeSingle();

    if (!fiscalSettings) {
      items.push({ key: "emitente", label: "Dados do Emitente", status: "red", message: "Configuração fiscal não criada." });
    } else {
      if (!fiscalSettings.cnpj_emitente || !fiscalSettings.inscricao_municipal || !fiscalSettings.municipio_emitente) {
        items.push({ key: "emitente", label: "Dados do Emitente", status: "red", message: "CNPJ, IM ou município incompleto." });
      } else {
        items.push({ key: "emitente", label: "Dados do Emitente", status: "green", message: `${fiscalSettings.municipio_emitente}/${fiscalSettings.uf_emitente}` });
      }
    }

    // 3. Check municipal requirements
    const { data: munReqs, count: munReqCount } = await supabase
      .from("fiscal_municipal_requirements")
      .select("id", { count: "exact" });

    if (!munReqCount || munReqCount === 0) {
      items.push({ key: "municipal_req", label: "Exigências Municipais", status: "yellow", message: "Não sincronizadas. Clique em 'Buscar exigências'." });
    } else {
      items.push({ key: "municipal_req", label: "Exigências Municipais", status: "green", message: `${munReqCount} requisito(s) carregado(s)` });
    }

    // 4. Check municipal services
    const { count: svcCount } = await supabase
      .from("fiscal_municipal_services")
      .select("id", { count: "exact" })
      .eq("is_active", true);

    if (!svcCount || svcCount === 0) {
      if (fiscalSettings?.portal_nacional_enabled) {
        items.push({ key: "services", label: "Serviços Municipais", status: "yellow", message: "Portal Nacional ativo — cadastre serviços manualmente." });
      } else {
        items.push({ key: "services", label: "Serviços Municipais", status: "red", message: "Nenhum serviço sincronizado." });
      }
    } else {
      items.push({ key: "services", label: "Serviços Municipais", status: "green", message: `${svcCount} serviço(s) disponível(is)` });
    }

    // 5. Homologation test
    if (!fiscalSettings?.homologation_tested) {
      items.push({ key: "homologation", label: "Teste em Homologação", status: "red", message: "Emita uma NFS-e de teste antes de usar em produção." });
    } else {
      items.push({ key: "homologation", label: "Teste em Homologação", status: "green", message: "Teste realizado com sucesso." });
    }

    // Overall status
    const hasRed = items.some(i => i.status === "red");
    const hasYellow = items.some(i => i.status === "yellow");
    const overall: "green" | "yellow" | "red" = hasRed ? "red" : hasYellow ? "yellow" : "green";

    return new Response(JSON.stringify({ overall, items, can_issue: !hasRed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[fiscal-readiness-status] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
