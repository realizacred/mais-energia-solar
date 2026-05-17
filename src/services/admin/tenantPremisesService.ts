import { supabase } from "@/integrations/supabase/client";
import type { TenantPremises, RoofAreaFactor } from "@/hooks/useTenantPremises";

export const tenantPremisesService = {
  async fetchAll(): Promise<{ premises: TenantPremises | null, roofFactors: RoofAreaFactor[] }> {
    const [premRes, roofRes] = await Promise.all([
      supabase.from("tenant_premises").select("*").limit(1).maybeSingle(),
      supabase.from("tenant_roof_area_factors").select("*").order("tipo_telhado"),
    ]);

    if (premRes.error) throw premRes.error;
    if (roofRes.error) throw roofRes.error;

    return {
      premises: premRes.data as any,
      roofFactors: (roofRes.data || []) as any,
    };
  },

  async savePremises(premises: Partial<TenantPremises>) {
    const { id, tenant_id, ...payload } = premises as any;
    const user = (await supabase.auth.getUser()).data.user;

    if (id) {
      const { error } = await supabase
        .from("tenant_premises")
        .update({ ...payload, updated_by: user?.id })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("tenant_premises")
        .insert({ ...payload, created_by: user?.id })
        .select("id, tenant_id")
        .single();
      if (error) throw error;
      return data;
    }
  },

  async saveRoofFactors(factors: RoofAreaFactor[]) {
    for (const f of factors) {
      const { id, tenant_id, ...payload } = f as any;
      if (id) {
        const { error } = await supabase.from("tenant_roof_area_factors").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("tenant_roof_area_factors")
          .insert(payload)
          .select("id, tenant_id")
          .single();
        if (error) throw error;
        if (data) {
          f.id = (data as any).id;
          f.tenant_id = (data as any).tenant_id;
        }
      }
    }
  }
};
