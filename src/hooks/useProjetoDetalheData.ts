/**
 * Hook para dados do ProjetoDetalhe (leitura).
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 * DA-14: Migração progressiva — apenas o Context, ProjetoDetalhe.tsx fica para próxima sprint
 */

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { countLogicalDocs } from "@/lib/documentDedup";
import { parseFileMetaArray } from "@/components/admin/projetos/CustomFieldFileInput";
import type {
  DealDetail,
  StageHistory,
  StageInfo,
  PipelineInfo,
  EtiquetaItem,
  ProjetoOperacaoEvento,
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
  /** Nome próprio do projeto (projetos.nome). NÃO é o nome do cliente. */
  projetoNome: string | null;
  /** Código humano do projeto (projetos.codigo) — fallback de display. */
  projetoCodigo: string | null;
  /** Número humano do projeto (projetos.projeto_num) — fallback final. */
  projetoNum: number | null;
  /** Descrição do projeto (projetos.observacoes). */
  projetoDescricao: string | null;
  history: StageHistory[];
  operacoesHistory: ProjetoOperacaoEvento[];
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
  portalToken: string | null;
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

      // Docs count: paridade com o Hub — mescla project_documents (SSOT) +
      // arquivos de campos customizados tipo "file" (deal_custom_field_values),
      // aplica mesma dedup semântica e conta documentos lógicos únicos.
      let docsCount = 0;
      const orFilter: string[] = [];
      if (d.projeto_id) orFilter.push(`projeto_id.eq.${d.projeto_id}`);
      orFilter.push(`deal_id.eq.${d.id}`);
      const scopeDefault = d.id;
      const items: Array<{
        bucket: string;
        storage_path: string;
        file_name: string;
        size_bytes: number | null;
        mime_type: string | null;
        scope: string;
        origem: string;
      }> = [];

      const { data: pdRows } = await supabase
        .from("project_documents")
        .select("bucket,storage_path,file_name,size_bytes,mime_type,deal_id,projeto_id,origem")
        .eq("is_deleted", false)
        .or(orFilter.join(","));
      
      const existingPaths = new Set();
      for (const r of (pdRows || []) as any[]) {
        items.push({
          bucket: r.bucket,
          storage_path: r.storage_path,
          file_name: r.file_name,
          size_bytes: r.size_bytes,
          mime_type: r.mime_type,
          scope: r.deal_id || r.projeto_id || scopeDefault,
          origem: r.origem,
        });
        existingPaths.add(r.storage_path);
      }

      // Custom field files (mesma fonte usada pelo Hub)
      const { data: cfRows } = await supabase
        .from("deal_custom_field_values")
        .select("value_text, deal_custom_fields!inner(field_type)")
        .eq("deal_id", d.id);
      for (const row of (cfRows || []) as any[]) {
        const f = row.deal_custom_fields;
        if (!f || f.field_type !== "file") continue;
        const metas = parseFileMetaArray(row.value_text);
        for (const m of metas) {
          if (!m?.storage_path || existingPaths.has(m.storage_path)) continue;
          items.push({
            bucket: "projeto-documentos",
            storage_path: m.storage_path,
            file_name: m.filename,
            size_bytes: m.size ?? null,
            mime_type: m.mime ?? null,
            scope: d.id,
            origem: "custom_field",
          });
          existingPaths.add(m.storage_path);
        }
      }

      // 1. Contar documentos físicos únicos (uploads reais)
      // Hub esconde 'generated' e 'recibo' da lista de arquivos do projeto
      const physicalDocs = items.filter(it => it.origem !== 'generated' && it.origem !== 'recibo');
      docsCount = countLogicalDocs(physicalDocs as any);
      
      // 2. Somar documentos gerados (Contratos/Procurações) ativos
      const { count: genCount } = await supabase
        .from("generated_documents")
        .select("*", { count: "exact", head: true })
        .eq("deal_id", d.id)
        .neq("status", "cancelled");
      
      docsCount += (genCount || 0);



      // Fetch projeto identity (nome próprio, código, num, descrição) — separado do cliente.
      let projetoNome: string | null = null;
      let projetoCodigo: string | null = null;
      let projetoNum: number | null = null;
      let projetoDescricao: string | null = null;
      let portalToken: string | null = null;
      if (d.projeto_id) {
        const { data: projetoIdent } = await supabase
          .from("projetos")
          .select("nome, codigo, projeto_num, observacoes, portal_token")
          .eq("id", d.projeto_id)
          .maybeSingle();
        if (projetoIdent) {
          projetoNome = (projetoIdent as any).nome ?? null;
          projetoCodigo = (projetoIdent as any).codigo ?? null;
          projetoNum = (projetoIdent as any).projeto_num ?? null;
          projetoDescricao = (projetoIdent as any).observacoes ?? null;
          portalToken = (projetoIdent as any).portal_token ?? null;
        }
      }

      return {
        deal: d,
        projetoId: d.projeto_id ?? null,
        projetoNome,
        projetoCodigo,
        projetoNum,
        projetoDescricao,
        history: historyData,
        operacoesHistory: (rpcData.operacoes_history || []) as ProjetoOperacaoEvento[],
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
        portalToken,
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
