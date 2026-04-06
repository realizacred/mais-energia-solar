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
  rascunho: ["gerada"],
  gerada: ["enviada", "aceita", "recusada", "cancelada"],
  enviada: ["vista", "aceita", "recusada", "cancelada"],
  vista: ["aceita", "recusada", "cancelada"],
  aceita: ["cancelada"],
  recusada: ["gerada", "enviada"],
  expirada: ["gerada"],
  cancelada: [],
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

    // 1. Load current proposta
    const { data: proposta, error: pErr } = await admin
      .from("propostas_nativas")
      .select("id, status, lead_id, cliente_id, projeto_id, tenant_id")
      .eq("id", proposta_id)
      .single();

    if (pErr || !proposta) {
      return new Response(
        JSON.stringify({ error: "Proposta não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validate transition
    const currentStatus = proposta.status || "rascunho";
    if (!canTransition(currentStatus, new_status)) {
      return new Response(
        JSON.stringify({
          error: `Transição inválida: ${currentStatus} → ${new_status}`,
          allowed: VALID_TRANSITIONS[currentStatus] || [],
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2b. Idempotency check — prevent duplicate terminal transitions
    if (["aceita", "recusada", "cancelada"].includes(new_status)) {
      const { data: existingEvent } = await admin
        .from("proposal_events")
        .select("id")
        .eq("proposta_id", proposta_id)
        .eq("tipo", new_status)
        .maybeSingle();

      if (existingEvent) {
        return new Response(
          JSON.stringify({
            success: true,
            idempotent: true,
            message: `Transição '${new_status}' já registrada anteriormente`,
            previous_status: currentStatus,
            new_status,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Build update payload
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { status: new_status };

    if (new_status === "enviada") updateData.enviada_at = now;
    if (new_status === "aceita") {
      updateData.aceita_at = transitionDate || now;
      updateData.aceite_motivo = motivo || null;
    }
    if (new_status === "recusada") {
      updateData.recusada_at = transitionDate || now;
      updateData.recusa_motivo = motivo || null;
    }
    if (new_status !== "aceita") {
      updateData.aceita_at = null;
      updateData.aceite_motivo = null;
    }
    if (new_status !== "recusada") {
      updateData.recusada_at = null;
      updateData.recusa_motivo = null;
    }

    // 4. Update status + set is_principal if accepting
    if (new_status === "aceita") {
      updateData.is_principal = true;
    }

    const { error: updateErr } = await admin
      .from("propostas_nativas")
      .update(updateData)
      .eq("id", proposta_id);

    if (updateErr) throw updateErr;

    // 4a. Sync proposta_versoes.status (latest version)
    try {
      const statusMap: Record<string, string> = {
        rascunho: "draft",
        gerada: "generated",
        enviada: "sent",
        vista: "viewed",
        aceita: "accepted",
        recusada: "rejected",
        expirada: "expired",
        cancelada: "cancelled",
      };
      const versaoStatus = statusMap[new_status] || new_status;
      await admin
        .from("proposta_versoes")
        .update({ status: versaoStatus })
        .eq("proposta_id", proposta_id)
        .order("versao_numero", { ascending: false })
        .limit(1);
    } catch (syncErr) {
      console.error("[proposal-transition] Erro ao sincronizar proposta_versoes.status:", syncErr);
    }

    // 4b. On accept: reject sibling proposals and clear their is_principal
    if (new_status === "aceita" && proposta.projeto_id) {
      // Clear is_principal on all siblings
      await admin
        .from("propostas_nativas")
        .update({ is_principal: false })
        .eq("projeto_id", proposta.projeto_id)
        .neq("id", proposta_id);

      // Reject actionable siblings
      const rejectableStatuses = ["gerada", "enviada", "vista", "rascunho"];
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
            status: "recusada",
            recusada_at: now,
            recusa_motivo: "Outra proposta do projeto foi aceita",
          })
          .in("id", siblingIds);
      }
    }

    let commission_pct: number | null = null;

    // 5. Commission on accept (with idempotency — check for existing commission)
    if (new_status === "aceita") {
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

    // 6. Cancel commissions on reject/cancel
    if ((new_status === "recusada" || new_status === "cancelada") && proposta.projeto_id) {
      await admin
        .from("comissoes")
        .update({ status: "cancelada", observacoes: `Proposta ${new_status}` })
        .eq("projeto_id", proposta.projeto_id)
        .eq("status", "pendente");
    }

    // 7. Log event in proposal_events (standardized type names)
    const eventTypeMap: Record<string, string> = {
      aceita: "proposta_aceita",
      recusada: "proposta_recusada",
      enviada: "proposta_enviada",
      vista: "proposta_visualizada",
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
