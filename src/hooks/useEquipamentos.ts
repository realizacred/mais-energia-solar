// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5; // 5 min

// ── Disjuntores ──────────────────────────────────────────────

export interface DisjuntorRow {
  id: string;
  amperagem: number;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

export function useDisjuntores() {
  return useQuery({
    queryKey: ["disjuntores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disjuntores")
        .select("id, amperagem, descricao, ativo, created_at, updated_at")
        .order("amperagem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DisjuntorRow[];
    },
    staleTime: STALE_TIME,
  });
}

export function useSalvarDisjuntor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; amperagem: number; descricao: string | null }) => {
      if (payload.id) {
        const { error } = await supabase
          .from("disjuntores")
          .update({ amperagem: payload.amperagem, descricao: payload.descricao })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("disjuntores")
          .insert({ amperagem: payload.amperagem, descricao: payload.descricao });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disjuntores"] });
    },
  });
}

export function useToggleDisjuntorAtivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("disjuntores")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disjuntores"] });
    },
  });
}

export function useDeletarDisjuntor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("disjuntores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disjuntores"] });
    },
  });
}

// ── Transformadores ──────────────────────────────────────────

export interface TransformadorRow {
  id: string;
  potencia_kva: number;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

export function useTransformadores() {
  return useQuery({
    queryKey: ["transformadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transformadores")
        .select("id, potencia_kva, descricao, ativo, created_at, updated_at")
        .order("potencia_kva", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TransformadorRow[];
    },
    staleTime: STALE_TIME,
  });
}

export function useSalvarTransformador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; potencia_kva: number; descricao: string | null }) => {
      if (payload.id) {
        const { error } = await supabase
          .from("transformadores")
          .update({ potencia_kva: payload.potencia_kva, descricao: payload.descricao })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("transformadores")
          .insert({ potencia_kva: payload.potencia_kva, descricao: payload.descricao });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transformadores"] });
    },
  });
}

export function useToggleTransformadorAtivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("transformadores")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transformadores"] });
    },
  });
}

export function useDeletarTransformador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transformadores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transformadores"] });
    },
  });
}
