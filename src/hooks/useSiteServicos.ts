import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteServico {
  id: string;
  titulo: string;
  descricao: string;
  imagem_url: string | null;
  ordem: number;
  ativo: boolean;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useSiteServicos() {
  const [servicos, setServicos] = useState<SiteServico[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServicos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_servicos")
      .select("*")
      .order("ordem", { ascending: true });

    if (!error && data) {
      setServicos(data as SiteServico[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchServicos();
  }, [fetchServicos]);

  const addServico = async (servico: Pick<SiteServico, "titulo" | "descricao" | "imagem_url">) => {
    const maxOrdem = servicos.reduce((max, s) => Math.max(max, s.ordem), 0);
    const { error } = await supabase
      .from("site_servicos")
      .insert({ ...servico, ordem: maxOrdem + 1 });
    if (error) return { error: error.message };
    await fetchServicos();
    return { error: null };
  };

  const updateServico = async (id: string, updates: Partial<Pick<SiteServico, "titulo" | "descricao" | "imagem_url" | "ordem" | "ativo">>) => {
    const { error } = await supabase
      .from("site_servicos")
      .update(updates)
      .eq("id", id);
    if (error) return { error: error.message };
    await fetchServicos();
    return { error: null };
  };

  const deleteServico = async (id: string) => {
    const { error } = await supabase
      .from("site_servicos")
      .delete()
      .eq("id", id);
    if (error) return { error: error.message };
    await fetchServicos();
    return { error: null };
  };

  const reorder = async (fromIndex: number, toIndex: number) => {
    const reordered = [...servicos];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // Update all orders
    const updates = reordered.map((s, i) => ({
      id: s.id,
      ordem: i + 1,
    }));

    for (const u of updates) {
      await supabase.from("site_servicos").update({ ordem: u.ordem }).eq("id", u.id);
    }
    await fetchServicos();
  };

  return {
    servicos,
    loading,
    addServico,
    updateServico,
    deleteServico,
    reorder,
    refetch: fetchServicos,
  };
}
