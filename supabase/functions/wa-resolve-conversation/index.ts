// Auto-resolução server-side de conversas WhatsApp.
// Replica a lógica canônica de src/services/whatsapp/waConversationResolver.ts
// para uso pelo webhook (sem auth de usuário). NÃO cria, NÃO envia mensagem.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(input?: string | null): { variants: string[] } | null {
  if (!input) return null;
  const beforeAt = input.includes("@") ? input.split("@")[0] : input;
  let digits = beforeAt.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) {
    return { variants: Array.from(new Set([digits, `55${digits}`])) };
  }
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  const set = new Set<string>([digits, `55${digits}`]);
  if (rest.length === 9 && rest.startsWith("9")) {
    const w = `${ddd}${rest.slice(1)}`;
    set.add(w); set.add(`55${w}`);
  }
  if (rest.length === 8) {
    const w = `${ddd}9${rest}`;
    set.add(w); set.add(`55${w}`);
  }
  return { variants: Array.from(set) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { conversation_id, source = "realtime" } = await req.json();
    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "conversation_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: conv } = await supabase
      .from("wa_conversations")
      .select("id, tenant_id, remote_jid, lead_id, cliente_id, cliente_telefone, is_group")
      .eq("id", conversation_id)
      .maybeSingle();

    if (!conv) return new Response(JSON.stringify({ status: "not_found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (conv.is_group) return new Response(JSON.stringify({ status: "skipped_group" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (conv.cliente_id || conv.lead_id) {
      return new Response(JSON.stringify({ status: "already_resolved" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const norm = normalizePhone(conv.cliente_telefone || conv.remote_jid);
    const log = async (status: string, reason: string, matched?: { type: string; id: string }) => {
      await supabase.from("wa_conversation_resolution_logs").insert({
        tenant_id: conv.tenant_id,
        conversation_id: conv.id,
        status,
        matched_entity_type: matched?.type ?? null,
        matched_entity_id: matched?.id ?? null,
        phone_raw: conv.cliente_telefone ?? conv.remote_jid,
        phone_variants: norm?.variants ?? [],
        reason: `${reason} [source:${source}]`,
      });
    };

    if (!norm?.variants.length) {
      await log("error", "Telefone inválido");
      return new Response(JSON.stringify({ status: "error" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Match clientes
    const { data: clientes } = await supabase
      .from("clientes").select("id")
      .eq("tenant_id", conv.tenant_id)
      .in("telefone_normalized", norm.variants).limit(5);

    if (clientes && clientes.length === 1) {
      await supabase.from("wa_conversations")
        .update({ cliente_id: clientes[0].id })
        .eq("id", conv.id).eq("tenant_id", conv.tenant_id);
      await log("resolved", "Match único em clientes (auto)", { type: "cliente", id: clientes[0].id });
      return new Response(JSON.stringify({ status: "resolved", entity: "cliente" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (clientes && clientes.length > 1) {
      await log("ambiguous", `${clientes.length} clientes possíveis`);
      return new Response(JSON.stringify({ status: "ambiguous" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Match leads
    const { data: leads } = await supabase
      .from("leads").select("id")
      .eq("tenant_id", conv.tenant_id)
      .in("telefone_normalized", norm.variants).limit(5);

    if (leads && leads.length === 1) {
      await supabase.from("wa_conversations")
        .update({ lead_id: leads[0].id })
        .eq("id", conv.id).eq("tenant_id", conv.tenant_id);
      await log("resolved", "Match único em leads (auto)", { type: "lead", id: leads[0].id });
      return new Response(JSON.stringify({ status: "resolved", entity: "lead" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (leads && leads.length > 1) {
      await log("ambiguous", `${leads.length} leads possíveis`);
      return new Response(JSON.stringify({ status: "ambiguous" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await log("not_found", "Sem match (auto)");
    return new Response(JSON.stringify({ status: "not_found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[wa-resolve-conversation] error:", e?.message);
    return new Response(JSON.stringify({ error: e?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
