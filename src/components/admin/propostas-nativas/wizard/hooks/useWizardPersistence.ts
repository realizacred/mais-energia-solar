import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface WizardSnapshot {
  // Localização
  locEstado: string;
  locCidade: string;
  locTipoTelhado: string;
  locDistribuidoraId: string;
  locDistribuidoraNome: string;
  locIrradiacao: number;
  locGhiSeries: Record<string, number> | null;
  locLatitude: number | null;
  distanciaKm: number;
  projectAddress: any;
  mapSnapshots: string[];

  // Cliente / Lead
  selectedLead: any;
  cliente: any;

  // UCs
  ucs: any[];
  grupo: string;
  potenciaKwp: number;

  // Custom Fields
  customFieldValues: Record<string, any>;

  // Premissas
  premissas: any;
  preDimensionamento: any;

  // Kit
  itens: any[];
  layouts: any[];
  manualKits: any[];

  // Adicionais
  adicionais: any[];

  // Serviços
  servicos: any[];

  // Venda
  venda: any;

  // Pagamento
  pagamentoOpcoes: any[];

  // Metadata
  nomeProposta: string;
  descricaoProposta: string;
  templateSelecionado: string;
  step: number;
}

interface PersistenceParams {
  propostaId?: string | null;
  versaoId?: string | null;
  snapshot: WizardSnapshot;
  potenciaKwp: number;
  precoFinal: number;
  leadId?: string;
  projetoId?: string;
  titulo: string;
}

export function useWizardPersistence() {
  const [saving, setSaving] = useState(false);

  const saveDraft = useCallback(async (params: PersistenceParams) => {
    setSaving(true);
    try {
      let propostaId = params.propostaId;
      let versaoId = params.versaoId;

      // === CREATE: use atomic RPC (ensures projeto exists) ===
      if (!propostaId) {
        const { data, error } = await supabase.rpc(
          "create_proposta_nativa_atomic" as any,
          {
            p_titulo: params.titulo || "Proposta sem título",
            p_lead_id: params.leadId || null,
            p_projeto_id: params.projetoId || null,
            p_origem: "native",
            p_potencia_kwp: params.potenciaKwp,
            p_valor_total: params.precoFinal,
            p_snapshot: params.snapshot as any,
          }
        );

        if (error) {
          console.error("[saveDraft] RPC error:", error);
          toast({ title: "Erro ao criar proposta", description: error.message, variant: "destructive" });
          return null;
        }

        const result = data as any;
        propostaId = result.proposta_id;
        versaoId = result.versao_id;

        toast({ title: "✅ Rascunho criado", description: "Proposta e projeto criados com sucesso." });
        return { propostaId, versaoId, projetoId: result.projeto_id };
      }

      // === UPDATE: proposta + versão already exist ===
      await supabase
        .from("propostas_nativas")
        .update({
          titulo: params.titulo || "Proposta sem título",
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", propostaId);

      if (versaoId) {
        const { error: uErr } = await supabase
          .from("proposta_versoes")
          .update({
            potencia_kwp: params.potenciaKwp,
            valor_total: params.precoFinal,
            snapshot: params.snapshot as any,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", versaoId);

        if (uErr) {
          toast({ title: "Erro ao atualizar versão", description: uErr.message, variant: "destructive" });
          return null;
        }
      }

      toast({ title: "✅ Rascunho salvo", description: "Você pode retomar a proposta a qualquer momento." });
      return { propostaId, versaoId };
    } catch (e: any) {
      console.error("[saveDraft] Exception:", e);
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateProposal = useCallback(async (params: PersistenceParams, setActive: boolean) => {
    setSaving(true);
    try {
      if (!params.propostaId || !params.versaoId) {
        toast({ title: "Erro", description: "Proposta não encontrada para atualizar.", variant: "destructive" });
        return null;
      }

      // Update proposta
      await supabase
        .from("propostas_nativas")
        .update({
          titulo: params.titulo || "Proposta sem título",
          status: setActive ? "gerada" : undefined,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", params.propostaId);

      // Update versão
      const updateData: any = {
        potencia_kwp: params.potenciaKwp,
        valor_total: params.precoFinal,
        snapshot: params.snapshot,
        updated_at: new Date().toISOString(),
      };
      if (setActive) {
        updateData.status = "gerada";
        updateData.gerado_em = new Date().toISOString();
      }

      const { error: vErr } = await supabase
        .from("proposta_versoes")
        .update(updateData as any)
        .eq("id", params.versaoId);

      if (vErr) {
        toast({ title: "Erro ao atualizar", description: vErr.message, variant: "destructive" });
        return null;
      }

      toast({
        title: setActive ? "✅ Proposta gerada" : "✅ Proposta atualizada",
        description: setActive ? "A proposta foi marcada como gerada." : "Os dados foram atualizados com sucesso.",
      });
      return { propostaId: params.propostaId, versaoId: params.versaoId };
    } catch (e: any) {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { saveDraft, updateProposal, saving };
}
