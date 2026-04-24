// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório
import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────
export interface VersaoProjetoTab {
  id: string;
  versao_numero: number;
  valor_total: number | null;
  potencia_kwp: number | null;
  status: string;
  economia_mensal: number | null;
  payback_meses: number | null;
  geracao_mensal: number | null;
  created_at: string;
  output_pdf_path: string | null;
  output_docx_path: string | null;
  link_pdf: string | null;
  public_slug: string | null;
  gerado_em: string | null;
  usuario_editou_em: string | null;
}

export interface PropostaNativaProjetoTab {
  id: string;
  titulo: string;
  codigo: string | null;
  proposta_num: number | null;
  versao_atual: number;
  status: string;
  created_at: string;
  cliente_nome: string | null;
  is_principal: boolean;
  aceita_at: string | null;
  enviada_at: string | null;
  recusada_at: string | null;
  origem: string | null;
  versoes: VersaoProjetoTab[];
}

const STALE_TIME = 1000 * 60 * 5; // 5 min
const QUERY_KEY = "propostas-projeto-tab" as const;

/**
 * Hook canônico para a aba Propostas do Projeto.
 * Substitui o padrão useState+useEffect+refreshKey.
 */
export function usePropostasProjetoTab(dealId: string, customerId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, dealId, customerId],
    queryFn: async () => {
      if (!dealId && !customerId) return [] as PropostaNativaProjetoTab[];

      // Resolve deal → projeto_id (propostas migradas SM têm projeto_id mas deal_id=NULL).
      // RB-58 / DA-36: o ID na URL pode ser deals.id; buscamos o projeto_id vinculado.
      let resolvedProjetoId: string | null = null;
      if (dealId) {
        const { data: dealRow } = await supabase
          .from("deals")
          .select("projeto_id")
          .eq("id", dealId)
          .maybeSingle();
        resolvedProjetoId = (dealRow as any)?.projeto_id ?? null;
      }

      let query = (supabase as any)
        .from("propostas_nativas")
        .select("id, titulo, codigo, proposta_num, versao_atual, status, created_at, is_principal, aceita_at, enviada_at, recusada_at, origem, cliente_id, clientes(nome)")
        .neq("status", "excluida")
        .order("created_at", { ascending: false })
        .limit(20);

      if (dealId) {
        // Match por deal_id OU projeto_id (cobre propostas migradas SM com deal_id=NULL).
        const orParts = [`deal_id.eq.${dealId}`, `projeto_id.eq.${dealId}`];
        if (resolvedProjetoId && resolvedProjetoId !== dealId) {
          orParts.push(`projeto_id.eq.${resolvedProjetoId}`);
        }
        query = query.or(orParts.join(","));
      } else if (customerId) {
        query = query.eq("cliente_id", customerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return [] as PropostaNativaProjetoTab[];

      const ids = data.map((p: any) => p.id);

      // Fetch versoes
      const { data: versoes } = await supabase
        .from("proposta_versoes")
        .select("id, proposta_id, versao_numero, valor_total, potencia_kwp, status, economia_mensal, geracao_mensal, payback_meses, created_at, snapshot, output_pdf_path, output_docx_path, link_pdf, public_slug, gerado_em, usuario_editou_em, template_id_used")
        .in("proposta_id", ids)
        .order("versao_numero", { ascending: false });

      // Fetch UC geração
      const versaoIds = (versoes || []).map((v: any) => v.id);
      const geracaoMap = new Map<string, number>();
      if (versaoIds.length > 0) {
        const { data: ucs } = await supabase
          .from("proposta_versao_ucs")
          .select("versao_id, geracao_mensal_estimada")
          .in("versao_id", versaoIds);
        if (ucs) {
          for (const uc of ucs as any[]) {
            const cur = geracaoMap.get(uc.versao_id) || 0;
            geracaoMap.set(uc.versao_id, cur + (uc.geracao_mensal_estimada || 0));
          }
        }
      }

      return data.map((p: any): PropostaNativaProjetoTab => ({
        id: p.id,
        titulo: p.titulo,
        codigo: p.codigo,
        proposta_num: p.proposta_num,
        versao_atual: p.versao_atual,
        status: p.status,
        created_at: p.created_at,
        cliente_nome: p.clientes?.nome || null,
        is_principal: p.is_principal ?? false,
        aceita_at: p.aceita_at || null,
        enviada_at: p.enviada_at || null,
        recusada_at: p.recusada_at || null,
        origem: p.origem || null,
        versoes: (versoes || [])
          .filter((v: any) => v.proposta_id === p.id)
          .map((v: any) => {
            const snap = (v.snapshot || {}) as Record<string, any>;
            // Fallback potência from snapshot
            let potencia = v.potencia_kwp;
            if ((!potencia || potencia === 0) && snap?.itens) {
              const modulos = (snap.itens as any[]).filter((i: any) => i.categoria === "modulo" || i.categoria === "modulos");
              if (modulos.length > 0) {
                potencia = modulos.reduce((s: number, m: any) => s + ((m.potencia_w || 0) * (m.quantidade || 1)) / 1000, 0);
              }
            }
            // Fallback geração — priority: column > snapshot.tecnico > UCs > irradiação calc
            let geracao: number | null = v.geracao_mensal > 0 ? v.geracao_mensal : null;
            if (!geracao && snap?.tecnico?.geracao_estimada_kwh > 0) {
              geracao = snap.tecnico.geracao_estimada_kwh;
            }
            if (!geracao) {
              const fromMap = geracaoMap.get(v.id) || 0;
              if (fromMap > 0) geracao = fromMap;
            }
            if (!geracao && snap?.ucs) {
              const totalGeracao = (snap.ucs as any[]).reduce((s: number, uc: any) => s + (uc.geracao_mensal_estimada || 0), 0);
              if (totalGeracao > 0) geracao = totalGeracao;
            }
            if (!geracao && potencia > 0 && snap?.locIrradiacao > 0) {
              geracao = Math.round(potencia * snap.locIrradiacao * 30 * 0.80);
            }
            return {
              id: v.id,
              versao_numero: v.versao_numero,
              valor_total: v.valor_total,
              potencia_kwp: potencia,
              status: v.status,
              economia_mensal: v.economia_mensal,
              payback_meses: v.payback_meses,
              created_at: v.created_at,
              geracao_mensal: geracao,
              output_pdf_path: v.output_pdf_path || null,
              output_docx_path: v.output_docx_path || null,
              link_pdf: v.link_pdf || null,
              public_slug: v.public_slug || null,
              gerado_em: v.gerado_em || v.created_at,
              usuario_editou_em: v.usuario_editou_em || null,
            };
          }),
      }));
    },
    staleTime: STALE_TIME,
    enabled: !!(dealId || customerId),
  });
}

/**
 * Seleciona a proposta principal de uma lista.
 * Prioridade: is_principal → status forte → mais recente.
 */
export function selectPrincipal(propostas: PropostaNativaProjetoTab[]): PropostaNativaProjetoTab | null {
  if (propostas.length === 0) return null;
  const principal = propostas.find(p => p.is_principal);
  if (principal) return principal;
  // Fallback: aceita > enviada > gerada > mais recente
  const statusPriority: Record<string, number> = { aceita: 1, enviada: 2, gerada: 3 };
  const sorted = [...propostas].sort((a, b) => {
    const pa = statusPriority[a.status] ?? 99;
    const pb = statusPriority[b.status] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return sorted[0];
}

/**
 * Mutation para definir uma proposta como principal (toggle).
 * Removes principal from other proposals of the same deal.
 */
export function useSetPropostaPrincipal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propostaId, dealId }: { propostaId: string; dealId: string }) => {
      // Atomic RPC — single transaction, no race condition
      const { error } = await supabase.rpc("set_proposta_principal", {
        _deal_id: dealId,
        _proposta_id: propostaId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: "Proposta definida como principal ⭐" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao definir principal", description: err.message, variant: "destructive" });
    },
  });
}

/**
 * Mutation para arquivar uma proposta.
 */
export function useArquivarProposta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (propostaId: string) => {
      const { data, error } = await supabase.rpc("proposal_update_status" as any, {
        p_proposta_id: propostaId,
        p_new_status: "arquivada",
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: "Proposta arquivada" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao arquivar", description: err.message, variant: "destructive" });
    },
  });
}

/**
 * Mutation para excluir proposta (soft delete).
 * Preserva histórico — marca status como 'excluida' e grava deleted_at.
 */
export function useExcluirProposta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (propostaId: string) => {
      // Fetch deal_id before deleting so we can update deal values after
      const { data: propostaInfo } = await supabase
        .from("propostas_nativas")
        .select("deal_id, projeto_id")
        .eq("id", propostaId)
        .single();

      // Soft delete via SECURITY DEFINER RPC
      const { data, error } = await supabase.rpc("proposal_delete" as any, {
        p_proposta_id: propostaId,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      // After deletion, recalculate deal value/kwp from remaining active proposals
      const dealId = propostaInfo?.deal_id || propostaInfo?.projeto_id;
      if (dealId) {
        // Find remaining active proposals for this deal
        const { data: remaining } = await supabase
          .from("propostas_nativas")
          .select("id")
          .or(`deal_id.eq.${dealId},projeto_id.eq.${dealId}`)
          .neq("status", "excluida")
          .neq("id", propostaId)
          .limit(1);

        if (!remaining || remaining.length === 0) {
          // No active proposals left — clear deal value/kwp
          await supabase
            .from("deals")
            .update({ value: 0, kwp: 0 } as any)
            .eq("id", dealId);
        } else {
          // Get latest active proposal's version values
          const { data: latestVersion } = await supabase
            .from("proposta_versoes")
            .select("valor_total, potencia_kwp")
            .eq("proposta_id", remaining[0].id)
            .order("versao_numero", { ascending: false })
            .limit(1)
            .single();

          if (latestVersion) {
            await supabase
              .from("deals")
              .update({
                value: latestVersion.valor_total || 0,
                kwp: latestVersion.potencia_kwp || 0,
              } as any)
              .eq("id", dealId);
          }
        }
      }
    },
    onSuccess: () => {
      // Invalidate all proposal-related queries to ensure consistent state
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["proposal-detail"] });
      queryClient.invalidateQueries({ queryKey: ["proposta-expanded-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["proposta-expanded-ucs"] });
      queryClient.invalidateQueries({ queryKey: ["proposta-audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["proposal-version-snapshot"] });
      // Also invalidate deal pipeline to refresh kanban cards
      queryClient.invalidateQueries({ queryKey: ["deal-pipeline"] });
      // Invalidate proposals count query (replaces custom event)
      queryClient.invalidateQueries({ queryKey: ["deal-proposals-count"] });
      toast({ title: "Proposta excluída" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir proposta", description: err.message, variant: "destructive" });
    },
  });
}

// ─── Realtime sync ──────────────────────────────────
/**
 * Subscribes to realtime changes on propostas_nativas + proposta_versoes
 * for a specific deal/customer. Debounce 300ms.
 */
export function usePropostasRealtimeSync(dealId: string, customerId: string | null) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dealId && !customerId) return;

    const invalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEY, dealId, customerId] });
        queryClient.invalidateQueries({ queryKey: ["deal-proposals-count"] });
      }, 300);
    };

    const channel = supabase
      .channel(`propostas-nativas-realtime-${dealId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "propostas_nativas" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "proposta_versoes" }, invalidate)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [dealId, customerId, queryClient]);
}
