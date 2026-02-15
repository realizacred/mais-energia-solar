import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DocumentTemplate, DocumentCategory, FormFieldSchema, DefaultSigner } from "./types";

const QUERY_KEY = "document_templates";

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
      const { data: profile } = await supabase.from("profiles").select("tenant_id").single();
      const tenant_id = profile?.tenant_id;
      if (!tenant_id) throw new Error("Tenant não encontrado");

      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        ...tpl,
        tenant_id,
        updated_by: user?.id,
        ...(tpl.id ? {} : { created_by: user?.id }),
        form_schema: tpl.form_schema ? JSON.parse(JSON.stringify(tpl.form_schema)) : [],
        default_signers: tpl.default_signers ? JSON.parse(JSON.stringify(tpl.default_signers)) : [],
      };

      if (tpl.id) {
        const { error } = await supabase.from("document_templates").update(payload).eq("id", tpl.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("document_templates").insert(payload as any);
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
      const { error } = await supabase.from("document_templates").update({ status: "archived" }).eq("id", id);
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
      const { data: profile } = await supabase.from("profiles").select("tenant_id").single();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("document_templates").insert({
        tenant_id: profile?.tenant_id,
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
        created_by: user?.id,
        updated_by: user?.id,
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
