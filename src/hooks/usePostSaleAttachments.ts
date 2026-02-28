import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildStoragePath } from "@/lib/storagePaths";

export interface PostSaleAttachment {
  id: string;
  tenant_id: string;
  visit_id: string;
  storage_path: string;
  label: string | null;
  created_at: string;
  /** Resolved at runtime via signed URL */
  signedUrl?: string;
}

export function usePostSaleAttachments(visitId: string | undefined) {
  return useQuery<PostSaleAttachment[]>({
    queryKey: ["ps-attachments", visitId],
    enabled: !!visitId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("post_sale_attachments")
        .select("id, tenant_id, visit_id, storage_path, label, created_at")
        .eq("visit_id", visitId)
        .order("created_at");
      if (error) throw error;

      const attachments: PostSaleAttachment[] = data || [];

      // Generate signed URLs in parallel
      const withUrls = await Promise.all(
        attachments.map(async (att) => {
          const { data: urlData, error: urlErr } = await supabase.storage
            .from("post_sale_attachments")
            .createSignedUrl(att.storage_path, 600); // 10 min
          return {
            ...att,
            signedUrl: urlErr ? undefined : urlData?.signedUrl,
          };
        })
      );

      return withUrls;
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

      const { error: dbError } = await (supabase as any)
        .from("post_sale_attachments")
        .insert({ visit_id: visitId, storage_path: storagePath, label });
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
      // 1. Fetch storage_path
      const { data: att, error: fetchErr } = await (supabase as any)
        .from("post_sale_attachments")
        .select("storage_path")
        .eq("id", id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;

      // 2. Remove from storage
      if (att?.storage_path) {
        await supabase.storage
          .from("post_sale_attachments")
          .remove([att.storage_path]);
      }

      // 3. Delete DB row
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
