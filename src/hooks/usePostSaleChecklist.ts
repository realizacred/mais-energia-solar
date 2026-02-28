import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────

export interface ChecklistTemplate {
  id: string;
  tenant_id: string;
  nome: string;
  tipo: string;
  created_at: string;
  items?: ChecklistTemplateItem[];
}

export interface ChecklistTemplateItem {
  id: string;
  tenant_id: string;
  template_id: string;
  descricao: string;
  ordem: number;
}

export interface VisitChecklistEntry {
  id: string;
  tenant_id: string;
  visit_id: string;
  item_id: string;
  status: "ok" | "atencao" | "problema" | "na";
  observacao: string | null;
  item?: ChecklistTemplateItem;
}

// ── Queries ────────────────────────────────────────────────

export function useChecklistTemplates(tipo?: string) {
  return useQuery<ChecklistTemplate[]>({
    queryKey: ["ps-checklist-templates", tipo],
    queryFn: async () => {
      let q = (supabase as any)
        .from("post_sale_checklist_templates")
        .select("*, items:post_sale_checklist_items(id, descricao, ordem, template_id, tenant_id)")
        .order("nome");
      if (tipo) q = q.eq("tipo", tipo);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        items: (t.items || []).sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0)),
      }));
    },
  });
}

export function useVisitChecklist(visitId: string | undefined) {
  return useQuery<VisitChecklistEntry[]>({
    queryKey: ["ps-visit-checklist", visitId],
    enabled: !!visitId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("post_sale_visit_checklist")
        .select("*, item:post_sale_checklist_items(id, descricao, ordem)")
        .eq("visit_id", visitId)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });
}

// ── Mutations ──────────────────────────────────────────────

export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ visitId, templateId }: { visitId: string; templateId: string }) => {
      // Anti-duplication: check if checklist already applied
      const { data: existing } = await (supabase as any)
        .from("post_sale_visit_checklist")
        .select("id")
        .eq("visit_id", visitId)
        .limit(1);
      if (existing && existing.length > 0) {
        throw new Error("DUPLICATE");
      }

      // Fetch template items
      const { data: items, error: itemsError } = await (supabase as any)
        .from("post_sale_checklist_items")
        .select("id")
        .eq("template_id", templateId)
        .order("ordem");
      if (itemsError) throw itemsError;
      if (!items?.length) throw new Error("Template sem itens");

      const rows = items.map((item: any) => ({
        visit_id: visitId,
        item_id: item.id,
        status: "na",
        observacao: null,
      }));
      const { error } = await (supabase as any).from("post_sale_visit_checklist").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["ps-visit-checklist", vars.visitId] });
      toast.success("Checklist aplicado");
    },
    onError: (err: any) => {
      if (err?.message === "DUPLICATE") {
        toast.error("Checklist já aplicado para esta visita");
      } else {
        toast.error("Erro ao aplicar checklist");
      }
    },
  });
}

export function useUpdateChecklistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, observacao, visitId }: { id: string; status: string; observacao?: string; visitId: string }) => {
      const updates: Record<string, any> = { status };
      if (observacao !== undefined) updates.observacao = observacao;
      const { error } = await (supabase as any).from("post_sale_visit_checklist").update(updates).eq("id", id);
      if (error) throw error;
      return visitId;
    },
    onSuccess: (visitId) => {
      qc.invalidateQueries({ queryKey: ["ps-visit-checklist", visitId] });
    },
    onError: () => toast.error("Erro ao atualizar item"),
  });
}

// ── Template CRUD ──────────────────────────────────────────

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { nome: string; tipo: string }) => {
      const { error } = await (supabase as any).from("post_sale_checklist_templates").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ps-checklist-templates"] });
      toast.success("Template criado");
    },
    onError: () => toast.error("Erro ao criar template"),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; nome?: string; tipo?: string }) => {
      const { error } = await (supabase as any).from("post_sale_checklist_templates").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ps-checklist-templates"] });
      toast.success("Template atualizado");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("post_sale_checklist_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ps-checklist-templates"] });
      toast.success("Template removido");
    },
    onError: () => toast.error("Erro ao remover"),
  });
}

// ── Item CRUD ──────────────────────────────────────────────

export function useCreateTemplateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { template_id: string; descricao: string; ordem: number }) => {
      const { error } = await (supabase as any).from("post_sale_checklist_items").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ps-checklist-templates"] });
      toast.success("Item adicionado");
    },
    onError: () => toast.error("Erro ao adicionar item"),
  });
}

export function useUpdateTemplateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; descricao?: string; ordem?: number }) => {
      const { error } = await (supabase as any).from("post_sale_checklist_items").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ps-checklist-templates"] });
    },
    onError: () => toast.error("Erro ao atualizar item"),
  });
}

export function useDeleteTemplateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("post_sale_checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ps-checklist-templates"] });
      toast.success("Item removido");
    },
    onError: () => toast.error("Erro ao remover item"),
  });
}
