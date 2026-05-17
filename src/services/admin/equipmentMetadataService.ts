import { supabase } from "@/integrations/supabase/client";

export interface DisjuntorRow {
  id: string;
  amperagem: number;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

export interface TransformadorRow {
  id: string;
  potencia_kva: number;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

export const equipmentMetadataService = {
  async fetchDisjuntores(): Promise<DisjuntorRow[]> {
    const { data, error } = await supabase
      .from("disjuntores")
      .select("id, amperagem, descricao, ativo, created_at, updated_at")
      .order("amperagem", { ascending: true });
    if (error) throw error;
    return (data ?? []) as DisjuntorRow[];
  },

  async saveDisjuntor(id: string | undefined, payload: { amperagem: number; descricao: string | null }) {
    if (id) {
      const { error } = await supabase
        .from("disjuntores")
        .update({ amperagem: payload.amperagem, descricao: payload.descricao })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("disjuntores")
        .insert({ amperagem: payload.amperagem, descricao: payload.descricao });
      if (error) throw error;
    }
  },

  async toggleDisjuntorActive(id: string, ativo: boolean) {
    const { error } = await supabase
      .from("disjuntores")
      .update({ ativo })
      .eq("id", id);
    if (error) throw error;
  },

  async deleteDisjuntor(id: string) {
    const { error } = await supabase.from("disjuntores").delete().eq("id", id);
    if (error) throw error;
  },

  async fetchTransformadores(): Promise<TransformadorRow[]> {
    const { data, error } = await supabase
      .from("transformadores")
      .select("id, potencia_kva, descricao, ativo, created_at, updated_at")
      .order("potencia_kva", { ascending: true });
    if (error) throw error;
    return (data ?? []) as TransformadorRow[];
  },

  async saveTransformador(id: string | undefined, payload: { potencia_kva: number; descricao: string | null }) {
    if (id) {
      const { error } = await supabase
        .from("transformadores")
        .update({ potencia_kva: payload.potencia_kva, descricao: payload.descricao })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("transformadores")
        .insert({ potencia_kva: payload.potencia_kva, descricao: payload.descricao });
      if (error) throw error;
    }
  },

  async toggleTransformadorActive(id: string, ativo: boolean) {
    const { error } = await supabase
      .from("transformadores")
      .update({ ativo })
      .eq("id", id);
    if (error) throw error;
  },

  async deleteTransformador(id: string) {
    const { error } = await supabase.from("transformadores").delete().eq("id", id);
    if (error) throw error;
  }
};
