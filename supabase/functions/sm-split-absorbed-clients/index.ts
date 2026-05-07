/**
 * sm-split-absorbed-clients
 *
 * Corrige resíduo da antiga dedup-por-telefone: clientes CRM que receberam
 * MAIS DE UM sm_client_id em external_entity_links (violação 1:1).
 *
 * Para cada par (cliente_mae, sm_id_absorvido) — ou seja, cada link extra
 * além do "primário" (o mais antigo do cliente-mãe) — a função:
 *   1. Lê sm_clientes_raw.payload do sm_id absorvido.
 *   2. Cria UM novo cliente próprio (1:1).
 *   3. Move external_entity_links daquele sm_id para o cliente novo.
 *   4. Move projetos cujo external_id corresponde a um sm_projeto_id daquele sm_client_id.
 *   5. Move propostas cujo external_id corresponde a um sm_proposta_id daquele sm_client_id.
 *   6. Atualiza deals.customer_id quando o deal está atrelado a um projeto movido.
 *
 * Modos:
 *   - dry_run=true (default): NÃO altera nada. Retorna plano detalhado.
 *   - dry_run=false: aplica em transações por par.
 *
 * Restrições:
 *   - Apenas super_admin.
 *   - NÃO toca WhatsApp, billing, recebimentos, propostas/projetos não-SM.
 *   - NÃO deleta clientes-mãe.
 *   - NÃO toca clientes que já são 1:1.
 *
 * Telemetria: solarmarket_promotion_logs (step='split_absorbed').
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Plan {
  cliente_mae_id: string;
  cliente_mae_nome: string | null;
  sm_id_absorvido: string;
  novo_cliente: {
    nome: string | null;
    telefone: string | null;
    cpf_cnpj: string | null;
    email: string | null;
    cliente_code: string;
  };
  projetos_a_mover: Array<{ id: string; external_id: string | null; nome: string | null }>;
  propostas_a_mover: Array<{ id: string; external_id: string | null }>;
  deals_a_atualizar: Array<{ id: string; from_customer: string | null }>;
}

interface RunSummary {
  dry_run: boolean;
  pares_detectados: number;
  pares_processados: number;
  novos_clientes: number;
  projetos_movidos: number;
  propostas_movidas: number;
  deals_atualizados: number;
  erros: Array<{ par: string; error: string }>;
  plano: Plan[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: super_admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
    if (!isSuper) return json({ error: "forbidden: super_admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body?.dry_run !== false; // default true
    const limit: number = Math.min(Math.max(Number(body?.limit ?? 200), 1), 500);
    const onlyClientId: string | undefined = body?.only_cliente_mae_id;

    // 1) Encontrar pares absorvidos: para cada cliente_mae, todos os sm_ids
    //    EXCETO o primário (mais antigo) — esse fica no cliente-mãe.
    const { data: dupRows, error: dupErr } = await admin
      .from("external_entity_links")
      .select("entity_id, source_entity_id, created_at, source, source_entity_type, tenant_id")
      .eq("source", "solarmarket")
      .eq("source_entity_type", "cliente")
      .order("entity_id", { ascending: true })
      .order("created_at", { ascending: true });
    if (dupErr) return json({ error: `links: ${dupErr.message}` }, 500);

    const byClient = new Map<string, Array<{ sm: string; ts: string; tenant: string }>>();
    for (const r of dupRows ?? []) {
      const arr = byClient.get(r.entity_id) ?? [];
      arr.push({ sm: r.source_entity_id as string, ts: r.created_at as string, tenant: r.tenant_id as string });
      byClient.set(r.entity_id, arr);
    }
    const absorbedPairs: Array<{ cliente_mae: string; sm_id: string; tenant: string }> = [];
    for (const [cliId, arr] of byClient) {
      if (arr.length <= 1) continue;
      if (onlyClientId && cliId !== onlyClientId) continue;
      // mantém o primeiro (mais antigo); resto é absorvido
      for (let i = 1; i < arr.length; i++) {
        absorbedPairs.push({ cliente_mae: cliId, sm_id: arr[i].sm, tenant: arr[i].tenant });
      }
    }
    const planSlice = absorbedPairs.slice(0, limit);

    const summary: RunSummary = {
      dry_run: dryRun,
      pares_detectados: absorbedPairs.length,
      pares_processados: 0,
      novos_clientes: 0,
      projetos_movidos: 0,
      propostas_movidas: 0,
      deals_atualizados: 0,
      erros: [],
      plano: [],
    };

    // Cache de clientes-mãe (para nome no plano)
    const maeIds = Array.from(new Set(planSlice.map((p) => p.cliente_mae)));
    const { data: maeRows } = maeIds.length
      ? await admin.from("clientes").select("id, nome").in("id", maeIds)
      : { data: [] as any[] };
    const maeNome = new Map<string, string | null>(
      (maeRows ?? []).map((r: any) => [r.id, r.nome ?? null]),
    );

    for (const par of planSlice) {
      try {
        // 1.1 Carrega payload SM
        const { data: rawCli, error: rawErr } = await admin
          .from("sm_clientes_raw")
          .select("external_id, payload, tenant_id")
          .eq("tenant_id", par.tenant)
          .eq("external_id", par.sm_id)
          .maybeSingle();
        if (rawErr) throw new Error(`raw_cli: ${rawErr.message}`);
        if (!rawCli) throw new Error(`sm_clientes_raw not found for sm_id=${par.sm_id}`);

        const p = (rawCli.payload ?? {}) as Record<string, any>;
        const novo = {
          nome: (p.name ?? p.nome ?? null) as string | null,
          telefone: (p.phone ?? p.telefone ?? null) as string | null,
          cpf_cnpj: (p.document ?? p.cpf_cnpj ?? null) as string | null,
          email: (p.email ?? null) as string | null,
          cliente_code: `SM-${par.sm_id}`,
        };

        // 1.2 Descobrir projetos do sm_id absorvido (raw → external_id)
        const { data: rawProj } = await admin
          .from("sm_projetos_raw")
          .select("external_id, payload")
          .eq("tenant_id", par.tenant);
        const smProjetoIds: string[] = [];
        for (const rp of rawProj ?? []) {
          const pl = (rp.payload ?? {}) as Record<string, any>;
          const cliRef = String(pl.client_id ?? pl.cliente_id ?? pl.customer_id ?? "");
          if (cliRef && cliRef === String(par.sm_id)) {
            smProjetoIds.push(String(rp.external_id));
          }
        }

        let projetos: Array<{ id: string; external_id: string | null; nome: string | null; deal_id: string | null }> = [];
        if (smProjetoIds.length > 0) {
          const { data: pj } = await admin
            .from("projetos")
            .select("id, external_id, nome, deal_id, cliente_id")
            .eq("tenant_id", par.tenant)
            .eq("cliente_id", par.cliente_mae)
            .in("external_source", ["solar_market", "solarmarket"])
            .in("external_id", smProjetoIds);
          projetos = (pj ?? []).map((r: any) => ({
            id: r.id, external_id: r.external_id, nome: r.nome, deal_id: r.deal_id,
          }));
        }

        // 1.3 Descobrir propostas: via raw _sm_proposal_id e cliente_id no payload
        const { data: rawProp } = await admin
          .from("sm_propostas_raw")
          .select("external_id, payload")
          .eq("tenant_id", par.tenant);
        const smPropIds: string[] = [];
        for (const rp of rawProp ?? []) {
          const pl = (rp.payload ?? {}) as Record<string, any>;
          const cliRef = String(pl.client_id ?? pl.cliente_id ?? pl.customer_id ?? "");
          if (cliRef && cliRef === String(par.sm_id)) {
            // external_id canônico = parte antes de ":"
            const ext = String(rp.external_id).split(":")[0];
            smPropIds.push(ext);
          }
        }
        let propostas: Array<{ id: string; external_id: string | null }> = [];
        if (smPropIds.length > 0) {
          const { data: pn } = await admin
            .from("propostas_nativas")
            .select("id, external_id, cliente_id")
            .eq("tenant_id", par.tenant)
            .eq("cliente_id", par.cliente_mae)
            .in("external_source", ["solar_market", "solarmarket"])
            .in("external_id", smPropIds);
          propostas = (pn ?? []).map((r: any) => ({ id: r.id, external_id: r.external_id }));
        }

        // 1.4 Deals que serão atualizados (customer_id ← novo cliente) = deals dos projetos movidos
        const dealIds = projetos.map((p) => p.deal_id).filter(Boolean) as string[];
        let deals: Array<{ id: string; from_customer: string | null }> = [];
        if (dealIds.length > 0) {
          const { data: dl } = await admin
            .from("deals")
            .select("id, customer_id")
            .in("id", dealIds);
          deals = (dl ?? []).map((r: any) => ({ id: r.id, from_customer: r.customer_id }));
        }

        const plan: Plan = {
          cliente_mae_id: par.cliente_mae,
          cliente_mae_nome: maeNome.get(par.cliente_mae) ?? null,
          sm_id_absorvido: par.sm_id,
          novo_cliente: novo,
          projetos_a_mover: projetos.map((p) => ({ id: p.id, external_id: p.external_id, nome: p.nome })),
          propostas_a_mover: propostas,
          deals_a_atualizar: deals,
        };
        summary.plano.push(plan);
        summary.pares_processados++;

        if (dryRun) continue;

        // ============ APPLY ============
        // 2.1 Cria novo cliente
        const { data: newCli, error: insErr } = await admin
          .from("clientes")
          .insert({
            tenant_id: par.tenant,
            nome: novo.nome ?? `Cliente SM-${par.sm_id}`,
            telefone: novo.telefone,
            cpf_cnpj: novo.cpf_cnpj,
            email: novo.email,
            cliente_code: novo.cliente_code,
            external_id: par.sm_id,
            external_source: "solar_market",
          })
          .select("id")
          .single();
        if (insErr) throw new Error(`insert cliente: ${insErr.message}`);
        const novoClienteId = newCli!.id as string;
        summary.novos_clientes++;

        // 2.2 Move link
        const { error: linkErr } = await admin
          .from("external_entity_links")
          .update({ entity_id: novoClienteId })
          .eq("source", "solarmarket")
          .eq("source_entity_type", "cliente")
          .eq("source_entity_id", par.sm_id)
          .eq("entity_id", par.cliente_mae);
        if (linkErr) throw new Error(`update link: ${linkErr.message}`);

        // 2.3 Move projetos
        if (projetos.length > 0) {
          const { error: pjErr } = await admin
            .from("projetos")
            .update({ cliente_id: novoClienteId })
            .in("id", projetos.map((p) => p.id));
          if (pjErr) throw new Error(`update projetos: ${pjErr.message}`);
          summary.projetos_movidos += projetos.length;
        }

        // 2.4 Move propostas
        if (propostas.length > 0) {
          const { error: pnErr } = await admin
            .from("propostas_nativas")
            .update({ cliente_id: novoClienteId })
            .in("id", propostas.map((p) => p.id));
          if (pnErr) throw new Error(`update propostas: ${pnErr.message}`);
          summary.propostas_movidas += propostas.length;
        }

        // 2.5 Atualiza deals
        if (deals.length > 0) {
          const { error: dErr } = await admin
            .from("deals")
            .update({ customer_id: novoClienteId })
            .in("id", deals.map((d) => d.id));
          if (dErr) throw new Error(`update deals: ${dErr.message}`);
          summary.deals_atualizados += deals.length;
        }

        // 2.6 Log
        await admin.from("solarmarket_promotion_logs").insert({
          tenant_id: par.tenant,
          source_entity_type: "cliente",
          source_entity_id: par.sm_id,
          step: "split_absorbed",
          status: "ok",
          severity: "info",
          message: `split sm_id=${par.sm_id} from mae=${par.cliente_mae} -> novo=${novoClienteId}`,
          canonical_entity_type: "cliente",
          canonical_entity_id: novoClienteId,
          details: {
            projetos: projetos.length,
            propostas: propostas.length,
            deals: deals.length,
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        summary.erros.push({ par: `${par.cliente_mae}:${par.sm_id}`, error: msg });
        if (!dryRun) {
          await admin.from("solarmarket_promotion_logs").insert({
            tenant_id: par.tenant,
            source_entity_type: "cliente",
            source_entity_id: par.sm_id,
            step: "split_absorbed",
            status: "error",
            severity: "error",
            message: msg,
          });
        }
      }
    }

    return json({ ok: true, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 500);
  }
});
