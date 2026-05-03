/**
 * useEquipmentGallery — Galeria de fotos de equipamentos por tenant.
 * §16: Queries só em hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "./useTenantId";
import { toast } from "sonner";

export type EquipmentImageCategory =
  | "modulo"
  | "inversor"
  | "stringbox"
  | "cabo"
  | "estrutura"
  | "otimizador"
  | "outro";

export interface EquipmentImage {
  id: string;
  tenant_id: string;
  category: EquipmentImageCategory;
  fabricante: string | null;
  modelo: string | null;
  label: string | null;
  image_url: string;
  storage_path: string | null;
  ordem: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentImageCategory, string> = {
  modulo: "Módulos fotovoltaicos",
  inversor: "Inversores",
  stringbox: "String Box CC",
  cabo: "Cabos",
  estrutura: "Estruturas de fixação",
  otimizador: "Otimizadores",
  outro: "Outros",
};

const BUCKET = "equipment-images";

export function useEquipmentGallery(category?: EquipmentImageCategory) {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["equipment-gallery", tenantId, category ?? "all"],
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<EquipmentImage[]> => {
      let q = supabase
        .from("tenant_equipment_images")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });
      if (category) q = q.eq("category", category);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EquipmentImage[];
    },
  });
}

export function useUploadEquipmentImage() {
  const { data: tenantId } = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      file: File;
      category: EquipmentImageCategory;
      fabricante?: string;
      modelo?: string;
      label?: string;
    }) => {
      if (!tenantId) throw new Error("Tenant não identificado");
      const ext = input.file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeName = `${crypto.randomUUID()}.${ext}`;
      const path = `${tenantId}/${input.category}/${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, input.file, { upsert: false, contentType: input.file.type });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const { error: insErr } = await supabase.from("tenant_equipment_images").insert({
        tenant_id: tenantId,
        category: input.category,
        fabricante: input.fabricante || null,
        modelo: input.modelo || null,
        label: input.label || null,
        image_url: urlData.publicUrl,
        storage_path: path,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("Imagem enviada");
      qc.invalidateQueries({ queryKey: ["equipment-gallery"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao enviar imagem"),
  });
}

export function useDeleteEquipmentImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (img: EquipmentImage) => {
      if (img.storage_path) {
        await supabase.storage.from(BUCKET).remove([img.storage_path]);
      }
      const { error } = await supabase
        .from("tenant_equipment_images")
        .delete()
        .eq("id", img.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Imagem removida");
      qc.invalidateQueries({ queryKey: ["equipment-gallery"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao remover"),
  });
}
