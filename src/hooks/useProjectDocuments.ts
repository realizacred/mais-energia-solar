/**
 * SSOT canônico de documentos do projeto.
 * Lê de `project_documents` (tabela canônica espelhada via triggers
 * de `generated_documents`, `post_sale_attachments`, `doc_checklist_status`,
 * `checklist_cliente_arquivos`, `checklist_instalador_arquivos`).
 *
 * §16 queries só em hooks, §23 staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { buildStoragePath } from "@/lib/storagePaths";

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

import { normalizeProjectDocuments } from "@/lib/documentDedup";

const STALE = 1000 * 30;

export function useProjectDocuments({ projetoId, dealId, propostaId }: UseProjectDocumentsParams) {
  return useQuery<NormalizedProjectDocuments>({
    queryKey: ["project-documents", projetoId, dealId, propostaId],
    enabled: !!(projetoId || dealId || propostaId),
    staleTime: STALE,
    queryFn: async () => {
      let q = supabase
        .from("project_documents" as any)
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
      const { tenantId, userId } = await getCurrentTenantId();
      const ext = file.name.split(".").pop() || "bin";
      const ref = projetoId || dealId || "misc";
      const storagePath = await buildStoragePath(
        "project-documents",
        ref,
        `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
      );

      const { error: upErr } = await supabase.storage
        .from("project-documents")
        .upload(storagePath, file, { upsert: false, contentType: file.type });
      if (upErr) {
        console.error("[useUploadProjectDocument] storage upload failed", {
          storagePath,
          bucket: "project-documents",
          fileName: file.name,
          mime: file.type,
          size: file.size,
          error: upErr,
        });
        const msg = (upErr as any)?.message || "Falha desconhecida no Storage";
        const statusCode = (upErr as any)?.statusCode || (upErr as any)?.status;
        throw new Error(
          `Storage [${statusCode ?? "?"}]: ${msg}` +
            (String(msg).toLowerCase().includes("row-level security")
              ? " — verifique se as policies RLS do bucket 'project-documents' permitem INSERT para seu tenant."
              : ""),
        );
      }

      const { data, error } = await supabase
        .from("project_documents" as any)
        .insert({
          tenant_id: tenantId,
          projeto_id: projetoId ?? null,
          deal_id: dealId ?? null,
          categoria: categoria ?? "Manual",
          origem: "manual",
          bucket: "project-documents",
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_by: userId,
        })
        .select("id, projeto_id, deal_id, tenant_id")
        .single();
      if (error) throw error;

      // Auditoria
      await supabase.from("project_document_events" as any).insert({
        tenant_id: tenantId,
        document_id: (data as any).id,
        event: "upload",
        actor_id: userId,
        metadata: { file_name: file.name, size_bytes: file.size },
      });

      return data;
    },
    onSuccess: async (data: any, variables) => {
      qc.invalidateQueries({ queryKey: ["project-documents"] });
      toast({ title: "Documento enviado" });

      // Invalida também a query do detalhe para refletir mudança de etapa via trigger do banco
      const { dealId } = variables;
      if (dealId) {
        qc.invalidateQueries({ queryKey: ["projeto-detalhe", dealId] });
      }
    },
    onError: (e: any) => {
      console.error("[useUploadProjectDocument] mutation error", e);
      toast({
        title: "Erro ao enviar documento",
        description: e?.message || "Erro desconhecido. Veja o console para detalhes.",
        variant: "destructive",
      });
    },
  });
}

/** Soft-delete (apenas documentos com origem='manual'). */
export function useDeleteProjectDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: ProjectDocument) => {
      if (doc.origem !== "manual") {
        throw new Error(
          "Este documento é projetado de outro módulo. Remova-o pela origem (proposta, checklist, pós-venda).",
        );
      }
      const { tenantId, userId } = await getCurrentTenantId();
      const { error } = await supabase
        .from("project_documents" as any)
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", doc.id);
      if (error) throw error;
      await supabase.storage.from(doc.bucket).remove([doc.storage_path]).catch(() => {});
      await supabase.from("project_document_events" as any).insert({
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
    onError: (e: any) =>
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });
}

/** Renomeia documento (apenas display_name). */
export function useRenameProjectDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, newName }: { docId: string; newName: string }) => {
      const { tenantId, userId } = await getCurrentTenantId();
      
      const { error } = await supabase
        .from("project_documents" as any)
        .update({ display_name: newName, updated_at: new Date().toISOString() })
        .eq("id", docId);
        
      if (error) throw error;
      
      await supabase.from("project_document_events" as any).insert({
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
    onError: (e: any) =>
      toast({ title: "Erro ao renomear", description: e.message, variant: "destructive" }),
  });
}

/** Altera categoria do documento. */
export function useUpdateProjectDocumentCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, newCategory }: { docId: string; newCategory: string }) => {
      const { tenantId, userId } = await getCurrentTenantId();
      
      const { error } = await supabase
        .from("project_documents" as any)
        .update({ categoria: newCategory, updated_at: new Date().toISOString() })
        .eq("id", docId);
        
      if (error) throw error;
      
      await supabase.from("project_document_events" as any).insert({
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
    onError: (e: any) =>
      toast({ title: "Erro ao atualizar categoria", description: e.message, variant: "destructive" }),
  });
}
