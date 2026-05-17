import { supabase } from "@/integrations/supabase/client";

export interface ProjetoFunil {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  tenant_id: string;
}

export interface ProjetoEtapa {
  id: string;
  funil_id: string;
  nome: string;
  cor: string;
  ordem: number;
  categoria: "aberto" | "ganho" | "perdido" | "excluido";
  tenant_id: string;
}

export interface ProjetoEtiqueta {
  id: string;
  nome: string;
  cor: string;
  tenant_id: string;
}

export const projetoMetadataService = {
  async fetchMetadata(userId?: string) {
    const [funisRes, etapasRes, etiquetasRes, consultoresRes, profileRes] = await Promise.all([
      supabase.from("projeto_funis").select("id, nome, ordem, ativo, tenant_id").order("ordem"),
      supabase.from("projeto_etapas").select("id, funil_id, nome, cor, ordem, categoria, tenant_id").order("ordem"),
      supabase.from("projeto_etiquetas").select("id, nome, cor, tenant_id"),
      supabase.from("consultores").select("id, nome, ativo").order("nome"),
      userId ? supabase.from("profiles").select("settings").eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);

    if (funisRes.error) throw funisRes.error;
    if (etapasRes.error) throw etapasRes.error;

    return {
      funis: (funisRes.data || []) as ProjetoFunil[],
      etapas: (etapasRes.data || []) as ProjetoEtapa[],
      etiquetas: (etiquetasRes.data || []) as ProjetoEtiqueta[],
      consultores: (consultoresRes.data || []) as { id: string; nome: string; ativo: boolean }[],
      dbSettings: profileRes?.data?.settings as any,
    };
  }
};
