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
      return data as { success: boolean; counts: Record<string, number> };
    },
    onSuccess: (data) => {
      qc.clear();
      const c = data.counts;
      toast.success("Reset concluído", {
        description: `${c.clientes ?? 0} clientes, ${c.projetos ?? 0} projetos, ${c.propostas_nativas ?? 0} propostas apagados.`,
        duration: 8000,
      });
      setTimeout(() => window.location.reload(), 2000);
    },
    onError: (err: Error) => {
      toast.error("Erro ao resetar", { description: err.message });
    },
  });
}
