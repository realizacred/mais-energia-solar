import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DocumentTemplate, DocumentCategory } from "./types";

const QUERY_KEY = "document_templates";

// ── Shared helper ────────────────────────────────────────────
async function getTenantIdOrThrow(): Promise<{ tenantId: string; userId: string }> {
  const { data: profile } = await supabase.from("profiles").select("tenant_id").single();
  const tenantId = profile?.tenant_id;
  if (!tenantId) throw new Error("Tenant não encontrado");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Usuário não autenticado");
  return { tenantId, userId: user.id };
}

export function useDocumentTemplates(categoria?: DocumentCategory) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEY, categoria],
    queryFn: async () => {
      let q = supabase
        .from("document_templates")
        .select("*")
        .order("categoria")
        .order("nome");
      if (categoria) q = q.eq("categoria", categoria);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as DocumentTemplate[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (tpl: Partial<DocumentTemplate> & { id?: string }) => {
      const { tenantId, userId } = await getTenantIdOrThrow();

      const payload = {
        ...tpl,
        tenant_id: tenantId,
        updated_by: userId,
        form_schema: tpl.form_schema ? JSON.parse(JSON.stringify(tpl.form_schema)) : [],
        default_signers: tpl.default_signers ? JSON.parse(JSON.stringify(tpl.default_signers)) : [],
      };

      if (tpl.id) {
        // Update — never overwrite tenant_id, add tenant_id guard
        const { error } = await supabase
          .from("document_templates")
          .update(payload)
          .eq("id", tpl.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        // Insert — ensure defaults
        const { error } = await supabase.from("document_templates").insert({
          ...payload,
          created_by: userId,
          status: "active",
          version: 1,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Template salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { tenantId } = await getTenantIdOrThrow();
      const { error } = await supabase
        .from("document_templates")
        .update({ status: "archived" })
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Template arquivado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const tpl = query.data?.find(t => t.id === id);
      if (!tpl) throw new Error("Template não encontrado");
      const { tenantId, userId } = await getTenantIdOrThrow();

      const { error } = await supabase.from("document_templates").insert({
        tenant_id: tenantId,
        categoria: tpl.categoria,
        subcategoria: tpl.subcategoria,
        nome: `${tpl.nome} (cópia)`,
        descricao: tpl.descricao,
        docx_storage_path: tpl.docx_storage_path,
        version: 1,
        status: "active",
        requires_signature_default: tpl.requires_signature_default,
        default_signers: JSON.parse(JSON.stringify(tpl.default_signers)),
        form_schema: JSON.parse(JSON.stringify(tpl.form_schema)),
        created_by: userId,
        updated_by: userId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Template duplicado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, upsert, archive, duplicate };
}
