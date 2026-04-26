/**
 * useFunnelGovernance — Hooks da governança de funis multi-tenant.
 *
 * Cobre:
 *  - Marcação de "papel" em projeto_funis e pipelines
 *  - Regras de coerência entre funis (ai_funnel_rules)
 *  - Alertas detectados (ai_funnel_alerts)
 *  - Configuração de IA por feature (ai_features_config)
 *
 * Governança:
 *  - RB-04 / AP-01: Queries só em hooks
 *  - RB-05: staleTime obrigatório
 *  - RB-58: Mutations críticas confirmam com .select()
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE = 1000 * 60 * 2;

// As tabelas novas ainda não estão nos types gerados. Usamos um cliente "untyped"
// localizado APENAS para essas tabelas. Não vazar para o resto do app.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type PapelFunil =
  | "comercial"
  | "engenharia"
  | "suprimentos"
  | "instalacao"
  | "concessionaria"
  | "pos_venda"
  | "outro";

export const PAPEL_LABEL: Record<PapelFunil, string> = {
  comercial: "Comercial",
  engenharia: "Engenharia",
  suprimentos: "Suprimentos",
  instalacao: "Instalação",
  concessionaria: "Concessionária",
  pos_venda: "Pós-venda",
  outro: "Outro",
};

export interface FunilRow {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  papel: PapelFunil;
  origem: "projeto" | "pipeline";
}

/** Lista todos os funis (projeto_funis + pipelines) com seu papel */
export function useFunisComPapel() {
  return useQuery<FunilRow[]>({
    queryKey: ["funis-com-papel"],
    staleTime: STALE,
    queryFn: async () => {
      const [pf, pp] = await Promise.all([
        sb.from("projeto_funis").select("id, nome, ordem, ativo, papel").order("ordem"),
        sb.from("pipelines").select("id, name, is_active, papel").order("name"),
      ]);
      if (pf.error) throw new Error(pf.error.message);
      if (pp.error) throw new Error(pp.error.message);

      const out: FunilRow[] = [];
      for (const r of (pf.data ?? []) as Array<Record<string, unknown>>) {
        out.push({
          id: r.id as string,
          nome: r.nome as string,
          ordem: (r.ordem as number) ?? 0,
          ativo: (r.ativo as boolean) ?? true,
          papel: (r.papel as PapelFunil) ?? "outro",
          origem: "projeto",
        });
      }
      for (const r of (pp.data ?? []) as Array<Record<string, unknown>>) {
        out.push({
          id: r.id as string,
          nome: r.name as string,
          ordem: 0,
          ativo: (r.is_active as boolean) ?? true,
          papel: (r.papel as PapelFunil) ?? "outro",
          origem: "pipeline",
        });
      }
      return out;
    },
  });
}

/** Atualiza o papel de um funil */
export function useUpdatePapelFunil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; origem: "projeto" | "pipeline"; papel: PapelFunil }) => {
      const table = vars.origem === "projeto" ? "projeto_funis" : "pipelines";
      const { data, error } = await sb
        .from(table)
        .update({ papel: vars.papel })
        .eq("id", vars.id)
        .select("id, papel")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funis-com-papel"] });
      qc.invalidateQueries({ queryKey: ["funnel-health"] });
    },
  });
}

// =================== Regras ===================

export interface FunnelRule {
  id: string;
  nome: string;
  descricao: string | null;
  funil_origem_papel: PapelFunil;
  etapa_origem_categoria: "aberto" | "ganho" | "perdido" | "excluido";
  funil_alvo_papel: PapelFunil;
  etapa_alvo_categoria_esperada: "aberto" | "ganho" | "perdido" | "excluido";
  acao: "alertar" | "sugerir" | "auto_corrigir";
  ativo: boolean;
  prioridade: number;
}

export function useFunnelRules() {
  return useQuery<FunnelRule[]>({
    queryKey: ["ai-funnel-rules"],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await sb
        .from("ai_funnel_rules")
        .select(
          "id, nome, descricao, funil_origem_papel, etapa_origem_categoria, funil_alvo_papel, etapa_alvo_categoria_esperada, acao, ativo, prioridade"
        )
        .order("prioridade");
      if (error) throw new Error(error.message);
      return (data ?? []) as FunnelRule[];
    },
  });
}

export function useUpsertFunnelRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Partial<FunnelRule>) => {
      const { data, error } = await sb
        .from("ai_funnel_rules")
        .upsert(rule)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-funnel-rules"] }),
  });
}

export function useDeleteFunnelRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("ai_funnel_rules").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-funnel-rules"] }),
  });
}

// =================== Alertas ===================

export interface FunnelAlert {
  id: string;
  rule_id: string | null;
  projeto_id: string | null;
  deal_id: string | null;
  funil_origem_papel: PapelFunil;
  funil_alvo_papel: PapelFunil;
  etapa_atual_alvo: string | null;
  etapa_esperada_alvo: string | null;
  severidade: "baixa" | "media" | "alta";
  estado: "aberto" | "corrigido" | "ignorado";
  mensagem: string | null;
  detectado_em: string;
}

export function useFunnelAlerts(estado: FunnelAlert["estado"] = "aberto") {
  return useQuery<FunnelAlert[]>({
    queryKey: ["ai-funnel-alerts", estado],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await sb
        .from("ai_funnel_alerts")
        .select(
          "id, rule_id, projeto_id, deal_id, funil_origem_papel, funil_alvo_papel, etapa_atual_alvo, etapa_esperada_alvo, severidade, estado, mensagem, detectado_em"
        )
        .eq("estado", estado)
        .order("detectado_em", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as FunnelAlert[];
    },
  });
}

export function useUpdateAlertState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; estado: FunnelAlert["estado"] }) => {
      const { error } = await sb
        .from("ai_funnel_alerts")
        .update({ estado: vars.estado, resolvido_em: new Date().toISOString() })
        .eq("id", vars.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-funnel-alerts"] }),
  });
}

// =================== AI Features ===================

export interface AiFeatureConfig {
  id: string;
  feature_key: string;
  feature_label: string;
  feature_description: string | null;
  enabled: boolean;
  provider: string | null;
  model: string | null;
}

export function useAiFeatures() {
  return useQuery<AiFeatureConfig[]>({
    queryKey: ["ai-features-config"],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await sb
        .from("ai_features_config")
        .select("id, feature_key, feature_label, feature_description, enabled, provider, model")
        .order("feature_label");
      if (error) throw new Error(error.message);
      return (data ?? []) as AiFeatureConfig[];
    },
  });
}

export function useUpdateAiFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<AiFeatureConfig> }) => {
      const { data, error } = await sb
        .from("ai_features_config")
        .update(vars.patch)
        .eq("id", vars.id)
        .select("id, enabled, provider, model")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-features-config"] }),
  });
}
