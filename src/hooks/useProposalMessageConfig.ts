/**
 * useProposalMessageConfig.ts
 *
 * Hook para ler/salvar a configuração de mensagens de proposta por tenant.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────

export interface BlockConfig {
  enabled: boolean;
  modes: ("cliente" | "consultor")[];
  styles: ("curta" | "completa")[];
}

export interface ProposalMessageDefaults {
  mode: "cliente" | "consultor";
  style: "curta" | "completa";
  channel: "copiar" | "whatsapp" | "email";
  empresa_nome?: string;
  consultor_nome?: string;
  oferta_especial?: string;
}

export interface ProposalMessageConfigData {
  id?: string;
  tenant_id?: string;
  templates: Record<string, string>; // "cliente_curta" | "cliente_completa" | ...
  blocks_config: Record<string, BlockConfig>;
  defaults: ProposalMessageDefaults;
}

// ─── System Defaults ────────────────────────────────

export const SYSTEM_DEFAULT_BLOCKS: Record<string, BlockConfig> = {
  saudacao: { enabled: true, modes: ["cliente", "consultor"], styles: ["curta", "completa"] },
  resumo_tecnico: { enabled: true, modes: ["cliente", "consultor"], styles: ["completa"] },
  consumo_geracao: { enabled: true, modes: ["cliente", "consultor"], styles: ["completa"] },
  garantias: { enabled: true, modes: ["cliente"], styles: ["completa"] },
  investimento: { enabled: true, modes: ["cliente", "consultor"], styles: ["curta", "completa"] },
  pagamento: { enabled: true, modes: ["cliente", "consultor"], styles: ["completa"] },
  itens_inclusos: { enabled: true, modes: ["cliente"], styles: ["completa"] },
  servicos: { enabled: true, modes: ["cliente"], styles: ["completa"] },
  oferta_especial: { enabled: false, modes: ["cliente"], styles: ["curta", "completa"] },
  link_proposta: { enabled: true, modes: ["cliente", "consultor"], styles: ["curta", "completa"] },
  validade: { enabled: true, modes: ["cliente"], styles: ["completa"] },
  assinatura: { enabled: true, modes: ["cliente"], styles: ["curta", "completa"] },
};

export const SYSTEM_DEFAULT_CONFIG: ProposalMessageDefaults = {
  mode: "cliente",
  style: "completa",
  channel: "copiar",
};

// ─── Placeholder catalog ────────────────────────────

export interface PlaceholderInfo {
  key: string;
  label: string;
  example: string;
  category: string;
}

export const PLACEHOLDER_CATALOG: PlaceholderInfo[] = [
  { key: "cliente_nome", label: "Nome do cliente", example: "João Silva", category: "Cliente" },
  { key: "potencia_kwp", label: "Potência total (kWp)", example: "8,54", category: "Sistema" },
  { key: "modulos_qtd", label: "Quantidade de módulos", example: "16", category: "Sistema" },
  { key: "modulo_potencia", label: "Potência do módulo", example: "545W", category: "Sistema" },
  { key: "modulo_modelo", label: "Modelo do módulo", example: "Canadian 545W", category: "Sistema" },
  { key: "inversor_modelo", label: "Modelo do inversor", example: "Growatt MIN 8000TL-X", category: "Sistema" },
  { key: "consumo_mensal", label: "Consumo mensal (kWh)", example: "850", category: "Energia" },
  { key: "geracao_mensal", label: "Geração mensal (kWh)", example: "1.100", category: "Energia" },
  { key: "economia_mensal", label: "Economia mensal (R$)", example: "R$ 680,00", category: "Financeiro" },
  { key: "valor_total", label: "Valor total da proposta", example: "R$ 42.500,00", category: "Financeiro" },
  { key: "link_proposta", label: "Link público da proposta", example: "https://app.com/proposta/abc123", category: "Proposta" },
  { key: "status", label: "Status da proposta", example: "Gerada", category: "Proposta" },
  { key: "consultor_nome", label: "Nome do consultor", example: "Maria Santos", category: "Empresa" },
  { key: "empresa_nome", label: "Nome da empresa", example: "Solar Energy", category: "Empresa" },
];

// ─── Constants ──────────────────────────────────────

const STALE_TIME = 1000 * 60 * 15; // 15 min — config rarely changes
const QUERY_KEY = "proposal-message-config" as const;

// ─── Hook: Read ─────────────────────────────────────

export function useProposalMessageConfig(tenantId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, tenantId],
    queryFn: async (): Promise<ProposalMessageConfigData> => {
      if (!tenantId) {
        return { templates: {}, blocks_config: SYSTEM_DEFAULT_BLOCKS, defaults: SYSTEM_DEFAULT_CONFIG };
      }

      const { data, error } = await (supabase as any)
        .from("proposal_message_config")
        .select("id, tenant_id, templates, blocks_config, defaults")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // No config for tenant — return system defaults
        return {
          templates: {},
          blocks_config: SYSTEM_DEFAULT_BLOCKS,
          defaults: SYSTEM_DEFAULT_CONFIG,
        };
      }

      return {
        id: data.id,
        tenant_id: data.tenant_id,
        templates: data.templates || {},
        blocks_config: { ...SYSTEM_DEFAULT_BLOCKS, ...(data.blocks_config || {}) },
        defaults: { ...SYSTEM_DEFAULT_CONFIG, ...(data.defaults || {}) },
      };
    },
    staleTime: STALE_TIME,
    enabled: !!tenantId,
  });
}

// ─── Hook: Save ─────────────────────────────────────

export function useSaveProposalMessageConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      tenantId: string;
      templates: Record<string, string>;
      blocks_config: Record<string, BlockConfig>;
      defaults: ProposalMessageDefaults;
    }) => {
      const row = {
        tenant_id: payload.tenantId,
        templates: payload.templates,
        blocks_config: payload.blocks_config,
        defaults: payload.defaults,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await (supabase as any)
        .from("proposal_message_config")
        .upsert(row, { onConflict: "tenant_id" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, variables.tenantId] });
    },
  });
}
