/**
 * resolveDefaultCommercialPipeline — SSOT para escolher o pipeline/funil COMERCIAL padrão.
 *
 * Por quê:
 *  - Bug histórico: criar deal pegando "primeira pipeline por created_at" fazia o deal
 *    cair em "Engenharia" (pipeline criada primeiro pelo seed) em vez de "Comercial".
 *  - Sistema dual (RB-61/DA-47): pipelines (deals) e projeto_funis (execução).
 *    Cada novo deal de funil de captação DEVE entrar no pipeline COMERCIAL.
 *
 * Estratégia (em ordem):
 *  1) projeto_funis: papel='comercial' ativo (campo enum específico)
 *  2) projeto_funis: nome ilike 'comercial'
 *  3) projeto_funis: ordem ASC, ativo (último recurso)
 *  Para o lado pipelines (deals) o match é feito por NOME (espelho dual).
 *
 * NUNCA usar order("created_at", asc).limit(1) — depende do seed e quebra silenciosamente.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CommercialPipelineResolution {
  /** projeto_funis.id (mundo execução) */
  funilId: string | null;
  /** projeto_etapas.id — primeira etapa do funil */
  etapaId: string | null;
  funilNome: string | null;
  /** pipelines.id (mundo deals) — espelho via nome */
  pipelineId: string | null;
  /** pipeline_stages.id — primeira stage não-fechada */
  stageId: string | null;
  pipelineNome: string | null;
}

async function selectFunilComercial(tenantId: string) {
  // 1) papel='comercial'
  const byPapel = await supabase
    .from("projeto_funis")
    .select("id, nome")
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .eq("papel", "comercial" as any)
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (byPapel.data) return byPapel.data;

  // 2) nome ilike 'comercial'
  const byName = await supabase
    .from("projeto_funis")
    .select("id, nome")
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .ilike("nome", "comercial")
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (byName.data) return byName.data;

  // 3) último recurso: primeiro ativo por ordem
  const fallback = await supabase
    .from("projeto_funis")
    .select("id, nome")
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();
  return fallback.data ?? null;
}

async function selectPipelineByName(tenantId: string, nome: string) {
  // Match por nome (espelho dual). Não usar created_at.
  const byExact = await supabase
    .from("pipelines")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .ilike("name", nome)
    .limit(1)
    .maybeSingle();
  if (byExact.data) return byExact.data;

  // Fallback: nome contendo "comercial"
  const byLike = await supabase
    .from("pipelines")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .ilike("name", "%comercial%")
    .limit(1)
    .maybeSingle();
  return byLike.data ?? null;
}

export async function resolveDefaultCommercialPipeline(
  tenantId: string,
): Promise<CommercialPipelineResolution> {
  const funil = await selectFunilComercial(tenantId);

  let etapaId: string | null = null;
  if (funil) {
    const { data: etapa } = await supabase
      .from("projeto_etapas")
      .select("id")
      .eq("funil_id", funil.id)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();
    etapaId = etapa?.id ?? null;
  }

  // Espelho deals via nome (RB-61/DA-47)
  const pipeline = funil ? await selectPipelineByName(tenantId, funil.nome) : null;

  let stageId: string | null = null;
  if (pipeline) {
    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_id", pipeline.id)
      .eq("is_closed", false)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    stageId = stage?.id ?? null;
  }

  return {
    funilId: funil?.id ?? null,
    etapaId,
    funilNome: funil?.nome ?? null,
    pipelineId: pipeline?.id ?? null,
    stageId,
    pipelineNome: pipeline?.name ?? null,
  };
}
