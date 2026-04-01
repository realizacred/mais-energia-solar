import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

interface ChargeData {
  parcela_id: string;
  gateway_charge_id: string | null;
  gateway_status: string;
  boleto_pdf_url: string | null;
  pix_payload: string | null;
  pix_qr_code_url: string | null;
}

export function useParcelasData(recebimentoId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["parcelas-manager", recebimentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas")
        .select("id, numero_parcela, valor, data_vencimento, status, pagamento_id, recebimento_id")
        .eq("recebimento_id", recebimentoId)
        .order("numero_parcela");

      if (error) throw error;
      const parcelas = data || [];

      // Fetch existing charges for these parcelas
      let charges = new Map<string, ChargeData>();
      if (parcelas.length > 0) {
        const ids = parcelas.map((p) => p.id);
        const { data: chargeRows } = await supabase
          .from("payment_gateway_charges")
          .select("parcela_id, gateway_charge_id, gateway_status, boleto_pdf_url, pix_payload, pix_qr_code_url")
          .in("parcela_id", ids);

        chargeRows?.forEach((c) => charges.set(c.parcela_id, c as ChargeData));
      }

      return { parcelas, charges };
    },
    enabled,
    staleTime: STALE_TIME,
  });
}

export function useGatewayActive() {
  return useQuery({
    queryKey: ["payment-gateway-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_gateway_config")
        .select("is_active")
        .eq("provider", "asaas")
        .maybeSingle();
      return data?.is_active ?? false;
    },
    staleTime: 1000 * 60 * 15,
  });
}
