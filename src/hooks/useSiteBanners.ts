import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SiteBanner = Database["public"]["Tables"]["site_banners"]["Row"];

export function useSiteBanners() {
  const [banners, setBanners] = useState<SiteBanner[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBanners = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("site_banners")
        .select("id, tenant_id, titulo, subtitulo, imagem_url, botao_texto, botao_link, ativo, ordem, created_at, updated_at")
        .eq("ativo", true)
        .order("ordem", { ascending: true });

      if (error) {
        console.warn("Could not load site banners:", error.message);
        return;
      }
      if (data) setBanners(data);
    } catch (err) {
      console.warn("Site banners fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  return { banners, loading, refetch: fetchBanners };
}

/** Admin version — includes inactive banners */
export function useSiteBannersAdmin() {
  const [banners, setBanners] = useState<SiteBanner[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBanners = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("site_banners")
        .select("id, tenant_id, titulo, subtitulo, imagem_url, botao_texto, botao_link, ativo, ordem, created_at, updated_at")
        .order("ordem", { ascending: true });

      if (error) {
        console.warn("Could not load site banners:", error.message);
        return;
      }
      if (data) setBanners(data);
    } catch (err) {
      console.warn("Site banners fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const addBanner = useCallback(
    async (banner: Omit<Database["public"]["Tables"]["site_banners"]["Insert"], "tenant_id">) => {
      const tenantId = banners[0]?.tenant_id || "00000000-0000-0000-0000-000000000001";
      const { error } = await supabase
        .from("site_banners")
        .insert({ ...banner, tenant_id: tenantId } as any);
      if (!error) fetchBanners();
      return { error: error?.message || null };
    },
    [banners, fetchBanners]
  );

  const updateBanner = useCallback(
    async (id: string, updates: Partial<SiteBanner>) => {
      const { error } = await supabase
        .from("site_banners")
        .update(updates)
        .eq("id", id);
      if (!error) fetchBanners();
      return { error: error?.message || null };
    },
    [fetchBanners]
  );

  const deleteBanner = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("site_banners")
        .delete()
        .eq("id", id);
      if (!error) fetchBanners();
      return { error: error?.message || null };
    },
    [fetchBanners]
  );

  return { banners, loading, refetch: fetchBanners, addBanner, updateBanner, deleteBanner };
}
