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
  docx_filled_path: string | null;
  pdf_path: string | null;
  signature_status: string | null;
  signature_provider: string | null;
  envelope_id: string | null;
  signed_at: string | null;
  observacao: string | null;
  template_name?: string;
  template_categoria?: string;
  requires_signature?: boolean;
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
        .select("id, title, status, created_at, template_id, docx_filled_path, pdf_path, pdf_filled_path, signature_status, signature_provider, envelope_id, signed_at, observacao")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });

      if (!docs || docs.length === 0) return [];

      // Fetch template names + requires_signature for enrichment
      const templateIds = [...new Set((docs as any[]).map(d => d.template_id))];
      const { data: tpls } = await supabase
        .from("document_templates")
        .select("id, nome, categoria, requires_signature_default")
        .in("id", templateIds);

      const tplMap = new Map((tpls || []).map((t: any) => [t.id, t]));

      return (docs as any[]).map(d => {
        const tpl = tplMap.get(d.template_id);
        return {
          ...d,
          pdf_path: d.pdf_path || d.pdf_filled_path || null,
          template_name: tpl?.nome || "—",
          template_categoria: tpl?.categoria || "outro",
          requires_signature: tpl?.requires_signature_default ?? false,
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

/** Download generated document (DOCX or PDF) from document-files bucket */
export async function downloadGeneratedDoc(filePath: string) {
  try {
    const { data, error } = await supabase.storage
      .from("document-files")
      .createSignedUrl(filePath, 300);
    if (error) throw error;
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  } catch (err: any) {
    toast({ title: "Erro ao baixar", description: err.message, variant: "destructive" });
  }
}

/** Gerar documento real a partir de template via Edge Function */
export function useGerarDocumento(dealId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, templateNome }: { templateId: string; templateNome?: string }) => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "bguhckqkpnziykpbwbeu";
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) throw new Error("Sessão inválida");

      const url = `https://${projectId}.supabase.co/functions/v1/generate-document`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": anonKey,
        },
        body: JSON.stringify({
          template_id: templateId,
          deal_id: dealId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao gerar documento");
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_DOCS, dealId] });
      queryClient.invalidateQueries({ queryKey: ["projeto-detalhe", dealId] });
      toast({
        title: "Documento gerado com sucesso!",
        description: `${result.variables_count} variáveis resolvidas.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao gerar documento", description: err.message, variant: "destructive" });
    },
  });
}

/** Enviar documento gerado para assinatura eletrônica via adapter pattern */
export function useEnviarParaAssinatura(dealId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentoId, tenantId, signers }: {
      documentoId: string;
      tenantId: string;
      signers?: Array<{ name: string; email: string; cpf?: string; phone?: string; role?: string }>;
    }) => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "bguhckqkpnziykpbwbeu";
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) throw new Error("Sessão inválida");

      const url = `https://${projectId}.supabase.co/functions/v1/signature-send`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": anonKey,
        },
        body: JSON.stringify({
          documento_id: documentoId,
          tenant_id: tenantId,
          ...(signers && signers.length > 0 ? { signers } : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao enviar para assinatura");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_DOCS, dealId] });
      toast({
        title: "Documento enviado para assinatura!",
        description: "O signatário receberá um e-mail para assinar.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao enviar para assinatura", description: err.message, variant: "destructive" });
    },
  });
}
