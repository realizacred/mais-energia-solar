/**
 * proposal-transition
 * 
 * Backend-driven status transitions for proposals.
 * Handles: status update (via RPC), commission generation/cancellation, state validation.
 * Includes: idempotency checks, event logging, transactional consistency.
 * Frontend MUST NOT handle commission logic anymore.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── State Machine ────────────────────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  'draft':     ['generated', 'cancelled'],
  'generated': ['sent', 'cancelled', 'draft'],
  'sent':      ['viewed', 'expired', 'cancelled', 'generated'], 
  'viewed':    ['accepted', 'rejected', 'expired', 'cancelled', 'generated'],
  'accepted':  ['generated', 'cancelled'], // Proibir rejected direto (exige revert formal)
  'rejected':  ['draft', 'generated'],
  'expired':   ['generated', 'draft'],
  'cancelled': ['draft'],
  'excluida':  [],
  'arquivada': []
};

function canTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { proposta_id, new_status, motivo, data: transitionDate } = body;

    if (!proposta_id || !new_status) {
      return new Response(
        JSON.stringify({ error: "proposta_id e new_status são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve caller's tenant_id for isolation
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!callerProfile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Perfil ou tenant não encontrado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const callerTenantId = callerProfile.tenant_id;

    // 1. Load current proposta — filtered by tenant_id
    const { data: proposta, error: pErr } = await admin
      .from("propostas_nativas")
      .select("id, status, lead_id, cliente_id, projeto_id, tenant_id")
      .eq("id", proposta_id)
      .eq("tenant_id", callerTenantId)
      .single();

    if (pErr || !proposta) {
      return new Response(
        JSON.stringify({ error: "Proposta não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Normalize and Validate transition
    const currentStatus = proposta.status || "draft";
    
    // Normalize new_status from PT-BR if necessary (aliases)
    let canonicalStatus = new_status;
    const normalizationMap: Record<string, string> = {
      'rascunho':  'draft',
      'gerada':    'generated',
      'enviada':   'sent',
      'vista':     'viewed',
      'aceita':    'accepted',
      'recusada':  'rejected',
      'expirada':  'expired',
      'cancelada': 'cancelled'
    };
    if (normalizationMap[new_status]) {
      canonicalStatus = normalizationMap[new_status];
    }

    const currentCanonical = normalizationMap[currentStatus] || currentStatus;

    if (!canTransition(currentCanonical, canonicalStatus)) {
      return new Response(
        JSON.stringify({
          error: `Transição inválida: ${currentStatus} → ${canonicalStatus}`,
          allowed: VALID_TRANSITIONS[currentCanonical] || [],
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2b. Idempotency check — prevent duplicate terminal transitions
    if (["accepted", "rejected", "cancelled"].includes(canonicalStatus)) {
      const { data: existingEvent } = await admin
        .from("proposal_events")
        .select("id")
        .eq("proposta_id", proposta_id)
        .eq("tipo", canonicalStatus === "accepted" ? "proposta_aceita" : canonicalStatus === "rejected" ? "proposta_recusada" : "proposta_cancelada")
        .maybeSingle();

      if (existingEvent) {
        return new Response(
          JSON.stringify({
            success: true,
            idempotent: true,
            message: `Transição '${canonicalStatus}' já registrada anteriormente`,
            previous_status: currentStatus,
            new_status: canonicalStatus,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Update status via RPC (Centralized Domain Logic)
    // RPC proposal_update_status handles: status update, versions sync, deal won status, 
    // project value snapshot, siblings rejection, and basic metadata.
    const { data: rpcResult, error: rpcErr } = await admin.rpc("proposal_update_status", {
      p_proposta_id: proposta_id,
      p_new_status: canonicalStatus,
      p_motivo: motivo || null
    });

    if (rpcErr || (rpcResult as any)?.error) {
      console.error("[proposal-transition] RPC error:", rpcErr || (rpcResult as any)?.error);
      return new Response(
        JSON.stringify({ error: (rpcResult as any)?.error || "Erro ao processar atualização no banco" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const finalStatus = canonicalStatus;
    const now = new Date().toISOString();
    let commission_pct: number | null = null;

    // 4. Commission logic (Edge Function only — complex for SQL)
    if (finalStatus === "accepted") {
      try {
        // Check if commission already exists for this proposal
        const { data: existingComm } = await admin
          .from("comissoes")
          .select("id")
          .eq("projeto_id", proposta.projeto_id)
          .neq("status", "cancelada")
          .maybeSingle();

        if (!existingComm && proposta.projeto_id) {
          // Find version to get financial data
          const { data: versao } = await admin
            .from("proposta_versoes")
            .select("potencia_kwp, valor_total")
            .eq("proposta_id", proposta_id)
            .order("versao_numero", { ascending: false })
            .limit(1)
            .single();

          const valorTotal = versao?.valor_total || 0;
          const potenciaKwp = versao?.potencia_kwp || 0;

          if (proposta.lead_id && valorTotal > 0) {
            const { data: lead } = await admin
              .from("leads")
              .select("consultor_id")
              .eq("id", proposta.lead_id)
              .single();

            const consultorId = lead?.consultor_id;
            if (consultorId) {
              const { data: plan } = await admin
                .from("commission_plans")
                .select("parameters")
                .eq("tenant_id", proposta.tenant_id)
                .eq("is_active", true)
                .limit(1)
                .maybeSingle();

              const percentual = (plan?.parameters as any)?.percentual ?? 5;

              // Get cliente nome for description
              let clienteNome = "Cliente";
              if (proposta.cliente_id) {
                const { data: cl } = await admin
                  .from("clientes")
                  .select("nome")
                  .eq("id", proposta.cliente_id)
                  .single();
                clienteNome = cl?.nome || clienteNome;
              }

              const dtNow = new Date();
              await admin.from("comissoes").insert({
                tenant_id: proposta.tenant_id,
                consultor_id: consultorId,
                cliente_id: proposta.cliente_id,
                projeto_id: proposta.projeto_id || null,
                descricao: `Proposta aceita - ${clienteNome} (${potenciaKwp}kWp)`,
                valor_base: valorTotal,
                percentual_comissao: percentual,
                valor_comissao: (valorTotal * percentual) / 100,
                mes_referencia: dtNow.getMonth() + 1,
                ano_referencia: dtNow.getFullYear(),
                status: "pendente",
              });

              commission_pct = percentual;
            }
          }
        }
      } catch (commErr) {
        console.error("Erro ao gerar comissão:", commErr);
      }
    }

    // 5. Cancel commissions on revert/reject
    if ((finalStatus === "rejected" || finalStatus === "cancelled" || (currentCanonical === "accepted" && finalStatus === "generated")) && proposta.projeto_id) {
      await admin
        .from("comissoes")
        .update({ status: "cancelada", observacoes: motivo || `Proposta ${finalStatus} (aceite revertido)` })
        .eq("projeto_id", proposta.projeto_id)
        .eq("status", "pendente");
    }

    // 6. Log event in proposal_events
    const eventTypeMap: Record<string, string> = {
      accepted: "proposta_aceita",
      rejected: "proposta_recusada",
      sent: "proposta_enviada",
      viewed: "proposta_visualizada",
      generated: currentCanonical === "accepted" ? "aceite_revertido" : currentCanonical === "rejected" ? "recusa_revertida" : "proposta_gerada",
    };
    const eventType = eventTypeMap[finalStatus] || finalStatus;

    try {
      await admin.from("proposal_events").insert({
        proposta_id: proposta_id,
        tipo: eventType,
        payload: {
          previous_status: currentStatus,
          new_status: finalStatus,
          motivo: motivo || null,
          commission_pct,
          transition_date: transitionDate || now,
        },
        user_id: userId,
        tenant_id: proposta.tenant_id,
      });
    } catch (evtErr) {
      console.error("Erro ao registrar evento:", evtErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        previous_status: currentStatus,
        new_status: finalStatus,
        commission_pct,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("proposal-transition error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});