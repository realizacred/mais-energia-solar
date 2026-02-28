import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildStoragePath } from "@/lib/storagePaths";

export interface PostSaleAttachment {
  id: string;
  tenant_id: string;
  visit_id: string;
  file_url: string;
  label: string | null;
  created_at: string;
}

export function usePostSaleAttachments(visitId: string | undefined) {
  return useQuery<PostSaleAttachment[]>({
    queryKey: ["ps-attachments", visitId],
    enabled: !!visitId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("post_sale_attachments")
        .select("*")
        .eq("visit_id", visitId)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ visitId, file, label }: { visitId: string; file: File; label: string }) => {
      const ext = file.name.split(".").pop() || "jpg";
      const storagePath = await buildStoragePath("post-sale", visitId, `${Date.now()}.${ext}`);

      const { error: uploadError } = await supabase.storage
        .from("post_sale_attachments")
        .upload(storagePath, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("post_sale_attachments")
        .getPublicUrl(storagePath);

      const { error: dbError } = await (supabase as any)
        .from("post_sale_attachments")
        .insert({ visit_id: visitId, file_url: urlData.publicUrl, label });
      if (dbError) throw dbError;

      return visitId;
    },
    onSuccess: (visitId) => {
      qc.invalidateQueries({ queryKey: ["ps-attachments", visitId] });
      toast.success("Anexo enviado");
    },
    onError: () => toast.error("Erro ao enviar anexo"),
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, visitId }: { id: string; visitId: string }) => {
      const { error } = await (supabase as any)
        .from("post_sale_attachments")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return visitId;
    },
    onSuccess: (visitId) => {
      qc.invalidateQueries({ queryKey: ["ps-attachments", visitId] });
      toast.success("Anexo removido");
    },
    onError: () => toast.error("Erro ao remover anexo"),
  });
}
