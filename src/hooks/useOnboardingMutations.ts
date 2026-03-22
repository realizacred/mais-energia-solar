/**
 * Hooks for Onboarding wizard mutations.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSaveOnboardingEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      nome,
      documento,
      cidade,
    }: {
      tenantId: string;
      nome: string;
      documento: string | null;
      cidade: string | null;
    }) => {
      const { error } = await supabase
        .from("tenants")
        .update({ nome, documento, cidade })
        .eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant"] });
    },
  });
}

export function useSaveOnboardingConsultor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      nome,
      telefone,
      email,
      codigo,
    }: {
      tenantId: string;
      nome: string;
      telefone: string;
      email: string | null;
      codigo: string;
    }) => {
      const { error } = await supabase.from("consultores").insert({
        tenant_id: tenantId,
        nome,
        telefone,
        email,
        codigo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consultores"] });
    },
  });
}

export function useSaveOnboardingLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      nome,
      telefone,
    }: {
      nome: string;
      telefone: string;
    }) => {
      const { error } = await supabase.from("leads").insert([{
        nome,
        telefone,
        cidade: "A definir",
        estado: "SP",
        area: "residencial",
        consumo_previsto: 300,
        media_consumo: 300,
        rede_atendimento: "monofasica",
        tipo_telhado: "ceramico",
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
