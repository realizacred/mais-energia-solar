import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────
export interface PostSalePlan {
  id: string;
  tenant_id: string;
  projeto_id: string;
  cliente_id: string;
  status: "active" | "paused" | "closed";
  data_inicio: string | null;
  proxima_preventiva: string | null;
  periodicidade_meses: number;
  garantia_inversor_fim: string | null;
  garantia_modulos_fim: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  projeto?: { nome: string; potencia_kwp: number | null; codigo: string | null };
  cliente?: { nome: string; telefone: string | null; cidade: string | null };
}

export interface PostSaleVisit {
  id: string;
  tenant_id: string;
  plan_id: string | null;
  projeto_id: string | null;
  cliente_id: string | null;
  tipo: "preventiva" | "limpeza" | "suporte" | "vistoria" | "corretiva";
  status: "pendente" | "agendado" | "concluido" | "cancelado";
  data_prevista: string | null;
  data_agendada: string | null;
  data_conclusao: string | null;
  tecnico_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  cliente?: { nome: string; telefone: string | null };
  projeto?: { nome: string; codigo: string | null };
}

export interface PostSaleUpsell {
  id: string;
  tenant_id: string;
  projeto_id: string | null;
  cliente_id: string | null;
  tipo: "bateria" | "expansao" | "carregador_ev" | "troca_inversor";
  status: "pendente" | "contatado" | "vendido" | "perdido";
  descricao: string | null;
  created_at: string;
  updated_at: string;
  cliente?: { nome: string };
}

// ── Queries ────────────────────────────────────────────────

export function usePostSalePlans() {
  return useQuery<PostSalePlan[]>({
    queryKey: ["post-sale-plans"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("post_sale_plans")
        .select("*, projeto:projetos(nome, potencia_kwp, codigo), cliente:clientes(nome, telefone, cidade)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function usePostSaleVisits(filters?: { status?: string; tipo?: string }) {
  return useQuery<PostSaleVisit[]>({
    queryKey: ["post-sale-visits", filters],
    queryFn: async () => {
      let q = (supabase as any)
        .from("post_sale_visits")
        .select("*, cliente:clientes(nome, telefone), projeto:projetos(nome, codigo)")
        .order("data_prevista", { ascending: true });
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.tipo) q = q.eq("tipo", filters.tipo);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function usePostSaleUpsells() {
  return useQuery<PostSaleUpsell[]>({
    queryKey: ["post-sale-upsells"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("post_sale_upsell_opportunities")
        .select("*, cliente:clientes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

// ── Dashboard Stats ────────────────────────────────────────

export interface PostSaleDashboardStats {
  preventivas_proximas_30d: number;
  preventivas_atrasadas: number;
  preventivas_concluidas_mes: number;
  garantias_vencendo_3m: number;
  total_planos_ativos: number;
  total_upsell_pendentes: number;
}

export function usePostSaleDashboard() {
  return useQuery<PostSaleDashboardStats>({
    queryKey: ["post-sale-dashboard"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const in30d = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
      const in3m = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

      const [proximas, atrasadas, concluidas, garantias, planos, upsells] = await Promise.all([
        (supabase as any).from("post_sale_visits").select("id", { count: "exact", head: true })
          .eq("tipo", "preventiva").eq("status", "pendente")
          .gte("data_prevista", today).lte("data_prevista", in30d),
        (supabase as any).from("post_sale_visits").select("id", { count: "exact", head: true })
          .eq("tipo", "preventiva").in("status", ["pendente", "agendado"])
          .lt("data_prevista", today),
        (supabase as any).from("post_sale_visits").select("id", { count: "exact", head: true })
          .eq("tipo", "preventiva").eq("status", "concluido")
          .gte("data_conclusao", monthStart),
        (supabase as any).from("post_sale_plans").select("id", { count: "exact", head: true })
          .eq("status", "active")
          .or(`garantia_inversor_fim.lte.${in3m},garantia_modulos_fim.lte.${in3m}`)
          .or(`garantia_inversor_fim.gte.${today},garantia_modulos_fim.gte.${today}`),
        (supabase as any).from("post_sale_plans").select("id", { count: "exact", head: true })
          .eq("status", "active"),
        (supabase as any).from("post_sale_upsell_opportunities").select("id", { count: "exact", head: true })
          .eq("status", "pendente"),
      ]);

      return {
        preventivas_proximas_30d: proximas.count ?? 0,
        preventivas_atrasadas: atrasadas.count ?? 0,
        preventivas_concluidas_mes: concluidas.count ?? 0,
        garantias_vencendo_3m: garantias.count ?? 0,
        total_planos_ativos: planos.count ?? 0,
        total_upsell_pendentes: upsells.count ?? 0,
      };
    },
  });
}

// ── Mutations ──────────────────────────────────────────────

export function useUpdateVisitStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, observacoes }: { id: string; status: string; observacoes?: string }) => {
      const updates: Record<string, any> = { status };
      if (status === "concluido") updates.data_conclusao = new Date().toISOString();
      if (observacoes !== undefined) updates.observacoes = observacoes;
      const { error } = await (supabase as any).from("post_sale_visits").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-sale-visits"] });
      qc.invalidateQueries({ queryKey: ["post-sale-dashboard"] });
      qc.invalidateQueries({ queryKey: ["post-sale-plans"] });
      toast.success("Visita atualizada");
    },
    onError: () => toast.error("Erro ao atualizar visita"),
  });
}

export function useCreateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<PostSaleVisit>) => {
      const { error } = await (supabase as any).from("post_sale_visits").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-sale-visits"] });
      qc.invalidateQueries({ queryKey: ["post-sale-dashboard"] });
      toast.success("Visita criada");
    },
    onError: () => toast.error("Erro ao criar visita"),
  });
}

export function useCreateUpsell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<PostSaleUpsell>) => {
      const { error } = await (supabase as any).from("post_sale_upsell_opportunities").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-sale-upsells"] });
      qc.invalidateQueries({ queryKey: ["post-sale-dashboard"] });
      toast.success("Oportunidade criada");
    },
    onError: () => toast.error("Erro ao criar oportunidade"),
  });
}

export function useUpdateUpsellStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any).from("post_sale_upsell_opportunities").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-sale-upsells"] });
      qc.invalidateQueries({ queryKey: ["post-sale-dashboard"] });
      toast.success("Oportunidade atualizada");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });
}
