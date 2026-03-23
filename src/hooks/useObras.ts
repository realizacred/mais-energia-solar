// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "obras" as const;

export interface ObraRow {
  id: string;
  titulo: string;
  descricao: string | null;
  cidade: string;
  estado: string;
  potencia_kwp: number | null;
  economia_mensal: number | null;
  tipo_projeto: string;
  data_conclusao: string | null;
  imagens_urls: string[];
  video_url: string | null;
  destaque: boolean;
  ativo: boolean;
  ordem: number;
  numero_modulos: number | null;
  modelo_inversor: string | null;
  cliente_nome: string | null;
  tags: string[];
  marca_paineis: string | null;
  tempo_instalacao_dias: number | null;
  depoimento_cliente: string | null;
  payback_meses: number | null;
  projeto_id: string | null;
  cliente_id: string | null;
  created_at: string;
}

export interface ProjetoOption {
  id: string;
  codigo: string;
  potencia_kwp: number | null;
}

export interface ClienteOption {
  id: string;
  nome: string;
  telefone: string;
}

export function useObras() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, titulo, descricao, cidade, estado, potencia_kwp, tipo_projeto, imagens_urls, tags, destaque, ativo, ordem, numero_modulos, marca_paineis, modelo_inversor, economia_mensal, payback_meses, tempo_instalacao_dias, data_conclusao, depoimento_cliente, video_url, cliente_nome, cliente_id, projeto_id, created_at, updated_at")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as ObraRow[]) || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useObrasFormOptions() {
  return useQuery({
    queryKey: [QUERY_KEY, "form-options"],
    queryFn: async () => {
      const [projRes, cliRes] = await Promise.all([
        supabase.from("projetos").select("id, codigo, potencia_kwp").order("codigo"),
        supabase.from("clientes").select("id, nome, telefone").eq("ativo", true).order("nome"),
      ]);
      return {
        projetos: (projRes.data as unknown as ProjetoOption[]) || [],
        clientes: (cliRes.data as ClienteOption[]) || [],
      };
    },
    staleTime: STALE_TIME,
  });
}

export function useSalvarObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Record<string, any> }) => {
      if (id) {
        const { error } = await supabase.from("obras").update(data as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("obras").insert(data as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeletarObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useToggleObraAtivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("obras").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useToggleObraDestaque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, destaque }: { id: string; destaque: boolean }) => {
      const { error } = await supabase.from("obras").update({ destaque }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/** Realtime subscription that invalidates obras query on changes */
export function useObrasRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel("obras-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "obras" }, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          qc.invalidateQueries({ queryKey: [QUERY_KEY] });
        }, 600);
      })
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
