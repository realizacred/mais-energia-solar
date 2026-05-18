/**
 * proposal-transition
 * 
 * Backend-driven status transitions for proposals.
 * Handles: status update, commission generation/cancellation, state validation.
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
  'draft':     ['generated'],
  'generated': ['accepted', 'rejected', 'draft'],
  'sent':      ['accepted', 'rejected', 'expired'],
  'accepted':  ['rejected'],
  'rejected':  ['draft'],
  'expired':   ['draft'],
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

    // Resolve caller's tenant_id for isolation (R01)
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

    // 1. Load current proposta — filtered by tenant_id (S1 fix)
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

    // 2. Validate and Normalize transition
    const currentStatus = proposta.status || "draft";
    
    // Normalize new_status from PT-BR if necessary
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

    if (!canTransition(currentStatus, canonicalStatus)) {
      // Also try normalizing currentStatus if it's in PT-BR in the DB
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

    // 3. Update status via RPC (centralized business logic)
    // This handles: status update, versions sync, deal status, project snapshot, siblings rejection.
    const { data: rpcResult, error: rpcErr } = await admin.rpc("proposal_update_status", {
      p_proposta_id: proposta_id,
      p_new_status: canonicalStatus,
      p_motivo: motivo || null
    });

    if (rpcErr || (rpcResult as any)?.error) {
      console.error("[proposal-transition] RPC error:", rpcErr || (rpcResult as any)?.error);
      throw new Error((rpcResult as any)?.error || "Erro ao atualizar status via RPC");
    }

    // Use canonical status from here on
    const finalStatus = canonicalStatus;

    // 4a. Sync proposta_versoes.status (latest version only — by ID)
    try {
      const versaoStatus = new_status;

      // Fetch the exact ID of the latest version first
      const { data: latestVersao } = await admin
        .from("proposta_versoes")
        .select("id")
        .eq("proposta_id", proposta_id)
        .order("versao_numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestVersao?.id) {
        await admin
          .from("proposta_versoes")
          .update({ status: versaoStatus })
          .eq("id", latestVersao.id);
      }
    } catch (syncErr) {
      console.error("[proposal-transition] Erro ao sincronizar proposta_versoes.status:", syncErr);
    }

    // 4b. On accept: reject sibling proposals and clear their is_principal
    if (new_status === "accepted" && proposta.projeto_id) {
      // Clear is_principal on all siblings
      await admin
        .from("propostas_nativas")
        .update({ is_principal: false })
        .eq("projeto_id", proposta.projeto_id)
        .neq("id", proposta_id);

      // Reject actionable siblings
      const rejectableStatuses = ["generated", "sent", "draft"];
      const { data: siblings } = await admin
        .from("propostas_nativas")
        .select("id, status")
        .eq("projeto_id", proposta.projeto_id)
        .neq("id", proposta_id)
        .in("status", rejectableStatuses);

      if (siblings && siblings.length > 0) {
        const siblingIds = siblings.map((s: any) => s.id);
        await admin
          .from("propostas_nativas")
          .update({
            status: "rejected",
            recusada_at: now,
            recusa_motivo: "Outra proposta do projeto foi aceita",
          })
          .in("id", siblingIds);
      }

      // Cancel existing generated documents for this project (old contracts become invalid)
      // RB-40: NEVER cancel documents with signature_status = 'signed' — they are INTOUCHABLE
      try {
        await admin
          .from("generated_documents")
          .update({
            status: "cancelled",
            observacao: "Nova proposta aceita",
            updated_at: now,
          })
          .eq("deal_id", proposta.projeto_id)
          .eq("status", "generated")
          .neq("signature_status", "signed");
      } catch (docCancelErr) {
        console.error("[proposal-transition] Erro ao cancelar documentos:", docCancelErr);
        // Non-blocking — don't fail the transition
      }
    }

    // 4c. Sync deals.status when proposal status changes
    // This ensures the kanban filter "Ganho" reflects accepted proposals
    try {
      const dealLookupId = proposta.projeto_id;
      if (dealLookupId) {
        // Find the deal linked to this project
        const { data: linkedDeal } = await admin
          .from("deals")
          .select("id, status")
          .eq("projeto_id", dealLookupId)
          .maybeSingle();

        if (linkedDeal) {
          if (new_status === "accepted" && linkedDeal.status !== "won") {
            await admin
              .from("deals")
              .update({ status: "won" })
              .eq("id", linkedDeal.id);
          } else if (
            (new_status === "rejected" || new_status === "cancelada") &&
            currentStatus === "accepted" &&
            linkedDeal.status === "won"
          ) {
            // Revert deal to open when accepted proposal is rejected/cancelled
            // Only if no other accepted proposal exists for this project
            const { count: otherAccepted } = await admin
              .from("propostas_nativas")
              .select("id", { count: "exact", head: true })
              .eq("projeto_id", dealLookupId)
              .eq("status", "accepted")
              .neq("id", proposta_id);

            if ((otherAccepted ?? 0) === 0) {
              await admin
                .from("deals")
                .update({ status: "open" })
                .eq("id", linkedDeal.id);
            }
          }
        }
      }
    } catch (dealSyncErr) {
      console.error("[proposal-transition] Erro ao sincronizar deals.status:", dealSyncErr);
      // Non-blocking
    }

    let commission_pct: number | null = null;

    // 5. Commission on accept (with idempotency — check for existing commission)
    if (new_status === "accepted") {
      try {
        // Check if commission already exists for this proposal (tenant-isolated)
        const { data: existingComm } = await admin
          .from("comissoes")
          .select("id")
          .eq("tenant_id", proposta.tenant_id)
          .eq("projeto_id", proposta.projeto_id)
          .neq("status", "cancelada")
          .maybeSingle();

        if (!existingComm) {
          // Find versão to get valor_total and potencia_kwp
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
        } else {
          // Commission already exists for projeto — skipping (idempotent)
        }
      } catch (commErr) {
        console.error("Erro ao gerar comissão:", commErr);
        // Don't fail the transition — commission error is non-blocking
      }
    }

    // 6. Cancel commissions on reject/cancel/revert-accept
    if ((new_status === "rejected" || new_status === "cancelada" || (currentStatus === "accepted" && new_status === "generated")) && proposta.projeto_id) {
      await admin
        .from("comissoes")
        .update({ status: "cancelada", observacoes: motivo || `Proposta ${new_status} (aceite revertido)` })
        .eq("projeto_id", proposta.projeto_id)
        .eq("status", "pendente");
    }

    // 6b. Cancel generated documents when accepted proposal is cancelled or reverted
    if ((new_status === "cancelada" || new_status === "generated") && currentStatus === "accepted" && proposta.projeto_id) {
      try {
        await admin
          .from("generated_documents")
          .update({
            status: "cancelled",
            observacao: "Proposta cancelada",
            updated_at: now,
          })
          .eq("deal_id", proposta.projeto_id)
          .eq("status", "generated")
          .neq("signature_status", "signed");
      } catch (docCancelErr) {
        console.error("[proposal-transition] Erro ao cancelar documentos (proposta cancelada):", docCancelErr);
      }
    }

    // 7. Log event in proposal_events (standardized type names)
    const eventTypeMap: Record<string, string> = {
      accepted: "proposta_aceita",
      rejected: "proposta_recusada",
      sent: "proposta_enviada",
      viewed: "proposta_visualizada",
      generated: currentStatus === "accepted" ? "aceite_revertido" : currentStatus === "rejected" ? "recusa_revertida" : "proposta_gerada",
    };
    const eventType = eventTypeMap[new_status] || new_status;

    try {
      await admin.from("proposal_events").insert({
        proposta_id: proposta_id,
        tipo: eventType,
        payload: {
          previous_status: currentStatus,
          new_status,
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
        new_status,
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
