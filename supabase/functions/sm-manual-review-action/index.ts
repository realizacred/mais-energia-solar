// sm-manual-review-action — Operações sobre sm_manual_review.
// Governança: AGENTS.md RB-23 (sem console.log), RB-69 (consultar antes de codar),
// super_admin gate obrigatório, auditoria em super_admin_actions.
// Ações: list, detail, resolve_link, resolve_ignore, resolve_create, retry, mark_resolved.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MODULE = "sm-manual-review-action";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: who } = await userClient.auth.getUser();
    const userId = who?.user?.id;
    if (!userId) return json({ error: "Invalid token" }, 401);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!roles?.some((r: { role: string }) => r.role === "super_admin")) {
      return json({ error: "Forbidden: super_admin required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    const audit = async (details: Record<string, unknown>) => {
      await admin.from("super_admin_actions").insert({
        admin_user_id: userId,
        action: `sm_manual_review.${action}`,
        target_tenant_id: details.tenant_id ?? null,
        details,
        ip_address:
          req.headers.get("x-forwarded-for") ||
          req.headers.get("cf-connecting-ip") ||
          null,
      });
    };

    switch (action) {
      case "list": {
        const { data, error } = await admin
          .from("sm_manual_review")
          .select("*")
          .order("resolved_at", { ascending: true, nullsFirst: true })
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;

        // Enriquecer: nome SM (sm_clientes_raw), CRM cliente, propostas relacionadas
        const items: any[] = [];
        for (const row of data ?? []) {
          let smPayload: any = null;
          if (row.source_entity_type === "cliente") {
            const { data: smRow } = await admin
              .from("sm_clientes_raw")
              .select("payload, external_id")
              .eq("tenant_id", row.tenant_id)
              .eq("external_id", row.source_entity_id)
              .maybeSingle();
            smPayload = smRow?.payload ?? null;
          }
          let crmClient: any = null;
          if (row.conflict_entity_id && row.conflict_entity_type === "cliente") {
            const { data: cli } = await admin
              .from("clientes")
              .select("id, nome, telefone, telefone_normalized, email, cpf_cnpj, external_id")
              .eq("id", row.conflict_entity_id)
              .maybeSingle();
            crmClient = cli;
          }
          items.push({ ...row, sm_payload: smPayload, crm_client: crmClient });
        }
        return json({ items });
      }

      case "detail": {
        const id = String(body?.id ?? "");
        if (!id) return json({ error: "id required" }, 400);
        const { data: row, error } = await admin
          .from("sm_manual_review")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error || !row) return json({ error: "not found" }, 404);

        const { data: smRow } = await admin
          .from("sm_clientes_raw")
          .select("payload, external_id")
          .eq("tenant_id", row.tenant_id)
          .eq("external_id", row.source_entity_id)
          .maybeSingle();

        let crmClient: any = null;
        let projetos: any[] = [];
        let deals: any[] = [];
        if (row.conflict_entity_id) {
          const { data: cli } = await admin
            .from("clientes")
            .select("*")
            .eq("id", row.conflict_entity_id)
            .maybeSingle();
          crmClient = cli;
          const { data: pr } = await admin
            .from("projetos")
            .select("id, nome, valor_total, deal_id, external_source, external_id")
            .eq("cliente_id", row.conflict_entity_id)
            .limit(50);
          projetos = pr ?? [];
          const { data: dl } = await admin
            .from("deals")
            .select("id, titulo, valor, pipeline_id, stage_id")
            .eq("cliente_id", row.conflict_entity_id)
            .limit(50);
          deals = dl ?? [];
        }

        return json({ row, sm_payload: smRow?.payload ?? null, crm_client: crmClient, projetos, deals });
      }

      case "resolve_link": {
        // Vincula sm_cliente -> CRM cliente existente (conflict_entity_id ou override)
        const id = String(body?.id ?? "");
        const targetClienteId = String(body?.target_cliente_id ?? "");
        const notes = body?.notes ? String(body.notes) : null;
        if (!id || !targetClienteId) return json({ error: "id and target_cliente_id required" }, 400);

        const { data: row, error: e1 } = await admin
          .from("sm_manual_review").select("*").eq("id", id).maybeSingle();
        if (e1 || !row) return json({ error: "not found" }, 404);

        const { error: linkErr } = await admin.from("external_entity_links").upsert(
          {
            tenant_id: row.tenant_id,
            entity_type: row.source_entity_type,
            entity_id: targetClienteId,
            source: "solarmarket",
            source_entity_type: row.source_entity_type,
            source_entity_id: row.source_entity_id,
            promoted_at: new Date().toISOString(),
            metadata: { resolved_via: "manual_review_link", reviewer: userId },
          },
          { onConflict: "tenant_id,source,source_entity_type,source_entity_id" },
        );
        if (linkErr) throw linkErr;

        await admin.from("sm_manual_review").update({
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
          resolution_notes: notes ?? `Vinculado a cliente ${targetClienteId}`,
          updated_at: new Date().toISOString(),
        }).eq("id", id);

        await audit({ tenant_id: row.tenant_id, review_id: id, target_cliente_id: targetClienteId, sm_id: row.source_entity_id });
        return json({ success: true });
      }

      case "resolve_create": {
        // Cria novo cliente com telefone NULL (para evitar colisão) e vincula.
        const id = String(body?.id ?? "");
        const notes = body?.notes ? String(body.notes) : null;
        if (!id) return json({ error: "id required" }, 400);
        const { data: row, error: e1 } = await admin
          .from("sm_manual_review").select("*").eq("id", id).maybeSingle();
        if (e1 || !row) return json({ error: "not found" }, 404);

        const meta = (row.conflict_metadata ?? {}) as any;
        const { data: smRow } = await admin
          .from("sm_clientes_raw")
          .select("payload")
          .eq("tenant_id", row.tenant_id)
          .eq("external_id", row.source_entity_id)
          .maybeSingle();
        const p: any = smRow?.payload ?? {};

        const nome = (meta?.sm_name as string) || p?.name || p?.nome || "Cliente SM";
        const telefoneRaw = p?.phone || p?.telefone || meta?.sm_phone_canonical || null;
        const observacoes = `Criado via Manual Review (homônimo). Telefone original SM: ${telefoneRaw ?? "—"}. SM id: ${row.source_entity_id}`;

        const { data: novo, error: insErr } = await admin.from("clientes").insert({
          tenant_id: row.tenant_id,
          nome,
          telefone: null,
          email: p?.email ?? null,
          cpf_cnpj: p?.document ?? p?.cpf_cnpj ?? null,
          observacoes,
          external_source: "solarmarket",
          external_id: String(row.source_entity_id),
        }).select("id").single();
        if (insErr) throw insErr;

        await admin.from("external_entity_links").upsert(
          {
            tenant_id: row.tenant_id,
            entity_type: "cliente",
            entity_id: novo.id,
            source: "solarmarket",
            source_entity_type: "cliente",
            source_entity_id: row.source_entity_id,
            promoted_at: new Date().toISOString(),
            metadata: { resolved_via: "manual_review_create_new", reviewer: userId },
          },
          { onConflict: "tenant_id,source,source_entity_type,source_entity_id" },
        );

        await admin.from("sm_manual_review").update({
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
          resolution_notes: notes ?? `Novo cliente criado: ${novo.id}`,
          updated_at: new Date().toISOString(),
        }).eq("id", id);

        await audit({ tenant_id: row.tenant_id, review_id: id, novo_cliente_id: novo.id, sm_id: row.source_entity_id });
        return json({ success: true, cliente_id: novo.id });
      }

      case "resolve_ignore":
      case "mark_resolved": {
        const id = String(body?.id ?? "");
        const notes = body?.notes ? String(body.notes) : (action === "resolve_ignore" ? "Ignorado" : "Marcado como resolvido");
        if (!id) return json({ error: "id required" }, 400);
        const { data: row } = await admin.from("sm_manual_review").select("tenant_id, source_entity_id").eq("id", id).maybeSingle();
        const { error } = await admin.from("sm_manual_review").update({
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
          resolution_notes: notes,
          updated_at: new Date().toISOString(),
        }).eq("id", id);
        if (error) throw error;
        await audit({ tenant_id: row?.tenant_id, review_id: id, sm_id: row?.source_entity_id, notes });
        return json({ success: true });
      }

      case "retry": {
        // Remove da quarentena e dispara sm-promote pontual.
        const id = String(body?.id ?? "");
        if (!id) return json({ error: "id required" }, 400);
        const { data: row, error: e1 } = await admin
          .from("sm_manual_review").select("*").eq("id", id).maybeSingle();
        if (e1 || !row) return json({ error: "not found" }, 404);

        await admin.from("sm_manual_review").delete().eq("id", id);

        const { data: invokeData, error: invokeErr } = await admin.functions.invoke("sm-promote", {
          body: {
            action: "promote-all",
            payload: {
              tenant_id: row.tenant_id,
              scope: row.source_entity_type,
              only_source_ids: [row.source_entity_id],
              dry_run: false,
            },
          },
          headers: { "x-sm-internal-call": "manual-review-retry", "x-sm-tenant-override": row.tenant_id },
        });

        await audit({ tenant_id: row.tenant_id, review_id: id, sm_id: row.source_entity_id, retry_result: invokeErr?.message ?? "ok" });
        return json({ success: !invokeErr, retry: invokeData ?? null, error: invokeErr?.message ?? null });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[${MODULE}]`, msg);
    return json({ error: msg }, 500);
  }
});
