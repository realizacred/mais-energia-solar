// Recibos — emissão, listagem, PDF.
// SSOT: tabela `recibos_emitidos` + bucket `recibos`.
// Reutiliza document_templates (categoria='recibo').
// §16/§23: queries em hooks com staleTime; invalidação após mutações.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { toast } from "sonner";

const QUERY_KEY = "recibos_emitidos" as const;
const STALE_TIME = 1000 * 60 * 2;

export interface ReciboEmitido {
  id: string;
  tenant_id: string;
  template_id: string;
  cliente_id: string;
  projeto_id: string | null;
  deal_id: string | null;
  numero: string | null;
  descricao: string | null;
  valor: number;
  dados_preenchidos: Record<string, unknown>;
  status: "emitido" | "enviado" | "assinado" | "cancelado";
  pdf_path: string | null;
  emitido_em: string;
  created_at: string;
  updated_at: string;
  // join opcional
  cliente?: { id: string; nome: string; cpf_cnpj: string | null } | null;
  template?: { id: string; nome: string } | null;
}

export interface ReciboFilters {
  cliente_id?: string;
  projeto_id?: string;
  deal_id?: string;
}

export function useRecibos(filters: ReciboFilters = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: async () => {
      let q = supabase
        .from("recibos_emitidos" as any)
        .select(
          "id, tenant_id, template_id, cliente_id, projeto_id, deal_id, numero, descricao, valor, dados_preenchidos, status, pdf_path, emitido_em, created_at, updated_at, cliente:clientes(id, nome, cpf_cnpj), template:document_templates(id, nome)"
        )
        .is("deleted_at", null)
        .order("emitido_em", { ascending: false });

      if (filters.cliente_id) q = q.eq("cliente_id", filters.cliente_id);
      if (filters.projeto_id) q = q.eq("projeto_id", filters.projeto_id);
      if (filters.deal_id) q = q.eq("deal_id", filters.deal_id);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ReciboEmitido[];
    },
    staleTime: STALE_TIME,
  });
}

export interface EmitirReciboInput {
  template_id: string;
  cliente_id: string;
  projeto_id?: string | null;
  deal_id?: string | null;
  descricao?: string;
  numero?: string;
  valor: number;
  dados_preenchidos: Record<string, unknown>;
  generate_pdf?: boolean;
}

export function useEmitirRecibo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: EmitirReciboInput) => {
      const { tenantId, userId } = await getCurrentTenantId();

      const { data, error } = await supabase
        .from("recibos_emitidos" as any)
        .insert({
          tenant_id: tenantId,
          template_id: input.template_id,
          cliente_id: input.cliente_id,
          projeto_id: input.projeto_id ?? null,
          deal_id: input.deal_id ?? null,
          numero: input.numero ?? null,
          descricao: input.descricao ?? null,
          valor: input.valor,
          dados_preenchidos: input.dados_preenchidos as any,
          status: "emitido",
          created_by: userId,
          updated_by: userId,
        } as any)
        .select("id")
        .single();

      if (error) throw error;
      const reciboId = (data as any).id as string;

      if (input.generate_pdf !== false) {
        try {
          await supabase.functions.invoke("generate-recibo-pdf", {
            body: { recibo_id: reciboId },
          });
        } catch (e) {
          console.warn("[useEmitirRecibo] PDF generation failed (non-fatal):", e);
        }
      }

      return reciboId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Recibo emitido");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao emitir recibo"),
  });
}

/** Gera (ou regera) PDF do recibo via Gotenberg. Atualiza pdf_path. */
export function useReciboPDF() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reciboId: string) => {
      const { data, error } = await supabase.functions.invoke("generate-recibo-pdf", {
        body: { recibo_id: reciboId },
      });
      if (error) throw error;
      return data as { pdf_path: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("PDF gerado");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao gerar PDF"),
  });
}

/** Retorna URL assinada para download/visualização do PDF. */
export async function getReciboSignedUrl(pdfPath: string, expiresIn = 60 * 5): Promise<string> {
  const { data, error } = await supabase.storage
    .from("recibos")
    .createSignedUrl(pdfPath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/** Envia recibo via WhatsApp (gera PDF se necessário, atualiza status, registra log). */
export function useEnviarReciboWa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { recibo_id: string; telefone?: string; mensagem?: string }) => {
      const { data, error } = await supabase.functions.invoke("enviar-recibo-wa", {
        body: input,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { success: boolean; link_pdf: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ["recibo_logs"] });
      toast.success("Recibo enviado por WhatsApp");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao enviar recibo"),
  });
}

export interface ReciboLog {
  id: string;
  recibo_id: string;
  tipo: string;
  canal: string | null;
  destino: string | null;
  mensagem: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export function useReciboLogs(reciboId: string | null | undefined) {
  return useQuery({
    queryKey: ["recibo_logs", reciboId],
    enabled: !!reciboId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recibo_logs" as any)
        .select("id, recibo_id, tipo, canal, destino, mensagem, meta, created_at")
        .eq("recibo_id", reciboId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ReciboLog[];
    },
    staleTime: STALE_TIME,
  });
}

export function useDeleteRecibo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recibos_emitidos" as any)
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Recibo excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
