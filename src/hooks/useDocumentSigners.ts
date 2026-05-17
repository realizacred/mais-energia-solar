/**
 * Per-document signer panel data + realtime sync + resend mutation.
 * §16 / §23: queries em hooks, staleTime obrigatório, realtime synchronous cleanup.
 */
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface DocumentSignerRow {
  id: string;
  tenant_id: string;
  document_id: string;
  provider_signer_id: string | null;
  name: string;
  email: string | null;
  cpf: string | null;
  phone: string | null;
  role: string | null;
  order_index: number;
  status: "pending" | "viewed" | "signed" | "refused" | "signed_fisico" | "cancelled";
  sign_url: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  refused_at: string | null;
  last_resent_at: string | null;
  assinado_por_tipo: "digital" | "fisico";
  observacao: string | null;
  assinado_at: string | null;
}

const QUERY_KEY = "document-signers" as const;
const STALE_TIME = 1000 * 30;

export function useDocumentSigners(documentId: string | undefined | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEY, documentId],
    enabled: !!documentId,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_signers" as any)
        .select("*")
        .eq("document_id", documentId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DocumentSignerRow[];
    },
  });

  // Realtime: any change to this document's signers refreshes the panel
  useEffect(() => {
    if (!documentId) return;
    const channel = supabase
      .channel(`doc-signers-${documentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "document_signers", filter: `document_id=eq.${documentId}` },
        () => qc.invalidateQueries({ queryKey: [QUERY_KEY, documentId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId, qc]);

  return query;
}

export function useResendSigner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (signerId: string) => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "bguhckqkpnziykpbwbeu";
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão inválida");

      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/signature-resend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": anonKey,
        },
        body: JSON.stringify({ signer_id: signerId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao reenviar");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Reenvio solicitado", description: "O signatário receberá uma nova notificação." });
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao reenviar", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateSignerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      signerId, 
      status, 
      assinadoAt, 
      observacao, 
      assinadoPorTipo 
    }: { 
      signerId: string; 
      status: DocumentSignerRow["status"]; 
      assinadoAt?: string; 
      observacao?: string;
      assinadoPorTipo?: "digital" | "fisico";
    }) => {
      const updateData: any = { 
        status, 
        updated_at: new Date().toISOString() 
      };
      
      if (assinadoAt) updateData.assinado_at = assinadoAt;
      if (observacao) updateData.observacao = observacao;
      if (assinadoPorTipo) updateData.assinado_por_tipo = assinadoPorTipo;
      
      if (status === "signed_fisico") {
        updateData.signed_at = assinadoAt || new Date().toISOString();
      }

      const { data: signer, error: fetchError } = await supabase
        .from("document_signers")
        .select("document_id")
        .eq("id", signerId)
        .maybeSingle();
      
      if (fetchError || !signer) throw fetchError || new Error("Signatário não encontrado");

      const docId = (signer as any).document_id;

      const { error } = await supabase
        .from("document_signers")
        .update(updateData)
        .eq("id", signerId);
      
      if (error) throw error;

      const { data: allSigners, error: signersError } = await supabase
        .from("document_signers")
        .select("status")
        .eq("document_id", docId);
      
      if (!signersError && allSigners) {
        const allSigned = (allSigners as any[]).every(s => s.status === "signed" || s.status === "signed_fisico");
        if (allSigned) {
          await supabase
            .from("generated_documents")
            .update({ status: "signed" }) 
            .eq("id", docId);
        }
      }

      return { documentId: docId };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, data.documentId] });
      qc.invalidateQueries({ queryKey: ["projeto-documentos-generated"] });
      toast({ title: "Signatário atualizado" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });
}
