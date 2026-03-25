/**
 * useProjetoChecklist.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 *
 * Hook para checklist dinâmico de documentos por tenant + deal.
 * Fallback: se nenhum item configurado, usa legado deals.doc_checklist.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const ITEMS_KEY = "doc-checklist-items" as const;
const STATUS_KEY = "doc-checklist-status" as const;

// ─── Types ────────────────────────────────────────
export interface DocChecklistItem {
  id: string;
  tenant_id: string;
  label: string;
  icon: string;
  obrigatorio: boolean;
  aceita_arquivo: boolean;
  ordem: number;
  ativo: boolean;
}

export interface DocChecklistStatus {
  id: string;
  deal_id: string;
  item_id: string;
  concluido: boolean;
  arquivo_path: string | null;
  updated_at: string;
}

// ─── Queries ──────────────────────────────────────

/** Fetch tenant's active checklist items, ordered */
export function useChecklistItems() {
  return useQuery({
    queryKey: [ITEMS_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("doc_checklist_items")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as DocChecklistItem[];
    },
    staleTime: STALE_TIME,
  });
}

/** Fetch status for all items in a deal */
export function useChecklistStatus(dealId: string) {
  return useQuery({
    queryKey: [STATUS_KEY, dealId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("doc_checklist_status")
        .select("*")
        .eq("deal_id", dealId);
      if (error) throw error;
      return (data || []) as DocChecklistStatus[];
    },
    staleTime: STALE_TIME,
    enabled: !!dealId,
  });
}

// ─── Mutations ────────────────────────────────────

/** Toggle concluido for a checklist item in a deal (upsert) */
export function useToggleChecklistItem(dealId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, concluido }: { itemId: string; concluido: boolean }) => {
      const { error } = await (supabase as any)
        .from("doc_checklist_status")
        .upsert(
          { deal_id: dealId, item_id: itemId, concluido, updated_at: new Date().toISOString() },
          { onConflict: "deal_id,item_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [STATUS_KEY, dealId] });
    },
  });
}

/** Upload arquivo for a checklist item */
export function useUploadChecklistArquivo(dealId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, file }: { itemId: string; file: File }) => {
      const path = `${dealId}/checklist/${itemId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Save path + mark concluido
      const { error } = await (supabase as any)
        .from("doc_checklist_status")
        .upsert(
          { deal_id: dealId, item_id: itemId, concluido: true, arquivo_path: path, updated_at: new Date().toISOString() },
          { onConflict: "deal_id,item_id" }
        );
      if (error) throw error;
      return path;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [STATUS_KEY, dealId] });
    },
  });
}
