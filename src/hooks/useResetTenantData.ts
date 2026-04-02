import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useResetTenantData() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("reset-tenant-data", {
        body: { confirm: "APAGAR TUDO" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; tenantId?: string; counts?: Record<string, number> };
    },
    onSuccess: (data) => {
      qc.clear();
      const c = data?.counts ?? {};
      const parts = [
        c.clientes && `${c.clientes} clientes`,
        c.projetos && `${c.projetos} projetos`,
        c.propostas_nativas && `${c.propostas_nativas} propostas`,
        c.proposta_versoes && `${c.proposta_versoes} versões`,
        c.deals && `${c.deals} deals`,
        c.recebimentos && `${c.recebimentos} recebimentos`,
      ].filter(Boolean);

      toast.success("✅ Reset concluído!", {
        description: parts.length > 0
          ? parts.join(", ") + " apagados."
          : "Todos os dados foram apagados.",
        duration: 8000,
      });
      setTimeout(() => window.location.reload(), 2000);
    },
    onError: (err: Error) => {
      toast.error("Erro ao resetar", { description: err.message });
    },
  });
}
