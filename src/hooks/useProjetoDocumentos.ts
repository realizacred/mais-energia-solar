import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────
export interface StorageFile {
  name: string;
  id: string | null;
  created_at: string | null;
  metadata: { size?: number; mimetype?: string } | null;
}

export interface GeneratedDocRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  template_id: string;
  template_name?: string;
  template_categoria?: string;
}

export interface DocTemplate {
  id: string;
  nome: string;
  categoria: string;
}

// ─── Constants ────────────────────────────────────
const STALE_TIME = 1000 * 60 * 5; // 5 min
const QUERY_KEY_FILES = "projeto-documentos-files" as const;
const QUERY_KEY_DOCS = "projeto-documentos-generated" as const;
const QUERY_KEY_TEMPLATES = "projeto-documentos-templates" as const;

// ─── Helpers ──────────────────────────────────────
async function getTenantId(): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .limit(1)
    .single();
  if (!profile) throw new Error("Perfil não encontrado");
  return (profile as any).tenant_id;
}

// ─── Hooks ────────────────────────────────────────

/** Lista arquivos do storage do projeto */
export function useProjetoArquivos(dealId: string) {
  return useQuery({
    queryKey: [QUERY_KEY_FILES, dealId],
    queryFn: async () => {
      const tenantId = await getTenantId();
      const path = `${tenantId}/deals/${dealId}`;
      const { data } = await supabase.storage
        .from("projeto-documentos")
        .list(path, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      return (data || []) as StorageFile[];
    },
    staleTime: STALE_TIME,
    enabled: !!dealId,
  });
}

/** Lista documentos gerados do projeto com dados do template */
export function useProjetoDocumentosGerados(dealId: string) {
  return useQuery({
    queryKey: [QUERY_KEY_DOCS, dealId],
    queryFn: async () => {
      const { data: docs } = await supabase
        .from("generated_documents")
        .select("id, title, status, created_at, template_id")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });

      if (!docs || docs.length === 0) return [];

      // Fetch template names for enrichment
      const templateIds = [...new Set((docs as any[]).map(d => d.template_id))];
      const { data: tpls } = await supabase
        .from("document_templates")
        .select("id, nome, categoria")
        .in("id", templateIds);

      const tplMap = new Map((tpls || []).map((t: any) => [t.id, t]));

      return (docs as any[]).map(d => {
        const tpl = tplMap.get(d.template_id);
        return {
          ...d,
          template_name: tpl?.nome || "—",
          template_categoria: tpl?.categoria || "outro",
        } as GeneratedDocRow;
      });
    },
    staleTime: STALE_TIME,
    enabled: !!dealId,
  });
}

/** Lista templates de documento ativos */
export function useDocTemplates() {
  return useQuery({
    queryKey: [QUERY_KEY_TEMPLATES],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_templates")
        .select("id, nome, categoria")
        .eq("status", "active")
        .order("categoria")
        .order("nome");
      return (data || []).map((t: any) => ({
        id: t.id,
        nome: t.nome,
        categoria: t.categoria,
      })) as DocTemplate[];
    },
    staleTime: 1000 * 60 * 15, // 15 min — dados estáticos
  });
}

/** Upload de arquivo(s) ao storage do projeto */
export function useUploadArquivo(dealId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileList: FileList) => {
      await supabase.auth.refreshSession();
      const tenantId = await getTenantId();
      const basePath = `${tenantId}/deals/${dealId}`;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const fileName = `${Date.now()}_${file.name}`;
        const { error } = await supabase.storage
          .from("projeto-documentos")
          .upload(`${basePath}/${fileName}`, file, { upsert: false });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_FILES, dealId] });
      toast({ title: "Arquivo(s) enviado(s) com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    },
  });
}

/** Deletar arquivo do storage */
export function useDeletarArquivo(dealId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileName: string) => {
      const tenantId = await getTenantId();
      const path = `${tenantId}/deals/${dealId}/${fileName}`;
      const { error } = await supabase.storage.from("projeto-documentos").remove([path]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_FILES, dealId] });
      toast({ title: "Arquivo removido" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });
}

/** Baixar arquivo via signed URL */
export async function downloadArquivo(dealId: string, fileName: string) {
  try {
    const tenantId = await getTenantId();
    const path = `${tenantId}/deals/${dealId}/${fileName}`;
    const { data, error } = await supabase.storage.from("projeto-documentos").createSignedUrl(path, 300);
    if (error) throw error;
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  } catch (err: any) {
    toast({ title: "Erro ao baixar", description: err.message, variant: "destructive" });
  }
}

/** Gerar documento a partir de template */
export function useGerarDocumento(dealId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, templateNome }: { templateId: string; templateNome?: string }) => {
      const tenantId = await getTenantId();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão inválida");

      const { error } = await supabase.from("generated_documents").insert({
        tenant_id: tenantId,
        deal_id: dealId,
        template_id: templateId,
        template_version: 1,
        title: templateNome || "Documento",
        status: "draft",
        input_payload: {},
        created_by: user.id,
        updated_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_DOCS, dealId] });
      toast({ title: "Documento criado", description: "O documento foi gerado como rascunho." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao gerar", description: err.message, variant: "destructive" });
    },
  });
}
