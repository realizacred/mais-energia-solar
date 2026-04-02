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
      return data as { success: boolean; tenantId?: string; results?: Record<string, { ok: boolean; error?: string }> };
    },
    onSuccess: (data) => {
      qc.clear();
      const results = data?.results ?? {};
      const hasErrors = Object.values(results).some((r) => !r?.ok);
      toast.success("Reset concluído", {
        description: hasErrors
          ? "Alguns dados foram apagados, mas houve erros em algumas tabelas."
          : "Todos os dados foram apagados com sucesso.",
        duration: 8000,
      });
      setTimeout(() => window.location.reload(), 2000);
    },
    onError: (err: Error) => {
      toast.error("Erro ao resetar", { description: err.message });
    },
  });
}
