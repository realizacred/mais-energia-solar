import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GerarCobrancaParams {
  parcela_id: string;
  gateway?: "pagseguro" | "asaas" | "inter" | "sicoob";
}

interface GerarCobrancaResult {
  success: boolean;
  cobranca_id: string;
  boleto_url: string | null;
  boleto_linha_digitavel: string | null;
  pix_qr_code: string | null;
  pix_copia_cola: string | null;
  valor_cobrado: number;
  multa_aplicada: number;
  juros_aplicado: number;
}

export function useGerarCobranca() {
  const queryClient = useQueryClient();

  return useMutation<GerarCobrancaResult, Error, GerarCobrancaParams>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.functions.invoke(
        "gerar-cobranca",
        { body: params },
      );
      if (error) throw error;
      return data as GerarCobrancaResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parcelas-manager"] });
      queryClient.invalidateQueries({ queryKey: ["recebimentos"] });
      toast.success("Cobrança gerada com sucesso");
    },
    onError: (err) => {
      toast.error("Erro ao gerar cobrança", { description: err.message });
    },
  });
}
