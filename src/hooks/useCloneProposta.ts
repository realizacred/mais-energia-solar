/**
 * useCloneProposta.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 *
 * Hook para clonar uma proposta (mesmo projeto ou outro projeto).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STALE_TIME = 1000 * 60 * 5;

export interface ProjetoOption {
  id: string;
  nome: string;
  cliente_nome: string | null;
}

/**
 * Lista projetos disponíveis para clonar proposta.
 */
export function useProjetosParaClone(enabled: boolean) {
  return useQuery({
    queryKey: ["projetos-para-clone"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos" as any)
        .select("id, nome, cliente_id, clientes(nome)")
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map((p: any): ProjetoOption => ({
        id: p.id,
        nome: p.nome || "Sem nome",
        cliente_nome: p.clientes?.nome || null,
      }));
    },
    staleTime: STALE_TIME,
    enabled,
  });
}

interface ClonePayload {
  propostaId: string;
  titulo: string;
  targetDealId: string;
  customerId: string | null;
}

/**
 * Mutation para clonar proposta.
 * Duplica propostas_nativas + proposta_versoes (snapshot) + proposta_versao_ucs.
 * NÃO copia artefatos (PDF/DOCX) — proposta nova nasce sem arquivo gerado.
 */
export function useCloneProposta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propostaId, titulo, targetDealId, customerId }: ClonePayload) => {
      // 1. Fetch original proposal
      const { data: original, error: origErr } = await (supabase as any)
        .from("propostas_nativas")
        .select("id, titulo, codigo, versao_atual, status, cliente_id, deal_id, tenant_id")
        .eq("id", propostaId)
        .single();
      if (origErr) throw origErr;

      // 2. Fetch latest version with snapshot
      const { data: latestVersao, error: verErr } = await supabase
        .from("proposta_versoes")
        .select("id, versao_numero, snapshot, final_snapshot, valor_total, potencia_kwp, economia_mensal, geracao_mensal, payback_meses, status")
        .eq("proposta_id", propostaId)
        .order("versao_numero", { ascending: false })
        .limit(1)
        .single();
      if (verErr) throw verErr;

      // 3. Create new proposal
      const { data: newProposta, error: newErr } = await (supabase as any)
        .from("propostas_nativas")
        .insert({
          titulo,
          deal_id: targetDealId,
          cliente_id: customerId || original.cliente_id,
          tenant_id: original.tenant_id,
          versao_atual: 1,
          status: "rascunho",
          is_principal: false,
        })
        .select("id")
        .single();
      if (newErr) throw newErr;

      // 4. Clone version (without artefacts)
      const { data: newVersao, error: nvErr } = await supabase
        .from("proposta_versoes")
        .insert({
          proposta_id: newProposta.id,
          versao_numero: 1,
          snapshot: latestVersao.snapshot,
          final_snapshot: null, // Not copying final snapshot — needs re-generation
          valor_total: latestVersao.valor_total,
          potencia_kwp: latestVersao.potencia_kwp,
          economia_mensal: latestVersao.economia_mensal,
          geracao_mensal: latestVersao.geracao_mensal,
          payback_meses: latestVersao.payback_meses,
          status: "rascunho",
          output_pdf_path: null,
          output_docx_path: null,
          public_slug: null,
          gerado_em: null,
        } as any)
        .select("id")
        .single();
      if (nvErr) throw nvErr;

      // 5. Clone UCs
      const { data: ucs } = await supabase
        .from("proposta_versao_ucs")
        .select("nome, consumo_mensal_kwh, geracao_mensal_estimada, tarifa_energia, percentual_atendimento, is_geradora, ordem, tipo_fornecimento, tensao_nominal, numero_uc, distribuidora_nome")
        .eq("versao_id", latestVersao.id)
        .order("ordem");

      if (ucs && ucs.length > 0) {
        const ucInserts = ucs.map((uc: any) => ({
          ...uc,
          versao_id: newVersao.id,
        }));
        await supabase.from("proposta_versao_ucs").insert(ucInserts);
      }

      return { newPropostaId: newProposta.id, newVersaoId: newVersao.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propostas-projeto-tab"] });
      toast({ title: "Proposta clonada com sucesso! ✅" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao clonar proposta", description: err.message, variant: "destructive" });
    },
  });
}
