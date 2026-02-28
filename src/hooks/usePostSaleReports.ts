import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PostSaleReport {
  id: string;
  tenant_id: string;
  visit_id: string;
  storage_path: string;
  file_name: string | null;
  created_at: string;
  signedUrl?: string;
}

export function useVisitReport(visitId: string | undefined) {
  return useQuery<PostSaleReport | null>({
    queryKey: ["ps-report", visitId],
    enabled: !!visitId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("post_sale_reports")
        .select("*")
        .eq("visit_id", visitId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const { data: urlData } = await supabase.storage
        .from("post_sale_reports")
        .createSignedUrl(data.storage_path, 600);

      return { ...data, signedUrl: urlData?.signedUrl } as PostSaleReport;
    },
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (visitId: string) => {
      const { data, error } = await supabase.functions.invoke("generate-visit-report", {
        body: { visitId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { visitId, ...data };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["ps-report", result.visitId] });
      toast.success("Relatório gerado com sucesso");
    },
    onError: (err: Error) => toast.error(`Erro ao gerar relatório: ${err.message}`),
  });
}
