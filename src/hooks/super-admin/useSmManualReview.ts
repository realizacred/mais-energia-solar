/**
 * useSmManualReview — Hooks para o painel de Manual Review da migração SolarMarket.
 * Reaproveita supabase.functions.invoke (via sm-manual-review-action).
 * AGENTS.md RB-76 (sem duplicar), DA-48.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const KEY = ["sm-manual-review"] as const;

async function invoke(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("sm-manual-review-action", {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

export interface ManualReviewItem {
  id: string;
  tenant_id: string;
  source: string;
  source_entity_type: string;
  source_entity_id: string;
  reason: string;
  attempts: number;
  conflict_entity_type: string | null;
  conflict_entity_id: string | null;
  conflict_metadata: any;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  sm_payload: any;
  crm_client: {
    id: string;
    nome: string | null;
    telefone: string | null;
    telefone_normalized: string | null;
    email: string | null;
    cpf_cnpj: string | null;
    external_id: string | null;
  } | null;
}

export function useManualReviewList() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const r = await invoke("list");
      return (r.items ?? []) as ManualReviewItem[];
    },
    staleTime: 30_000,
  });
}

export function useManualReviewDetail(id: string | null) {
  return useQuery({
    queryKey: [...KEY, "detail", id],
    queryFn: async () => invoke("detail", { id }),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useManualReviewAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { action: string; id: string; [k: string]: unknown }) =>
      invoke(args.action, args),
    onSuccess: (_d, vars) => {
      toast.success(actionLabel(vars.action) + " concluído");
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function actionLabel(a: string) {
  switch (a) {
    case "resolve_link": return "Vínculo";
    case "resolve_create": return "Novo cliente";
    case "resolve_ignore": return "Ignorar";
    case "mark_resolved": return "Marcar resolvido";
    case "retry": return "Retry";
    default: return a;
  }
}
