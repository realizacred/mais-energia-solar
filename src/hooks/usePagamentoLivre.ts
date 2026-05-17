import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getCurrentTenantId } from "@/lib/storagePaths";
import { formatBRL } from "@/lib/formatters";

const STALE_TIME = 1000 * 60 * 5;

interface PagamentoLivreParams {
  recebimentoId: string;
  valorPago: number;
  dataPagamento: string;
  formaPagamento: string;
  comprovanteFile?: File | null;
  bancoOrigem?: string | null;
  numeroCheque?: string | null;
  numeroAutorizacao?: string | null;
  numeroParcelasCartao?: number | null;
  observacoes?: string | null;
  observacoesInternas?: string | null;
}

async function uploadComprovante(
  file: File,
  tenantId: string,
  recebimentoId: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${tenantId}/pagamentos/${recebimentoId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("comprovantes-pagamento")
    .upload(path, file, { upsert: true });

  if (error) throw new Error("Erro ao enviar comprovante: " + error.message);

  const { data: urlData } = supabase.storage
    .from("comprovantes-pagamento")
    .getPublicUrl(path);

  return urlData.publicUrl;
}

export function usePagamentosDoRecebimento(recebimentoId: string | null) {
  return useQuery({
    queryKey: ["pagamentos-recebimento", recebimentoId],
    queryFn: async () => {
      if (!recebimentoId) return [];
      const { data, error } = await supabase
        .from("_deprecated_pagamentos")
        .select("id, valor_pago, forma_pagamento, data_pagamento, observacoes, comprovante_url, observacoes_internas")
        .eq("recebimento_id", recebimentoId)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!recebimentoId,
    staleTime: STALE_TIME,
  });
}

export function usePagamentoLivre() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: PagamentoLivreParams) => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error("Tenant não encontrado");

      let comprovanteUrl: string | null = null;
      if (params.comprovanteFile) {
        comprovanteUrl = await uploadComprovante(
          params.comprovanteFile,
          tenantId,
          params.recebimentoId
        );
      }

      // 2. Get project info
      const { data: recData } = await supabase
        .from("recebimentos")
        .select("projeto_id, cliente_id")
        .eq("id", params.recebimentoId)
        .single();

      // 3. Insert into lancamentos_financeiros
      const { data: lancamento, error: lancErr } = await supabase
        .from("lancamentos_financeiros")
        .insert({
          tenant_id: tenantId,
          tipo: "receita",
          valor: params.valorPago,
          forma_pagamento: params.formaPagamento,
          data_lancamento: params.dataPagamento,
          status: "confirmado",
          origem: "pagamento_livre",
          projeto_id: recData?.projeto_id,
          cliente_id: recData?.cliente_id,
          descricao: `Pagamento Avulso - ${params.recebimentoId}`,
          observacoes: params.observacoes
        } as any)
        .select("id")
        .single();

      if (lancErr) throw lancErr;

      // 4. Insert legacy record
      const { data: pagamento, error } = await supabase
        .from("_deprecated_pagamentos" as any)
        .insert({
          recebimento_id: params.recebimentoId,
          valor_pago: params.valorPago,
          forma_pagamento: params.formaPagamento,
          data_pagamento: params.dataPagamento,
          observacoes: params.observacoes || null,
          tenant_id: tenantId,
          parcela_id: null,
          comprovante_url: comprovanteUrl,
          banco_origem: params.bancoOrigem || null,
          numero_cheque: params.numeroCheque || null,
          numero_autorizacao: params.numeroAutorizacao || null,
          numero_parcelas_cartao: params.numeroParcelasCartao || 1,
          observacoes_internas: params.observacoesInternas || null,
        } as any)
        .select("id")
        .single();

      if (error) throw error;
      return pagamento;
    },
    onSuccess: (data, params) => {
      // Invalidate queries
      qc.invalidateQueries({ queryKey: ["pagamentos-recebimento", params.recebimentoId] });
      qc.invalidateQueries({ queryKey: ["recebimentos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-dashboard"] });
      qc.invalidateQueries({ queryKey: ["lancamentos_financeiros"] });

      // Fire-and-forget WA notification
      if ((data as any)?.id) {
        supabase.functions.invoke("notificar-pagamento-wa", {
          body: {
            pagamento_id: (data as any).id,
            tipo: "pagamento_recebido",
          },
        }).catch(() => { /* never block */ });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao registrar pagamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
