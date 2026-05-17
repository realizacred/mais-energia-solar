// Recibos — emissão, listagem, PDF.
// SSOT: tabela `recibos_emitidos` + bucket `recibos`.
// Reutiliza document_templates (categoria='recibo').
// §16/§23: queries em hooks com staleTime; invalidação após mutações.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { toast } from "sonner";

const QUERY_KEY = "recibos" as const;
const STALE_TIME = 1000 * 60 * 2;

export interface Recibo {
  id: string;
  tenant_id: string;
  projeto_id: string;
  cliente_id: string | null;
  template: string;
  numero: string | null;
  valor: number;
  forma_pagamento: string;
  descricao: string | null;
  data_pagamento: string;
  status: "emitido" | "cancelado";
  pdf_url: string | null;
  campos_extras: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
  // join opcional
  cliente?: { id: string; nome: string; cpf_cnpj: string | null } | null;
}

export interface ReciboFilters {
  cliente_id?: string;
  projeto_id?: string;
}

export function useRecibos(filters: { cliente_id?: string; projeto_id?: string }) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: async () => {
      let q = supabase
        .from("recibos")
        .select(
          "*, cliente:clientes(id, nome, cpf_cnpj)"
        )
        .order("created_at", { ascending: false });

      if (filters.cliente_id) q = q.eq("cliente_id", filters.cliente_id);
      if (filters.projeto_id) q = q.eq("projeto_id", filters.projeto_id);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Recibo[];
    },
    staleTime: STALE_TIME,
  });
}

export interface EmitirReciboInput {
  projeto_id: string;
  cliente_id?: string | null;
  template: string;
  numero?: string;
  valor: number;
  forma_pagamento: string;
  descricao?: string;
  data_pagamento: string;
  campos_extras?: Record<string, unknown>;
  generate_pdf?: boolean;
}

export function useEmitirRecibo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: EmitirReciboInput) => {
      const { tenantId, userId } = await getCurrentTenantId();

      const { data, error } = await supabase
        .from("recibos" as any)
        .insert({
          tenant_id: tenantId,
          projeto_id: input.projeto_id,
          cliente_id: input.cliente_id ?? null,
          template: input.template,
          numero: input.numero ?? null,
          valor: input.valor,
          forma_pagamento: input.forma_pagamento,
          descricao: input.descricao ?? null,
          data_pagamento: input.data_pagamento,
          campos_extras: input.campos_extras ?? {},
          status: "emitido",
          created_by: userId,
        })
        .select("id")
        .single();

      if (error) throw error;
      const reciboId = (data as any).id as string;

      if (input.generate_pdf !== false) {
        try {
          await supabase.functions.invoke("generate-recibo-pdf", {
            body: { recibo_id: reciboId },
          });

          // Espelhar recibo emitido em project_documents para aparecer na aba Documentos
          if (input.projeto_id) {
            try {
              const { data: rec } = await supabase
                .from("recibos")
                .select("pdf_url, numero")
                .eq("id", reciboId)
                .maybeSingle();
              const pdfUrl = (rec as any)?.pdf_url as string | null;
              if (pdfUrl) {
                const fileName = `Recibo ${(rec as any)?.numero || reciboId.slice(0, 8)}.pdf`;
                await supabase.from("project_documents" as any).insert({
                  tenant_id: tenantId,
                  projeto_id: input.projeto_id,
                  cliente_id: input.cliente_id ?? null,
                  categoria: "recibo",
                  origem: "recibo",
                  bucket: "recibos",
                  storage_path: pdfUrl, // assuming pdf_url is the path or url
                  file_name: fileName,
                  mime_type: "application/pdf",
                  uploaded_by: userId,
                  source_table: "recibos",
                  source_id: reciboId,
                });
                qc.invalidateQueries({ queryKey: ["project-documents"] });
              }
            } catch (e) {
              console.warn("[useEmitirRecibo] mirror to project_documents failed:", e);
            }
          }
        } catch (e) {
          console.warn("[useEmitirRecibo] PDF generation failed (non-fatal):", e);
        }
      }

      // Espelhar recibo no centro financeiro (lancamentos_financeiros)
      try {
        const marker = `recibo_id:${reciboId}`;
        const { data: existing } = await supabase
          .from("lancamentos_financeiros")
          .select("id")
          .eq("tenant_id", tenantId)
          .ilike("observacoes", `%${marker}%`)
          .maybeSingle();

        if (!existing) {
          const templateNome = input.template || "Recibo";
          const numeroSuffix = input.numero ? ` #${input.numero}` : "";
          const descricaoFinal = `${templateNome}${numeroSuffix}`;

          const { error: lancErr } = await supabase
            .from("lancamentos_financeiros")
            .insert({
              tenant_id: tenantId,
              tipo: "receita",
              categoria: "recibo",
              descricao: descricaoFinal,
              valor: input.valor,
              data_lancamento: input.data_pagamento || new Date().toISOString().slice(0, 10),
              status: "confirmado",
              cliente_id: input.cliente_id ?? null,
              projeto_id: input.projeto_id,
              observacoes: `${marker}`,
              created_by: userId,
            });
          if (lancErr) {
            console.warn("[useEmitirRecibo] lancamento financeiro falhou:", lancErr);
          } else {
            qc.invalidateQueries({ queryKey: ["lancamentos_financeiros"] });
          }
        }
      } catch (e) {
        console.warn("[useEmitirRecibo] mirror to lancamentos_financeiros failed:", e);
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
        .from("recibos" as any)
        .update({ status: "cancelado" } as any)
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
