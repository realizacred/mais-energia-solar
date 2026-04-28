/**
 * useCreatePipelineComercialPadrao — cria o pipeline "Comercial" padrão
 * com as etapas canônicas do funil de vendas (Lead → Ganho/Perdido) e
 * já materializa o espelho em projeto_funis/projeto_etapas (RB-61).
 *
 * Idempotente: se já existir pipeline "Comercial" ativo, retorna o existente
 * sem duplicar.
 *
 * Governança:
 *  - RB-04: mutation em hook dedicado
 *  - RB-58: insert crítico usa .select()
 *  - RB-61: arquitetura dual pipelines ↔ projeto_funis
 *  - RB-73: não roda automático; só quando usuário clicar no botão
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const COMERCIAL = "Comercial";

// Etapas padrão do funil comercial — alinhadas ao fluxo nativo do CRM
// (Lead novo → Qualificação → Proposta → Negociação → Fechado).
const STAGES_PADRAO: Array<{
  name: string;
  position: number;
  is_closed: boolean;
  is_won: boolean;
}> = [
  { name: "Lead novo", position: 0, is_closed: false, is_won: false },
  { name: "Qualificação", position: 1, is_closed: false, is_won: false },
  { name: "Proposta enviada", position: 2, is_closed: false, is_won: false },
  { name: "Negociação", position: 3, is_closed: false, is_won: false },
  { name: "Ganho", position: 4, is_closed: true, is_won: true },
  { name: "Perdido", position: 5, is_closed: true, is_won: false },
];

interface Input {
  tenantId: string;
}

export function useCreatePipelineComercialPadrao() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ tenantId }: Input) => {
      // 1) Já existe pipeline Comercial ativo? (idempotência)
      const { data: existente } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .ilike("name", COMERCIAL)
        .maybeSingle();

      let pipelineId = existente?.id as string | undefined;

      if (!pipelineId) {
        const { data: pip, error: pipErr } = await supabase
          .from("pipelines")
          .insert({
            tenant_id: tenantId,
            name: COMERCIAL,
            is_active: true,
          })
          .select("id")
          .single();
        if (pipErr || !pip) {
          throw new Error(pipErr?.message ?? "Falha ao criar pipeline.");
        }
        pipelineId = pip.id as string;
      }

      // 2) Garantir etapas (idempotente por nome dentro do pipeline)
      const { data: stagesExist } = await supabase
        .from("pipeline_stages")
        .select("name")
        .eq("pipeline_id", pipelineId);

      const nomesExist = new Set(
        (stagesExist ?? []).map((s) => (s.name ?? "").toLowerCase()),
      );
      const aInserir = STAGES_PADRAO.filter(
        (s) => !nomesExist.has(s.name.toLowerCase()),
      );
      if (aInserir.length > 0) {
        const { error: stErr } = await supabase
          .from("pipeline_stages")
          .insert(
            aInserir.map((s) => ({
              tenant_id: tenantId,
              pipeline_id: pipelineId!,
              name: s.name,
              position: s.position,
              is_closed: s.is_closed,
              is_won: s.is_won,
            })),
          );
        if (stErr) throw new Error(stErr.message);
      }

      // 3) Espelho de execução (projeto_funis + projeto_etapas) — RB-61
      const { data: funilExist } = await supabase
        .from("projeto_funis")
        .select("id")
        .eq("tenant_id", tenantId)
        .ilike("nome", COMERCIAL)
        .maybeSingle();

      let funilId = funilExist?.id as string | undefined;
      if (!funilId) {
        const { data: novoFunil, error: funErr } = await supabase
          .from("projeto_funis")
          .insert({
            tenant_id: tenantId,
            nome: COMERCIAL,
            ordem: 0,
            ativo: true,
          })
          .select("id")
          .single();
        if (funErr || !novoFunil) {
          throw new Error(funErr?.message ?? "Falha ao criar funil espelho.");
        }
        funilId = novoFunil.id as string;
      }

      const { data: etapasExist } = await supabase
        .from("projeto_etapas")
        .select("nome")
        .eq("funil_id", funilId);
      const nomesEtapas = new Set(
        (etapasExist ?? []).map((e) => (e.nome ?? "").toLowerCase()),
      );
      const etapasAInserir = STAGES_PADRAO.filter(
        (s) => !nomesEtapas.has(s.name.toLowerCase()),
      );
      if (etapasAInserir.length > 0) {
        const { error: etErr } = await supabase
          .from("projeto_etapas")
          .insert(
            etapasAInserir.map((s) => ({
              tenant_id: tenantId,
              funil_id: funilId!,
              nome: s.name,
              ordem: s.position,
              ativo: true,
            })),
          );
        if (etErr) throw new Error(etErr.message);
      }

      return { pipelineId, funilId, created: !existente?.id };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["pipelines-crm", vars.tenantId] });
    },
  });
}
