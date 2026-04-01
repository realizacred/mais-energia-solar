/**
 * Hook para dados do VariableMapperPanel.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { valorPorExtenso } from "@/utils/valorPorExtenso";

const STALE_TIME = 1000 * 60 * 5;

export function useVariableMapperData(dealId: string, customerId: string | null) {
  return useQuery({
    queryKey: ["variable-mapper", dealId, customerId],
    queryFn: async () => {
      const promises: Array<Promise<Record<string, any>>> = [];

      // 1. Cliente
      if (customerId) {
        promises.push(
          Promise.resolve(
            supabase
              .from("clientes")
              .select("nome, cpf_cnpj, telefone, email, rua, numero, bairro, cidade, estado, cep")
              .eq("id", customerId)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  const endereco = [data.rua, data.numero, data.bairro, data.cidade, data.estado, data.cep]
                    .filter(Boolean)
                    .join(", ");
                  return { cliente: { ...data, endereco } };
                }
                return {};
              })
          )
        );
      } else {
        promises.push(Promise.resolve({}));
      }

      // 2. Projeto
      promises.push(
        Promise.resolve(
          supabase
            .from("projetos")
            .select(
              "potencia_kwp, numero_modulos, modelo_modulos, modelo_inversor, valor_total, valor_equipamentos, valor_mao_obra, area_util_m2, geracao_mensal_media_kwh, forma_pagamento, valor_entrada, valor_financiado, numero_parcelas, valor_parcela, prazo_estimado_dias, prazo_vistoria_dias, numero_inversores, tenant_id"
            )
            .eq("id", dealId)
            .maybeSingle()
            .then(({ data }) => ({ projeto: data || {} }))
        )
      );

      // 3. Tenant
      promises.push(
        Promise.resolve(
          supabase
            .from("profiles")
            .select("tenant_id")
            .limit(1)
            .single()
            .then(async ({ data: profile }) => {
              if (!profile?.tenant_id) return {};
              const { data: tenant } = await supabase
                .from("tenants")
                .select("nome, documento")
                .eq("id", profile.tenant_id)
                .maybeSingle();
              return { tenant: tenant || {} };
            })
        )
      );

      const results = await Promise.all(promises);
      const merged = Object.assign({}, ...results);

      // Calculated fields
      const valorTotal = merged.projeto?.valor_total;
      merged._calc = {
        preco_por_extenso: valorTotal ? valorPorExtenso(Number(valorTotal)) : null,
      };

      return merged as Record<string, any>;
    },
    staleTime: STALE_TIME,
  });
}
