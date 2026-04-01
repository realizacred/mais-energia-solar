import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getCurrentTenantId } from "@/lib/storagePaths";

interface PagamentoManualParams {
  parcelaId: string;
  recebimentoId: string;
  valorPago: number;
  dataPagamento: string;
  formaPagamento: string;
  comprovanteFile?: File | null;
  bancoOrigem?: string | null;
  numeroCheque?: string | null;
  numeroAutorizacao?: string | null;
  gatewayUtilizado?: string | null;
  numeroParcelasCartao?: number | null;
  observacoes?: string | null;
  observacoesInternas?: string | null;
}

async function uploadComprovante(
  file: File,
  tenantId: string,
  parcelaId: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${tenantId}/pagamentos/${parcelaId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("comprovantes-pagamento")
    .upload(path, file, { upsert: true });

  if (error) throw new Error("Erro ao enviar comprovante: " + error.message);

  const { data: urlData } = supabase.storage
    .from("comprovantes-pagamento")
    .getPublicUrl(path);

  return urlData.publicUrl;
}

export function usePagamentoManual() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: PagamentoManualParams) => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error("Tenant não encontrado");

      // 1. Upload comprovante if present
      let comprovanteUrl: string | null = null;
      if (params.comprovanteFile) {
        comprovanteUrl = await uploadComprovante(
          params.comprovanteFile,
          tenantId,
          params.parcelaId
        );
      }

      // 2. Insert pagamento
      const { data: pagamento, error: pagErr } = await supabase
        .from("pagamentos")
        .insert({
          recebimento_id: params.recebimentoId,
          valor_pago: params.valorPago,
          forma_pagamento: params.formaPagamento,
          data_pagamento: params.dataPagamento,
          observacoes: params.observacoes || null,
          tenant_id: tenantId,
          parcela_id: params.parcelaId,
          comprovante_url: comprovanteUrl,
          banco_origem: params.bancoOrigem || null,
          numero_cheque: params.numeroCheque || null,
          numero_autorizacao: params.numeroAutorizacao || null,
          gateway_utilizado: params.gatewayUtilizado || null,
          numero_parcelas_cartao: params.numeroParcelasCartao || 1,
          observacoes_internas: params.observacoesInternas || null,
        } as any)
        .select("id")
        .single();

      if (pagErr) throw pagErr;

      // 3. Update parcela status
      const updateFields: Record<string, unknown> = {
        status: "paga",
        pagamento_id: pagamento.id,
      };

      // If parcela had a cobranca, mark it as paid
      const { data: parcelaData } = await supabase
        .from("parcelas")
        .select("cobranca_status")
        .eq("id", params.parcelaId)
        .maybeSingle();

      if (parcelaData?.cobranca_status === "gerada") {
        (updateFields as any).cobranca_status = "pago";
        (updateFields as any).cobranca_paga_em = new Date().toISOString();
      }

      const { error: parcErr } = await supabase
        .from("parcelas")
        .update(updateFields)
        .eq("id", params.parcelaId);

      if (parcErr) throw parcErr;

      // 4. Check if all parcelas are paid → close recebimento
      const { data: allParcelas } = await supabase
        .from("parcelas")
        .select("id, status")
        .eq("recebimento_id", params.recebimentoId);

      const allPaid = allParcelas?.every(
        (p) => p.status === "paga" || p.status === "cancelada"
      );

      if (allPaid) {
        await supabase
          .from("recebimentos")
          .update({ status: "pago" })
          .eq("id", params.recebimentoId);
      }

      return pagamento;
    },
    onSuccess: () => {
      toast({ title: "Pagamento registrado com sucesso!" });
      qc.invalidateQueries({ queryKey: ["parcelas-manager"] });
      qc.invalidateQueries({ queryKey: ["recebimentos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-dashboard"] });
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
