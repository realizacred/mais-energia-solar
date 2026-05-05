/**
 * Hook para dados do ProjetoDetalhe (leitura).
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 * DA-14: Migração progressiva — apenas o Context, ProjetoDetalhe.tsx fica para próxima sprint
 */

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  DealDetail,
  StageHistory,
  StageInfo,
  PipelineInfo,
  EtiquetaItem,
} from "@/contexts/ProjetoDetalheContext";

const STALE_TIME = 1000 * 60 * 5; // 5 min

// ─── Query Keys ────────────────────────────────────
export const projetoDetalheKeys = {
  detail: (dealId: string) => ["projeto-detalhe", dealId] as const,
  etiquetas: (dealId: string) => ["deal-etiquetas", dealId] as const,
  propostasCount: (dealId: string) => ["deal-proposals-count", dealId] as const,
};

// ─── Types ─────────────────────────────────────────
export interface ProjetoDetalheFullData {
  deal: DealDetail;
  projetoId: string | null;
  history: StageHistory[];
  stages: StageInfo[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerCpfCnpj: string;
  customerAddress: string;
  customerEmpresa: string;
  ownerName: string;
  pipelines: PipelineInfo[];
  allStagesMap: Map<string, StageInfo[]>;
  userNamesMap: Map<string, string>;
  docsCount: number;
}

export interface DealEtiquetasData {
  allEtiquetas: EtiquetaItem[];
  dealEtiquetas: EtiquetaItem[];
}

// ─── Main Query ────────────────────────────────────
export function useProjetoDetalheData(dealId: string) {
  return useQuery({
    queryKey: projetoDetalheKeys.detail(dealId),
    queryFn: async (): Promise<ProjetoDetalheFullData> => {
      // 0. Resolve identifier: aceita tanto deals.id quanto projetos.id
      // (projetos migrados do SolarMarket OU criados a partir de leads sem pipeline
      //  podem propagar projetos.id na URL/cards). RB-60: cadeia projeto→deal obrigatória.
      let resolvedDealId = dealId;
      const dealProbe = await supabase
        .from("deals")
        .select("id")
        .eq("id", dealId)
        .maybeSingle();
      if (!dealProbe.data) {
        const projetoProbe = await supabase
          .from("projetos")
          .select("id, deal_id, cliente_id, consultor_id, tenant_id")
          .eq("id", dealId)
          .maybeSingle();
        const projetoRow: any = projetoProbe.data;
        const fallback = projetoRow?.deal_id;
        if (fallback) {
          resolvedDealId = fallback;
        } else if (projetoRow) {
          // Projeto existe mas não tem deal vinculado → criar on-demand (RB-60)
          const tenantId = projetoRow.tenant_id;
          const { data: pipeline } = await supabase
            .from("pipelines")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("is_active", true)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (pipeline) {
            const { data: stage } = await supabase
              .from("pipeline_stages")
              .select("id")
              .eq("pipeline_id", (pipeline as any).id)
              .order("position", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (stage) {
              let title = "Projeto";
              if (projetoRow.cliente_id) {
                const { data: cli } = await supabase
                  .from("clientes")
                  .select("nome")
                  .eq("id", projetoRow.cliente_id)
                  .maybeSingle();
                if ((cli as any)?.nome) title = (cli as any).nome;
              }
              const { data: newDeal, error: dealErr } = await supabase
                .from("deals")
                .insert({
                  pipeline_id: (pipeline as any).id,
                  stage_id: (stage as any).id,
                  owner_id: projetoRow.consultor_id || null,
                  customer_id: projetoRow.cliente_id || null,
                  projeto_id: projetoRow.id,
                  value: 0,
                  title,
                  tenant_id: tenantId,
                } as any)
                .select("id")
                .maybeSingle();
              if (!dealErr && newDeal) {
                await supabase
                  .from("projetos")
                  .update({ deal_id: (newDeal as any).id } as any)
                  .eq("id", projetoRow.id);
                resolvedDealId = (newDeal as any).id;
              }
            }
          }
        }
      }

      // Fase 2c: 1 RPC consolidada substitui ~9 queries.
      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
        "get_projeto_detalhe",
        { _deal_id: resolvedDealId }
      );
      if (rpcErr) throw rpcErr;
      if (!rpcData) throw new Error("Projeto não encontrado");

      const d = rpcData.deal as DealDetail;
      const historyData = (rpcData.history || []) as StageHistory[];

      // User names from history
      const userNamesMap = new Map<string, string>();
      const namesObj = (rpcData.user_names || {}) as Record<string, string>;
      Object.entries(namesObj).forEach(([uid, nome]) => userNamesMap.set(uid, nome));

      // Customer
      let customerName = "", customerPhone = "", customerEmail = "";
      let customerCpfCnpj = "", customerAddress = "", customerEmpresa = "";
      if (rpcData.customer) {
        const c = rpcData.customer as any;
        customerName = c.nome;
        customerPhone = c.telefone || "";
        customerEmail = c.email || "";
        customerCpfCnpj = c.cpf_cnpj || "";
        customerEmpresa = c.empresa || "";
        const parts = [
          c.rua,
          c.numero ? `n° ${c.numero}` : null,
          c.bairro,
          c.cidade ? `${c.cidade} (${c.estado || ""})` : null,
          c.cep ? `CEP: ${c.cep}` : null,
        ].filter(Boolean);
        customerAddress = parts.join(", ");
      }

      const ownerName = (rpcData.owner_name as string) || "";
      const pipelines = (rpcData.pipelines || []) as PipelineInfo[];

      // All stages map
      const allStagesMap = new Map<string, StageInfo[]>();
      ((rpcData.all_stages || []) as any[]).forEach(s => {
        const arr = allStagesMap.get(s.pipeline_id) || [];
        arr.push({
          id: s.id,
          name: s.name,
          position: s.position,
          is_closed: s.is_closed,
          is_won: s.is_won,
          probability: s.probability,
        });
        allStagesMap.set(s.pipeline_id, arr);
      });

      // Docs count: storage files + generated documents (RPC já trouxe generated)
      let docsCount = (rpcData.generated_docs_count as number) || 0;
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (uid) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", uid)
          .maybeSingle();
        if (profile) {
          const { data: files } = await supabase.storage
            .from("projeto-documentos")
            .list(`${(profile as any).tenant_id}/deals/${d.id}`, { limit: 100 });
          docsCount += files?.length || 0;
        }
      }

      return {
        deal: d,
        projetoId: d.projeto_id ?? null,
        history: historyData,
        stages: (rpcData.stages || []) as StageInfo[],
        customerName,
        customerPhone,
        customerEmail,
        customerCpfCnpj,
        customerAddress,
        customerEmpresa,
        ownerName,
        pipelines,
        allStagesMap,
        userNamesMap,
        docsCount,
      };
    },
    staleTime: STALE_TIME,
    enabled: !!dealId,
  });
}

// ─── Etiquetas Query ───────────────────────────────
export function useDealEtiquetas(dealId: string) {
  return useQuery({
    queryKey: projetoDetalheKeys.etiquetas(dealId),
    queryFn: async (): Promise<DealEtiquetasData> => {
      const [relRes, allRes] = await Promise.all([
        supabase
          .from("projeto_etiqueta_rel")
          .select("etiqueta_id")
          .eq("projeto_id", dealId),
        supabase
          .from("projeto_etiquetas")
          .select("id, nome, cor, short, icon")
          .eq("ativo", true)
          .order("ordem"),
      ]);
      const allEts = (allRes.data || []) as EtiquetaItem[];
      const relIds = new Set((relRes.data || []).map((r: any) => r.etiqueta_id));
      return {
        allEtiquetas: allEts,
        dealEtiquetas: allEts.filter(e => relIds.has(e.id)),
      };
    },
    staleTime: STALE_TIME,
    enabled: !!dealId,
  });
}

// ─── Toggle Etiqueta Mutation ──────────────────────
export function useToggleEtiqueta(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ etId, has }: { etId: string; has: boolean }) => {
      if (has) {
        const { error } = await supabase
          .from("projeto_etiqueta_rel")
          .delete()
          .eq("projeto_id", dealId)
          .eq("etiqueta_id", etId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("projeto_etiqueta_rel")
          .insert({ projeto_id: dealId, etiqueta_id: etId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projetoDetalheKeys.etiquetas(dealId) });
    },
  });
}
