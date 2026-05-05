// Gera sugestão de vínculo para conversa órfã usando IA + heurística.
// NÃO vincula. Apenas registra em wa_conversation_resolution_suggestions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function digitsOnly(s?: string | null) { return (s || "").replace(/\D/g, ""); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { conversation_id } = await req.json();
    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "conversation_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolver caller
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: profile } = await supabase
      .from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
    const tenantId = profile?.tenant_id;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_not_found" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: conv } = await supabase
      .from("wa_conversations")
      .select("id, tenant_id, remote_jid, cliente_telefone, cliente_nome, lead_id, cliente_id")
      .eq("id", conversation_id).eq("tenant_id", tenantId).maybeSingle();

    if (!conv) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (conv.cliente_id || conv.lead_id) {
      return new Response(JSON.stringify({ status: "already_resolved" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneDigits = digitsOnly(conv.cliente_telefone || conv.remote_jid);
    const last8 = phoneDigits.slice(-8);
    const last10 = phoneDigits.slice(-10);
    const waName = (conv.cliente_nome || "").trim();

    // Candidatos: telefones que terminam em últimos 8 dígitos OU nome parecido
    const [{ data: clientesPhone }, { data: leadsPhone }] = await Promise.all([
      supabase.from("clientes").select("id, nome, telefone, telefone_normalized, email")
        .eq("tenant_id", tenantId).ilike("telefone_normalized", `%${last8}`).limit(10),
      supabase.from("leads").select("id, nome, telefone, telefone_normalized, email")
        .eq("tenant_id", tenantId).ilike("telefone_normalized", `%${last8}`).limit(10),
    ]);

    let clientesName: any[] = [];
    let leadsName: any[] = [];
    if (waName.length >= 3) {
      const [{ data: cn }, { data: ln }] = await Promise.all([
        supabase.from("clientes").select("id, nome, telefone, telefone_normalized, email")
          .eq("tenant_id", tenantId).ilike("nome", `%${waName.split(" ")[0]}%`).limit(10),
        supabase.from("leads").select("id, nome, telefone, telefone_normalized, email")
          .eq("tenant_id", tenantId).ilike("nome", `%${waName.split(" ")[0]}%`).limit(10),
      ]);
      clientesName = cn ?? [];
      leadsName = ln ?? [];
    }

    const candidates = [
      ...(clientesPhone ?? []).map((c: any) => ({ ...c, type: "cliente" })),
      ...(clientesName ?? []).map((c: any) => ({ ...c, type: "cliente" })),
      ...(leadsPhone ?? []).map((l: any) => ({ ...l, type: "lead" })),
      ...(leadsName ?? []).map((l: any) => ({ ...l, type: "lead" })),
    ];
    // dedup
    const seen = new Set<string>();
    const uniqueCandidates = candidates.filter((c) => {
      const k = `${c.type}:${c.id}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

    if (!uniqueCandidates.length) {
      return new Response(JSON.stringify({ status: "no_candidates" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Heurística local primeiro (sem IA): se um único candidato com telefone last10 match
    const strongPhoneMatches = uniqueCandidates.filter(
      (c) => digitsOnly(c.telefone_normalized || c.telefone).slice(-10) === last10 && last10.length >= 10
    );

    let chosen: any = null;
    let confidence = 0;
    let reason = "";
    let method = "heuristic";

    if (strongPhoneMatches.length === 1) {
      chosen = strongPhoneMatches[0];
      confidence = 0.92;
      reason = "Telefone confere (últimos 10 dígitos) — match único.";
    } else {
      // Pede IA pra escolher (Gemini direto / OpenAI fallback)
      const hasAi = !!Deno.env.get("GEMINI_API_KEY") || !!Deno.env.get("OPENAI_API_KEY");
      if (hasAi) {
        const prompt = `Você analisa candidatos de CRM para vincular a uma conversa de WhatsApp órfã.
Conversa:
- Telefone: ${conv.cliente_telefone || conv.remote_jid}
- Nome WhatsApp: ${waName || "(sem nome)"}

Candidatos (até 20):
${uniqueCandidates.slice(0, 20).map((c, i) => `${i + 1}. [${c.type}] ${c.nome || "(sem nome)"} | tel: ${c.telefone || c.telefone_normalized || "—"} | email: ${c.email || "—"}`).join("\n")}

Escolha 1 candidato OU diga "nenhum". Responda APENAS JSON:
{"index": <1-based ou 0>, "confidence": <0..1>, "reason": "<motivo curto>"}`;

        try {
          const { callAi } = await import("../_shared/aiCallNoLovable.ts");
          const data = await callAi({
            tier: "flash",
            jsonMode: true,
            messages: [{ role: "user", content: prompt }],
          });
          const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
          if (parsed.index && parsed.index > 0 && parsed.index <= uniqueCandidates.length) {
            chosen = uniqueCandidates[parsed.index - 1];
            confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5));
            reason = parsed.reason || "Sugestão IA";
            method = "ai";
          }
        } catch (e: any) {
          console.warn("[wa-ai-suggest-link] AI fallback:", e?.message);
        }
      }
      if (!chosen) {
        // Fallback mais fraco: primeiro candidato
        chosen = uniqueCandidates[0];
        confidence = 0.4;
        reason = "Único candidato disponível (baixa confiança).";
      }
    }

    // Expira sugestões pendentes anteriores da mesma conversa
    await supabase.from("wa_conversation_resolution_suggestions")
      .update({ status: "expired" })
      .eq("conversation_id", conv.id).eq("status", "pending");

    const { data: inserted, error: insErr } = await supabase
      .from("wa_conversation_resolution_suggestions")
      .insert({
        tenant_id: tenantId,
        conversation_id: conv.id,
        suggested_entity_type: chosen.type,
        suggested_entity_id: chosen.id,
        confidence,
        reason,
        evidence: {
          method,
          candidate_count: uniqueCandidates.length,
          conversation_phone: conv.cliente_telefone || conv.remote_jid,
          conversation_name: waName,
          chosen_name: chosen.nome,
          chosen_phone: chosen.telefone,
        },
      })
      .select("id, suggested_entity_type, suggested_entity_id, confidence, reason")
      .single();

    if (insErr) throw insErr;

    return new Response(JSON.stringify({
      status: "suggested",
      suggestion: inserted,
      candidate: { id: chosen.id, type: chosen.type, nome: chosen.nome },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[wa-ai-suggest-link] error:", e?.message);
    return new Response(JSON.stringify({ error: e?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
