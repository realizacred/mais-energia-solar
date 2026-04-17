/**
 * create-projetos-from-sm
 *
 * Cria projetos nativos para todos os elegíveis SolarMarket (com proposta).
 *
 * Regras:
 *  1. Elegibilidade: EXISTS em solar_market_proposals por sm_project_id
 *  2. Idempotência por (tenant_id, sm_project_id) em projetos
 *  3. Idempotência por (tenant_id, sm_client_id) em clientes
 *  4. NÃO aplica funil/etapa (escopo do migrate-sm-proposals-v3)
 *  5. NÃO bloqueia por dados incompletos (telefone/endereço/docs)
 *  6. Default = dry-run. Apply real exige { confirm_apply: true }
 *
 * RB-57: estado por request, sem `let` em escopo de módulo.
 * RB-58: INSERTs verificam linhas afetadas via .select().
 *
 * Body:
 *   { tenant_id: string, confirm_apply?: boolean, sm_project_ids?: number[], limit?: number }
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CHUNK = 200;

interface RunState {
  would_insert_clients: number;
  would_insert_projects: number;
  inserted_clients: number;
  inserted_projects: number;
  skipped_existing_projects: number;
  failed: Array<{ sm_project_id: number; reason: string }>;
}

function newState(): RunState {
  return {
    would_insert_clients: 0,
    would_insert_projects: 0,
    inserted_clients: 0,
    inserted_projects: 0,
    skipped_existing_projects: 0,
    failed: [],
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function fallbackName(p: any): string {
  return (
    p?.name?.trim() ||
    p?.description?.trim()?.slice(0, 80) ||
    `SM Project ${p.sm_project_id}`
  );
}

function fallbackPhone(c: any): string {
  // clientes.telefone é NOT NULL — usa fallback explícito quando ausente
  return (c?.phone_normalized || c?.phone || "").toString().trim() || "0000000000";
}

function clientName(c: any, fallbackProjectName: string): string {
  return c?.name?.trim() || fallbackProjectName;
}

async function fetchEligibleProjects(
  sb: SupabaseClient,
  tenantId: string,
  smIds: number[] | null,
  limit: number | null,
) {
  // 1) IDs com proposta
  const propIds = new Set<number>();
  let offset = 0;
  while (true) {
    let q = sb
      .from("solar_market_proposals")
      .select("sm_project_id", { count: undefined })
      .eq("tenant_id", tenantId)
      .not("sm_project_id", "is", null)
      .range(offset, offset + 999);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) if (r.sm_project_id) propIds.add(Number(r.sm_project_id));
    if (data.length < 1000) break;
    offset += 1000;
  }

  let candidate = Array.from(propIds);
  if (smIds?.length) {
    const filter = new Set(smIds);
    candidate = candidate.filter((id) => filter.has(id));
  }
  if (limit && candidate.length > limit) candidate = candidate.slice(0, limit);

  // 2) Buscar dados em chunks
  const projects: any[] = [];
  for (const ids of chunk(candidate, CHUNK)) {
    const { data, error } = await sb
      .from("solar_market_projects")
      .select(
        "sm_project_id, sm_client_id, name, description, address, city, neighborhood, state, zip_code, number, complement",
      )
      .eq("tenant_id", tenantId)
      .in("sm_project_id", ids);
    if (error) throw error;
    if (data) projects.push(...data);
  }
  return projects;
}

async function fetchClientsByIds(
  sb: SupabaseClient,
  tenantId: string,
  smClientIds: number[],
) {
  const out: any[] = [];
  for (const ids of chunk(smClientIds, CHUNK)) {
    const { data, error } = await sb
      .from("solar_market_clients")
      .select("sm_client_id, name, phone, phone_normalized, email, document, address, city, neighborhood, state, zip_code")
      .eq("tenant_id", tenantId)
      .in("sm_client_id", ids);
    if (error) throw error;
    if (data) out.push(...data);
  }
  return out;
}

async function fetchExistingProjectsMap(
  sb: SupabaseClient,
  tenantId: string,
  smProjectIds: number[],
) {
  const map = new Map<number, string>();
  for (const ids of chunk(smProjectIds, CHUNK)) {
    const { data, error } = await sb
      .from("projetos")
      .select("id, sm_project_id")
      .eq("tenant_id", tenantId)
      .in("sm_project_id", ids);
    if (error) throw error;
    for (const r of data ?? []) {
      if (r.sm_project_id) map.set(Number(r.sm_project_id), r.id as string);
    }
  }
  return map;
}

async function fetchExistingClientsMap(
  sb: SupabaseClient,
  tenantId: string,
  smClientIds: number[],
) {
  const map = new Map<number, string>();
  for (const ids of chunk(smClientIds, CHUNK)) {
    const { data, error } = await sb
      .from("clientes")
      .select("id, sm_client_id")
      .eq("tenant_id", tenantId)
      .in("sm_client_id", ids);
    if (error) throw error;
    for (const r of data ?? []) {
      if (r.sm_client_id) map.set(Number(r.sm_client_id), r.id as string);
    }
  }
  return map;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const state = newState();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const tenantId = String(body?.tenant_id || "").trim();
    const confirmApply = body?.confirm_apply === true;
    const smIds: number[] | null = Array.isArray(body?.sm_project_ids)
      ? body.sm_project_ids.map((n: any) => Number(n)).filter(Number.isFinite)
      : null;
    const limit: number | null = Number.isFinite(body?.limit) ? Number(body.limit) : null;

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Elegíveis
    const projects = await fetchEligibleProjects(sb, tenantId, smIds, limit);
    const projectIds = projects.map((p) => Number(p.sm_project_id));

    // 2) Já existentes em projetos
    const existing = await fetchExistingProjectsMap(sb, tenantId, projectIds);

    // 3) Pendentes
    const pending = projects.filter((p) => !existing.has(Number(p.sm_project_id)));
    state.skipped_existing_projects = projects.length - pending.length;

    // 4) Clientes necessários
    const neededClientIds = Array.from(
      new Set(
        pending
          .map((p) => p.sm_client_id)
          .filter((v: any) => v != null)
          .map((v: any) => Number(v)),
      ),
    );

    const clientsRows = neededClientIds.length
      ? await fetchClientsByIds(sb, tenantId, neededClientIds)
      : [];
    const clientsBySm = new Map<number, any>();
    for (const c of clientsRows) clientsBySm.set(Number(c.sm_client_id), c);

    const existingClients = neededClientIds.length
      ? await fetchExistingClientsMap(sb, tenantId, neededClientIds)
      : new Map<number, string>();

    const clientsToCreateIds = neededClientIds.filter((id) => !existingClients.has(id));
    state.would_insert_clients = clientsToCreateIds.length;
    state.would_insert_projects = pending.length;

    if (!confirmApply) {
      return new Response(
        JSON.stringify({
          mode: "dry_run",
          tenant_id: tenantId,
          eligible: projects.length,
          already_exist: state.skipped_existing_projects,
          would_insert_projects: state.would_insert_projects,
          would_insert_clients: state.would_insert_clients,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── APPLY ──────────────────────────────────────────────────────────────
    // 5) Criar clientes faltantes (sm_client_id por sm_client_id)
    for (const smcId of clientsToCreateIds) {
      const c = clientsBySm.get(smcId);
      const projectForFallback = pending.find(
        (p) => Number(p.sm_client_id) === smcId,
      );
      const nome = clientName(c, fallbackName(projectForFallback ?? { sm_project_id: smcId }));
      const telefone = fallbackPhone(c);
      const cliente_code = `SM-${smcId}`;

      const insert = {
        tenant_id: tenantId,
        sm_client_id: smcId,
        nome,
        telefone,
        telefone_normalized: c?.phone_normalized ?? null,
        email: c?.email ?? null,
        cpf_cnpj: c?.document ?? null,
        rua: c?.address ?? null,
        numero: c?.number ?? null,
        complemento: c?.complement ?? null,
        bairro: c?.neighborhood ?? null,
        cidade: c?.city ?? null,
        estado: c?.state ?? null,
        cep: c?.zip_code ?? null,
        cliente_code,
        import_source: "solar_market",
      };

      const { data, error } = await sb
        .from("clientes")
        .insert(insert)
        .select("id")
        .maybeSingle();

      if (error || !data?.id) {
        state.failed.push({
          sm_project_id: smcId,
          reason: `cliente insert falhou: ${error?.message ?? "no row"}`,
        });
        continue;
      }
      existingClients.set(smcId, data.id);
      state.inserted_clients++;
    }

    // 6) Criar projetos
    for (const p of pending) {
      const smpId = Number(p.sm_project_id);
      const smcId = p.sm_client_id != null ? Number(p.sm_client_id) : null;
      const cliente_id = smcId != null ? existingClients.get(smcId) : null;

      if (!cliente_id) {
        state.failed.push({
          sm_project_id: smpId,
          reason: "cliente_id não resolvido (sm_client_id ausente ou cliente não criado)",
        });
        continue;
      }

      const codigo = `SM-${smpId}`;
      const insert = {
        tenant_id: tenantId,
        sm_project_id: smpId,
        cliente_id,
        codigo,
        import_source: "solar_market",
        // funil_id / etapa_id intencionalmente NÃO definidos — escopo do v3
      };

      const { data, error } = await sb
        .from("projetos")
        .insert(insert)
        .select("id")
        .maybeSingle();

      if (error || !data?.id) {
        state.failed.push({
          sm_project_id: smpId,
          reason: `projeto insert falhou: ${error?.message ?? "no row"}`,
        });
        continue;
      }
      state.inserted_projects++;
    }

    return new Response(
      JSON.stringify({
        mode: "apply",
        tenant_id: tenantId,
        eligible: projects.length,
        already_exist: state.skipped_existing_projects,
        inserted_projects: state.inserted_projects,
        inserted_clients: state.inserted_clients,
        failed_count: state.failed.length,
        failed_sample: state.failed.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[create-projetos-from-sm] fatal:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
