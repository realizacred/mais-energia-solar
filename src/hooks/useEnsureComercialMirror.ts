/**
 * useEnsureComercialMirror — garante que, ao entrar no Step 2 (Mapear),
 * exista o funil de execução "Comercial" (projeto_funis + projeto_etapas)
 * espelhando o pipeline Comercial existente.
 *
 * Não cria pipeline novo (RB-73: respeita pipelines existentes).
 * Apenas materializa o lado de Execução se ele estiver faltando.
 *
 * Governança:
 *  - RB-04: query/mutation em hook dedicado
 *  - RB-05: staleTime obrigatório
 *  - RB-58: mutation crítica usa .select()
 *  - RB-61: arquitetura dual (pipelines ↔ projeto_funis)
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const COMERCIAL = "Comercial";

export function useEnsureComercialMirror(tenantId: string | null | undefined) {
  const qc = useQueryClient();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!tenantId || ranRef.current) return;
    ranRef.current = true;

    void (async () => {
      try {
        // 1) Existe pipeline Comercial?
        const { data: pipeline } = await supabase
          .from("pipelines")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .ilike("name", COMERCIAL)
          .maybeSingle();

        if (!pipeline?.id) return; // nada a espelhar

        // 2) Já existe funil de execução Comercial?
        const { data: funil } = await supabase
          .from("projeto_funis")
          .select("id")
          .eq("tenant_id", tenantId)
          .ilike("nome", COMERCIAL)
          .maybeSingle();

        let funilId = funil?.id as string | undefined;

        if (!funilId) {
          const { data: novo, error: insErr } = await supabase
            .from("projeto_funis")
            .insert({
              tenant_id: tenantId,
              nome: COMERCIAL,
              ordem: 0,
              ativo: true,
            })
            .select("id")
            .single();
          if (insErr || !novo) return;
          funilId = novo.id;
        }

        // 3) Etapas do pipeline e do funil
        const [{ data: stages }, { data: etapas }] = await Promise.all([
          supabase
            .from("pipeline_stages")
            .select("name, position, is_closed, is_won")
            .eq("pipeline_id", pipeline.id)
            .order("position"),
          supabase
            .from("projeto_etapas")
            .select("nome")
            .eq("funil_id", funilId),
        ]);

        const existentes = new Set(
          (etapas ?? []).map((e) => (e.nome ?? "").toLowerCase()),
        );

        const faltantes = (stages ?? []).filter(
          (s) => !existentes.has((s.name ?? "").toLowerCase()),
        );

        if (faltantes.length > 0) {
          await supabase.from("projeto_etapas").insert(
            faltantes.map((s) => ({
              tenant_id: tenantId,
              funil_id: funilId!,
              nome: s.name,
              ordem: s.position,
              categoria: s.is_won
                ? ("ganho" as const)
                : s.is_closed
                ? ("perdido" as const)
                : ("aberto" as const),
            })),
          );
          qc.invalidateQueries({ queryKey: ["projeto-funis", tenantId] });
        }
      } catch (err) {
        // Falha silenciosa: usuário ainda pode operar manualmente
        console.warn("[useEnsureComercialMirror] falhou:", err);
      }
    })();
  }, [tenantId, qc]);
}
