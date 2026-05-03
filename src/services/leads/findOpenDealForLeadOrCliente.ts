/**
 * findOpenDealForLeadOrCliente — Detector de duplicidade pré-criação.
 *
 * Governança:
 *   - AGENTS.md RB-60 (cadeia obrigatória de criação)
 *   - Regra anti-duplicação: antes de criar projeto/deal a partir de Lead,
 *     verifica se já existe deal `open` para o mesmo cliente_id ou
 *     telefone_normalized do lead/cliente.
 *
 * Não modifica dados. Apenas leitura.
 */
import { supabase } from "@/integrations/supabase/client";
import { toCanonicalPhoneDigits } from "@/utils/phone/toCanonicalPhoneDigits";

export interface OpenDealMatch {
  deal_id: string;
  projeto_id: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  owner_id: string | null;
  owner_nome: string | null;
  pipeline_id: string | null;
  pipeline_nome: string | null;
  stage_id: string | null;
  stage_nome: string | null;
  created_at: string;
  match_reason: "cliente_id" | "telefone";
}

export interface FindOpenDealInput {
  tenantId: string;
  clienteId?: string | null;
  telefone?: string | null;
  pipelineId?: string | null;
}

export async function findOpenDealForLeadOrCliente(
  input: FindOpenDealInput
): Promise<OpenDealMatch[]> {
  const { tenantId, clienteId, telefone, pipelineId } = input;
  if (!tenantId) return [];

  // 1. Coletar candidato cliente_ids (clienteId direto + clientes com telefone igual)
  const candidateIds = new Set<string>();
  const matchReasonByCliente = new Map<string, "cliente_id" | "telefone">();

  if (clienteId) {
    candidateIds.add(clienteId);
    matchReasonByCliente.set(clienteId, "cliente_id");
  }

  const canonical = toCanonicalPhoneDigits(telefone || null);
  if (canonical) {
    const { data: telClientes } = await supabase
      .from("clientes")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("telefone_normalized", canonical);
    (telClientes || []).forEach((c: any) => {
      if (!candidateIds.has(c.id)) {
        candidateIds.add(c.id);
        matchReasonByCliente.set(c.id, "telefone");
      }
    });
  }

  if (candidateIds.size === 0) return [];

  // 2. Buscar deals open para esses clientes
  let query = supabase
    .from("deals")
    .select(
      "id, projeto_id, customer_id, owner_id, pipeline_id, stage_id, created_at, status"
    )
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .in("customer_id", Array.from(candidateIds))
    .order("created_at", { ascending: false });

  if (pipelineId) query = query.eq("pipeline_id", pipelineId);

  const { data: deals, error } = await query;
  if (error || !deals || deals.length === 0) return [];

  // 3. Enriquecer com nomes (cliente, owner, pipeline, stage)
  const clienteIds = Array.from(new Set(deals.map((d: any) => d.customer_id).filter(Boolean)));
  const ownerIds = Array.from(new Set(deals.map((d: any) => d.owner_id).filter(Boolean)));
  const pipelineIds = Array.from(new Set(deals.map((d: any) => d.pipeline_id).filter(Boolean)));
  const stageIds = Array.from(new Set(deals.map((d: any) => d.stage_id).filter(Boolean)));

  const [clientesRes, ownersRes, pipelinesRes, stagesRes] = await Promise.all([
    clienteIds.length
      ? supabase.from("clientes").select("id, nome").in("id", clienteIds)
      : Promise.resolve({ data: [] as any[] }),
    ownerIds.length
      ? supabase.from("consultores").select("id, nome").in("id", ownerIds)
      : Promise.resolve({ data: [] as any[] }),
    pipelineIds.length
      ? supabase.from("pipelines").select("id, name").in("id", pipelineIds)
      : Promise.resolve({ data: [] as any[] }),
    stageIds.length
      ? supabase.from("pipeline_stages").select("id, name").in("id", stageIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const clientesMap = new Map((clientesRes.data || []).map((x: any) => [x.id, x.nome]));
  const ownersMap = new Map((ownersRes.data || []).map((x: any) => [x.id, x.nome]));
  const pipelinesMap = new Map((pipelinesRes.data || []).map((x: any) => [x.id, x.name]));
  const stagesMap = new Map((stagesRes.data || []).map((x: any) => [x.id, x.name]));

  return deals.map((d: any) => ({
    deal_id: d.id,
    projeto_id: d.projeto_id ?? null,
    cliente_id: d.customer_id ?? null,
    cliente_nome: d.customer_id ? (clientesMap.get(d.customer_id) ?? null) : null,
    owner_id: d.owner_id ?? null,
    owner_nome: d.owner_id ? (ownersMap.get(d.owner_id) ?? null) : null,
    pipeline_id: d.pipeline_id ?? null,
    pipeline_nome: d.pipeline_id ? (pipelinesMap.get(d.pipeline_id) ?? null) : null,
    stage_id: d.stage_id ?? null,
    stage_nome: d.stage_id ? (stagesMap.get(d.stage_id) ?? null) : null,
    created_at: d.created_at,
    match_reason: matchReasonByCliente.get(d.customer_id) ?? "cliente_id",
  }));
}
