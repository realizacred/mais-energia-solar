import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { buildStoragePath } from "@/lib/storagePaths";
import { normalizeProjectDocuments, resolveDocumentCategory } from "@/lib/documentDedup";
import { getStorageBucket } from "@/lib/storage";

export type ProjectDocumentOrigem =
  | "manual"
  | "generated"
  | "custom_field"
  | "checklist_cliente"
  | "checklist_instalador"
  | "checklist_doc"
  | "post_sale"
  | "legacy"
  | "recibo";

export interface ProjectDocument {
  id: string;
  tenant_id: string;
  projeto_id: string | null;
  deal_id: string | null;
  proposta_id: string | null;
  cliente_id: string | null;
  categoria: string | null;
  display_name: string | null;
  origem: ProjectDocumentOrigem;
  bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  checksum: string | null;
  uploaded_by: string | null;
  metadata: Record<string, any>;
  source_table: string | null;
  source_id: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface NormalizedProjectDocuments {
  documents: ProjectDocument[];
  totalUnique: number;
  totalSize: number;
  groupedByCategory: Record<string, ProjectDocument[]>;
}

export interface UseProjectDocumentsParams {
  projetoId?: string | null;
  dealId?: string | null;
  propostaId?: string | null;
}

const STALE = 1000 * 30;

export function useProjectDocuments({ projetoId, dealId, propostaId }: UseProjectDocumentsParams) {
  return useQuery<NormalizedProjectDocuments>({
    queryKey: ["project-documents", projetoId, dealId, propostaId],
    enabled: !!(projetoId || dealId || propostaId),
    staleTime: STALE,
    queryFn: async () => {
      let q = supabase
        .from("project_documents")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (projetoId) q = q.eq("projeto_id", projetoId);
      else if (dealId) q = q.eq("deal_id", dealId);
      else if (propostaId) q = q.eq("proposta_id", propostaId);

      const { data, error } = await q;
      if (error) throw error;

      const rawDocs = (data ?? []) as unknown as ProjectDocument[];
      return normalizeProjectDocuments(rawDocs);
    },
  });
}

/** Upload manual direto na tabela canônica (origem='manual'). */
export function useUploadProjectDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      projetoId,
      dealId,
      categoria,
    }: {
      file: File;
      projetoId?: string | null;
      dealId?: string | null;
      categoria?: string | null;
    }) => {
      // 1. MIME Validation
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(file.type)) {
        throw new Error("Tipo de arquivo não permitido. Use PDF, JPEG, PNG ou WEBP.");
      }

      // 2. Size Validation (10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("Arquivo muito grande. Limite de 10MB.");
      }

      const { tenantId, userId } = await getCurrentTenantId();
      const ext = file.name.split(".").pop() || "bin";
      const ref = projetoId || dealId || "misc";
      const bucket = getStorageBucket("projeto");
      const storagePath = await buildStoragePath(
        bucket,
        ref,
        `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
      );

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file, { 
          upsert: false, 
          contentType: file.type,
          cacheControl: '3600'
        });

      if (upErr) throw upErr;

      const { data, error } = await supabase
        .from("project_documents")
        .insert({
          tenant_id: tenantId,
          projeto_id: projetoId ?? null,
          deal_id: dealId ?? null,
          categoria: categoria ?? "Manual",
          origem: "manual",
          bucket: bucket,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_by: userId,
        })
        .select("id")
        .single();

      if (error) throw error;

      await supabase.from("project_document_events").insert({
        tenant_id: tenantId,
        document_id: data.id,
        event: "upload",
        actor_id: userId,
        metadata: { file_name: file.name, size_bytes: file.size },
      });

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-documents"] });
      toast({ title: "Documento enviado" });
    },
  });
}

/** Soft-delete. */
export function useDeleteProjectDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: ProjectDocument) => {
      if (doc.origem !== "manual") {
        throw new Error("Este documento é gerenciado por outro módulo.");
      }
      const { tenantId, userId } = await getCurrentTenantId();
      const { error } = await supabase
        .from("project_documents")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", doc.id);
      if (error) throw error;

      await supabase.from("project_document_events").insert({
        tenant_id: tenantId,
        document_id: doc.id,
        event: "delete",
        actor_id: userId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-documents"] });
      toast({ title: "Documento removido" });
    },
  });
}

/** Renomeia documento. */
export function useRenameProjectDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, newName }: { docId: string; newName: string }) => {
      const { tenantId, userId } = await getCurrentTenantId();
      const { error } = await supabase
        .from("project_documents")
        .update({ display_name: newName, updated_at: new Date().toISOString() })
        .eq("id", docId);
      if (error) throw error;

      await supabase.from("project_document_events").insert({
        tenant_id: tenantId,
        document_id: docId,
        event: "rename",
        actor_id: userId,
        metadata: { new_name: newName },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-documents"] });
      toast({ title: "Documento renomeado" });
    },
  });
}

/** Altera categoria. */
export function useUpdateProjectDocumentCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, newCategory }: { docId: string; newCategory: string }) => {
      const { tenantId, userId } = await getCurrentTenantId();
      const { error } = await supabase
        .from("project_documents")
        .update({ categoria: newCategory, updated_at: new Date().toISOString() })
        .eq("id", docId);
      if (error) throw error;

      await supabase.from("project_document_events").insert({
        tenant_id: tenantId,
        document_id: docId,
        event: "category_change",
        actor_id: userId,
        metadata: { new_category: newCategory },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-documents"] });
      toast({ title: "Categoria atualizada" });
    },
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: async (doc: ProjectDocument) => {
      const { data, error } = await supabase.storage
        .from(doc.bucket)
        .createSignedUrl(doc.storage_path, 60); // 60 seconds expiry

      if (error) throw error;
      return data.signedUrl;
    },
    onSuccess: (url) => {
      window.open(url, '_blank');
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao baixar arquivo",
        description: error.message,
        variant: "destructive",
      });
    }
  });
}
