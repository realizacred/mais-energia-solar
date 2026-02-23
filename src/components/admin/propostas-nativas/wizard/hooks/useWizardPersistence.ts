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

interface ClienteParams {
  nome: string;
  celular: string;
  email?: string;
  cnpj_cpf?: string;
  empresa?: string;
  cep?: string;
  estado?: string;
  cidade?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
}

interface PersistenceParams {
  propostaId?: string | null;
  versaoId?: string | null;
  snapshot: WizardSnapshot;
  potenciaKwp: number;
  precoFinal: number;
  leadId?: string;
  projetoId?: string;
  dealId?: string;
  titulo: string;
  cliente?: ClienteParams;
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
        console.log("[saveDraft] Creating proposal via atomic RPC", {
          projeto_id_enviado: params.projetoId || null,
          deal_id_enviado: params.dealId || null,
          lead_id: params.leadId || null,
          titulo: params.titulo,
        });

        const cli = params.cliente;
        const rpcPayload: Record<string, any> = {
          p_titulo: params.titulo || "Proposta sem título",
          p_lead_id: params.leadId || null,
          p_projeto_id: params.projetoId || null,
          p_deal_id: params.dealId || null,
          p_origem: "native",
          p_potencia_kwp: params.potenciaKwp,
          p_valor_total: params.precoFinal,
          p_snapshot: params.snapshot as any,
        };

        // Pass client data so the RPC creates/finds the client record
        if (cli?.nome && cli?.celular) {
          rpcPayload.p_cliente_nome = cli.nome;
          rpcPayload.p_cliente_telefone = cli.celular;
          if (cli.email) rpcPayload.p_cliente_email = cli.email;
          if (cli.cnpj_cpf) rpcPayload.p_cliente_cpf_cnpj = cli.cnpj_cpf;
          if (cli.empresa) rpcPayload.p_cliente_empresa = cli.empresa;
          if (cli.cep) rpcPayload.p_cliente_cep = cli.cep;
          if (cli.estado) rpcPayload.p_cliente_estado = cli.estado;
          if (cli.cidade) rpcPayload.p_cliente_cidade = cli.cidade;
          if (cli.endereco) rpcPayload.p_cliente_rua = cli.endereco;
          if (cli.numero) rpcPayload.p_cliente_numero = cli.numero;
          if (cli.bairro) rpcPayload.p_cliente_bairro = cli.bairro;
          if (cli.complemento) rpcPayload.p_cliente_complemento = cli.complemento;
        }

        console.log("[saveDraft] RPC payload keys:", Object.keys(rpcPayload));
        console.log("[saveDraft] RPC payload sizes:", {
          titulo: (rpcPayload.p_titulo || "").length,
          snapshotKeys: Object.keys(params.snapshot || {}).length,
          potenciaKwp: params.potenciaKwp,
          precoFinal: params.precoFinal,
          leadId: params.leadId,
          dealId: params.dealId,
          projetoId: params.projetoId,
        });

        const { data, error } = await supabase.rpc(
          "create_proposta_nativa_atomic" as any,
          rpcPayload
        );

        if (error) {
          console.error("[saveDraft] RPC error:", JSON.stringify(error, null, 2));
          console.error("[saveDraft] RPC error code:", error.code, "details:", error.details, "hint:", error.hint);
          toast({ title: "Erro ao criar proposta", description: error.message, variant: "destructive" });
          return null;
        }

        const result = data as any;
        propostaId = result.proposta_id;
        versaoId = result.versao_id;

        console.log("[saveDraft] Proposal created successfully", {
          proposta_id: result.proposta_id,
          versao_id: result.versao_id,
          projeto_id: result.projeto_id,
          projeto_id_original: params.projetoId || null,
          projeto_criado_automaticamente: !params.projetoId || params.projetoId !== result.projeto_id,
        });

        toast({ title: "✅ Rascunho criado", description: "Proposta e projeto criados com sucesso." });
        return { propostaId, versaoId, projetoId: result.projeto_id };
      }

      // === UPDATE: proposta + versão already exist ===
      const propostaUpdateData: any = {
        titulo: params.titulo || "Proposta sem título",
        updated_at: new Date().toISOString(),
      };
      // Always ensure projeto_id and deal_id are set (fixes legacy proposals with null values)
      if (params.projetoId) {
        propostaUpdateData.projeto_id = params.projetoId;
      }
      if (params.dealId) {
        propostaUpdateData.deal_id = params.dealId;
      }
      if (params.leadId) {
        propostaUpdateData.lead_id = params.leadId;
      }

      await supabase
        .from("propostas_nativas")
        .update(propostaUpdateData)
        .eq("id", propostaId);

      if (versaoId) {
        // Check if current version is locked (already generated) — if so, create a new version
        const { data: currentVersao } = await supabase
          .from("proposta_versoes")
          .select("snapshot_locked, status")
          .eq("id", versaoId)
          .single();

        if (currentVersao?.snapshot_locked) {
          // Version is immutable — create a new draft version under the same proposta
          const { data: newVersao, error: createErr } = await supabase
            .from("proposta_versoes")
            .insert({
              proposta_id: propostaId,
              potencia_kwp: params.potenciaKwp,
              valor_total: params.precoFinal,
              snapshot: params.snapshot as any,
              status: "draft",
              snapshot_locked: false,
            } as any)
            .select("id")
            .single();

          if (createErr) {
            toast({ title: "Erro ao criar nova versão", description: createErr.message, variant: "destructive" });
            return null;
          }

          versaoId = newVersao.id;
          toast({ title: "✅ Nova versão criada", description: "A versão anterior era imutável, uma nova versão foi criada." });
          return { propostaId, versaoId };
        }

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

      // Update proposta (TEXT column, CHECK: rascunho/gerada/enviada/...)
      const propostaUpdate: any = {
        titulo: params.titulo || "Proposta sem título",
        updated_at: new Date().toISOString(),
      };
      if (setActive) propostaUpdate.status = "gerada";
      if (params.projetoId) propostaUpdate.projeto_id = params.projetoId;
      if (params.dealId) propostaUpdate.deal_id = params.dealId;
      if (params.leadId) propostaUpdate.lead_id = params.leadId;

      await supabase
        .from("propostas_nativas")
        .update(propostaUpdate)
        .eq("id", params.propostaId);

      // Check if version is locked
      const { data: currentVersao } = await supabase
        .from("proposta_versoes")
        .select("snapshot_locked, status")
        .eq("id", params.versaoId)
        .single();

      let versaoId = params.versaoId;

      if (currentVersao?.snapshot_locked) {
        // Version is immutable — create a new version
        const { data: newVersao, error: createErr } = await supabase
          .from("proposta_versoes")
          .insert({
            proposta_id: params.propostaId,
            potencia_kwp: params.potenciaKwp,
            valor_total: params.precoFinal,
            snapshot: params.snapshot as any,
            status: setActive ? "generated" : "draft",
            snapshot_locked: setActive,
            gerado_em: setActive ? new Date().toISOString() : null,
          } as any)
          .select("id")
          .single();

        if (createErr) {
          toast({ title: "Erro ao criar nova versão", description: createErr.message, variant: "destructive" });
          return null;
        }
        versaoId = newVersao.id;
      } else {
        // Update existing draft version
        const updateData: any = {
          potencia_kwp: params.potenciaKwp,
          valor_total: params.precoFinal,
          snapshot: params.snapshot,
          updated_at: new Date().toISOString(),
        };
        if (setActive) {
          updateData.status = "generated";
          updateData.gerado_em = new Date().toISOString();
        }

        const { error: vErr } = await supabase
          .from("proposta_versoes")
          .update(updateData as any)
          .eq("id", versaoId);

        if (vErr) {
          toast({ title: "Erro ao atualizar", description: vErr.message, variant: "destructive" });
          return null;
        }
      }

      toast({
        title: setActive ? "✅ Proposta gerada" : "✅ Proposta atualizada",
        description: setActive ? "A proposta foi marcada como gerada." : "Os dados foram atualizados.",
      });
      return { propostaId: params.propostaId, versaoId };
    } catch (e: any) {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { saveDraft, updateProposal, saving };
}
