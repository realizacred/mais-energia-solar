import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { projetoDetalheKeys } from "@/hooks/useProjetoDetalheData";

// ─── Types ────────────────────────────────────────────────

export interface WizardSnapshot {
  // Localização
  locEstado: string;
  locCidade: string;
  locTipoTelhado: string;
  locDistribuidoraId: string;
  locDistribuidoraNome: string;
  locIrradiacao: number;
  locGhiSeries: Record<string, number> | null;
  locSkipPoa: boolean;
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
  subgrupo?: string;
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
  geracaoMensalEstimada?: number;
  economiaMensal?: number; // Added to persist official economy
  web_template_snapshot?: any; // Fase 1: Snapshot visual da proposta WEB (RB-F1)


  // QW10 — top-level geração keys for backend resolvers
  geracao_mensal_kwh?: number;
  geracao_anual_kwh?: number;

  // QW9 — consultor keys for backend resolvers
  consultor_nome?: string;
  consultor_email?: string;
  consultor_telefone?: string;

  // Allow extra keys for forward compatibility
  [key: string]: unknown;
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

export type SaveIntent = "draft" | "active";

export type AtomicPersistStatus =
  | "success"
  | "reused"
  | "blocked"
  | "error";

export interface AtomicPersistResult {
  status: AtomicPersistStatus;
  propostaId?: string;
  versaoId?: string;
  projetoId?: string;
  dealId?: string;
  clienteId?: string;
  newVersionCreated?: boolean;
  reason?: string;
  message?: string;
}

export interface PersistenceParams {
  /** Effective proposta ID (from state or URL fallback) */
  effectivePropostaId: string | null;
  /** Effective versão ID (from state or URL fallback) */
  effectiveVersaoId: string | null;
  snapshot: WizardSnapshot;
  potenciaKwp: number;
  precoFinal: number;
  economiaMensal?: number;
  geracaoMensal?: number;
  leadId?: string;
  projetoId?: string;
  dealId?: string;
  titulo: string;
  cliente?: ClienteParams;
}

// ─── Fingerprint: deep stable stringify ───────────────────

function stableStringify(val: unknown): string {
  if (val === null || val === undefined) return String(val);
  if (typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val)) return "[" + val.map(stableStringify).join(",") + "]";
  const sorted = Object.keys(val as object)
    .sort()
    .map((k) => {
      const v = (val as Record<string, unknown>)[k];
      if (v === undefined) return null;
      return JSON.stringify(k) + ":" + stableStringify(v);
    })
    .filter(Boolean);
  return "{" + sorted.join(",") + "}";
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function buildFingerprint(snapshot: Record<string, unknown>): string {
  return simpleHash(stableStringify(snapshot));
}

// ─── Helpers ──────────────────────────────────────────────

function normalizeGrupo(g: string | null | undefined): string | null {
  if (!g) return null;
  if (g.startsWith("A")) return "A";
  if (g.startsWith("B")) return "B";
  return null;
}

const SNAPSHOT_SCHEMA_VERSION = 2;

function sanitizeSnapshot(snapshot: any): Record<string, unknown> {
  if (!snapshot) return snapshot;
   
  const { mapSnapshots, ...rest } = snapshot;
  const rootCustomFieldValues =
    rest.customFieldValues && typeof rest.customFieldValues === "object"
      ? rest.customFieldValues as Record<string, unknown>
      : {};
  const result: Record<string, unknown> = {
    ...rest,
    grupo: normalizeGrupo(rest.grupo),
    subgrupo: rest.subgrupo || rest.grupo, // Preserva subgrupo original se existir, ou usa grupo como fallback
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    customFieldValues: rootCustomFieldValues,
    descricaoProposta: rest.descricaoProposta ?? "",
    nomeProposta: rest.nomeProposta ?? "",
  };

  // Promote _wizard_state metadata to snapshot root for resolver access
  const ws = rest._wizard_state as Record<string, unknown> | undefined;
  if (ws) {
    // descricaoProposta — allow empty string as valid value
    if (ws.descricaoProposta != null && !result.descricaoProposta) {
      result.descricaoProposta = ws.descricaoProposta;
    }
    // nomeProposta — allow empty string as valid value
    if (ws.nomeProposta != null && !result.nomeProposta) {
      result.nomeProposta = ws.nomeProposta;
    }
    // customFieldValues — critical for pos_*, pre_*, cap_* fields in resolvers
    if (ws.customFieldValues && typeof ws.customFieldValues === "object") {
      result.customFieldValues = {
        ...(ws.customFieldValues as Record<string, unknown>),
        ...(result.customFieldValues as Record<string, unknown>),
      };
    }
    // templateSelecionado
    if (ws.templateSelecionado && !result.templateSelecionado) {
      result.templateSelecionado = ws.templateSelecionado;
    }
  }

  // ── Enrich: flatten warranty from kit items into snapshot root ──
  // Ensures modulo_garantia and inversor_garantia are persisted for resolvers
  try {
    const itens = (result.itens ?? (result as any).kit?.itens) as Array<Record<string, any>> | undefined;
    if (Array.isArray(itens)) {
      const modulo = itens.find((i) => {
        const cat = String(i.categoria || i.tipo || "").toLowerCase();
        return cat.includes("modulo") || cat.includes("painel") || cat.includes("placa");
      });
      const inversor = itens.find((i) => String(i.categoria || i.tipo || "").toLowerCase().includes("inversor"));

      if (modulo?.garantia_produto_anos != null && !result.modulo_garantia) {
        result.modulo_garantia = String(modulo.garantia_produto_anos);
      }
      if (inversor?.garantia_anos != null && !result.inversor_garantia) {
        result.inversor_garantia = String(inversor.garantia_anos);
      }
    }
  } catch { /* never break save for enrichment */ }

  // ── Canonicalize on save: strip SolarMarket import flags ──
  // Quando o usuário salva uma proposta migrada, ela vira canônica/nativa.
  // Mantemos rastreabilidade via origin_source + converted_from_import,
  // mas removemos override financeiro automático para o motor nativo assumir.
  try {
    const venda = result.venda as Record<string, any> | undefined;
    if (venda && venda.isImportedFinancialOverride === true) {
      result.venda = {
        ...venda,
        isImportedFinancialOverride: false,
        custo_kit_override: null,
      };
      result.origin_source = result.origin_source ?? "solarmarket";
      result.converted_from_import = true;
    }
    // Garantia extra: nunca persistir flags SM no snapshot canônico após edição.
    // Mantemos apenas origin_source + converted_from_import para rastreabilidade.
    if ((result as any).source === "solarmarket") {
      result.origin_source = result.origin_source ?? "solarmarket";
      result.converted_from_import = true;
      delete (result as any).source;
      delete (result as any).source_version;
    }
    // Remover blobs SM pesados (raw_sm, sm_variables) — dados já foram normalizados
    // para o modelo canônico nativo (ucs, itens, venda, premissas, etc.).
    if ((result as any).raw_sm !== undefined) {
      delete (result as any).raw_sm;
    }
    if ((result as any).sm_variables !== undefined) {
      delete (result as any).sm_variables;
    }
  } catch { /* never break save for canonicalization */ }

  return result;
}

function buildIntentKey(params: PersistenceParams, intent: SaveIntent): string {
  const sanitized = sanitizeSnapshot(params.snapshot);
  const fp = buildFingerprint(sanitized);
  return [
    intent,
    params.effectivePropostaId ?? "new",
    params.effectiveVersaoId ?? "new",
    fp,
  ].join("|");
}

// ─── Module-level in-flight map (survives re-renders) ─────

const inflightMap = new Map<string, Promise<AtomicPersistResult>>();

// ─── Core atomic persist (pure async, no hooks) ──────────

async function persistProposalAtomic(
  params: PersistenceParams,
  intent: SaveIntent,
): Promise<AtomicPersistResult> {
  const setActive = intent === "active";
  const sanitized = sanitizeSnapshot(params.snapshot);
  const grupoNormalized = normalizeGrupo(params.snapshot?.grupo);
  const { effectivePropostaId, effectiveVersaoId } = params;

  try {
    // ══════ CREATE: no existing proposal ══════
    if (!effectivePropostaId) {
      //   deal_id: params.dealId || null,
      //   lead_id: params.leadId || null,
      //   titulo: params.titulo,
      // });

      const cli = params.cliente;

      // RB-60: se temos dealId mas não projetoId, resolver projetoId do deal
      // antes de chamar a RPC (evita criar projeto duplicado).
      let resolvedProjetoId = params.projetoId || null;
      if (params.dealId && !resolvedProjetoId) {
        const { data: dealRow } = await supabase
          .from("deals")
          .select("projeto_id")
          .eq("id", params.dealId)
          .maybeSingle();
        resolvedProjetoId = (dealRow?.projeto_id as string | null) || null;
      }

      const rpcPayload: Record<string, any> = {
        p_titulo: params.titulo || "Proposta sem título",
        p_lead_id: params.leadId || null,
        p_projeto_id: resolvedProjetoId,
        p_deal_id: params.dealId || null,
        p_origem: "native",
        p_potencia_kwp: params.potenciaKwp,
        p_valor_total: params.precoFinal,
        p_snapshot: sanitized as any,
      };

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

      const { data, error } = await supabase.rpc(
        "create_proposta_nativa_atomic" as any,
        rpcPayload,
      );

      if (error) {
        console.error("[persist] RPC error:", JSON.stringify(error, null, 2));
        return {
          status: "error",
          reason: error.message,
          message: "Erro ao criar proposta",
        };
      }

      const result = data as any;
      //   proposta_id: result.proposta_id,
      //   versao_id: result.versao_id,
      //   projeto_id: result.projeto_id,
      // });

      // If intent is active, update via RPC to avoid enum type mismatch
      // (proposta_versoes.status is enum proposta_nativa_status, direct text update fails)
      if (setActive && result.versao_id) {
        const { error: rpcErr } = await supabase.rpc(
          "proposal_create_version" as any,
          {
            p_proposta_id: result.proposta_id,
            p_versao_id: result.versao_id,
            p_snapshot: sanitized as any,
            p_potencia_kwp: params.potenciaKwp,
            p_valor_total: params.precoFinal,
            p_economia_mensal: params.economiaMensal || null,
            p_geracao_mensal: params.geracaoMensal || null,
            p_grupo: normalizeGrupo(params.snapshot?.grupo),
            p_intent: "active",
          },
        );
        if (rpcErr) {
          console.warn("[persist] RPC active update after create failed:", rpcErr.message);
        }
      }

    // SSOT backend: trigger tr_sync_proposal_value propaga valor_total/potencia_kwp
    // de proposta_versoes oficiais para deals e projetos. Frontend NÃO sincroniza
    // valor financeiro/comercial. Apenas mantém kwp técnico no deal (não-oficial).
    const syncDealId = params.dealId || null;
    if (syncDealId && params.potenciaKwp > 0) {
      await supabase
        .from("deals")
        .update({ kwp: params.potenciaKwp, updated_at: new Date().toISOString() } as any)
        .eq("id", syncDealId);
    }

      return {
        status: "success",
        propostaId: result.proposta_id,
        versaoId: result.versao_id,
        projetoId: result.projeto_id,
        dealId: result.deal_id,
        clienteId: result.cliente_id,
        newVersionCreated: false,
        message: "Proposta criada com sucesso",
      };
    }

    // ══════ UPDATE: proposal exists ══════

    // Update proposta metadata
    const propostaUpdate: Record<string, any> = {
      titulo: params.titulo || "Proposta sem título",
      updated_at: new Date().toISOString(),
    };
    if (params.projetoId) propostaUpdate.projeto_id = params.projetoId;
    if (params.dealId) propostaUpdate.deal_id = params.dealId;
    if (params.leadId) propostaUpdate.lead_id = params.leadId;

    await supabase
      .from("propostas_nativas")
      .update(propostaUpdate)
      .eq("id", effectivePropostaId);

    // If no versaoId, we can only update metadata
    if (!effectiveVersaoId) {
      console.warn("[persist] sem versaoId — só metadata atualizada");
      return {
        status: "success",
        propostaId: effectivePropostaId,
        versaoId: undefined,
        newVersionCreated: false,
        message: "Metadados atualizados",
      };
    }

    // ── Backend-driven versioning via RPC ──
    //   proposta_id: effectivePropostaId,
    //   versao_id: effectiveVersaoId,
    //   intent,
    // });

    const { data: rpcResult, error: rpcErr } = await supabase.rpc(
      "proposal_create_version" as any,
      {
        p_proposta_id: effectivePropostaId,
        p_versao_id: effectiveVersaoId,
        p_snapshot: sanitized as any,
        p_potencia_kwp: params.potenciaKwp,
        p_valor_total: params.precoFinal,
        p_economia_mensal: params.economiaMensal || null,
        p_geracao_mensal: params.geracaoMensal || null,
        p_grupo: normalizeGrupo(params.snapshot?.grupo),
        p_intent: intent,
      },
    );

    if (rpcErr) {
      console.error("[persist] RPC proposal_create_version error:", rpcErr.message);
      return {
        status: "error",
        reason: rpcErr.message,
        message: "Erro ao salvar versão da proposta",
      };
    }

    const result = rpcResult as any;
    if (result?.error) {
      console.error("[persist] RPC retornou erro:", result.error);
      return {
        status: "error",
        reason: result.error,
        message: "Erro ao salvar versão da proposta",
      };
    }

    const finalVersaoId = result.versao_id;
    const newVersionCreated = result.new_version_created === true;

    //   versao_id: finalVersaoId,
    //   new_version_created: newVersionCreated,
    //   reason: result.reason,
    // });

    // SSOT backend: trigger tr_sync_proposal_value propaga valor_total/potencia_kwp
    // de proposta_versoes oficiais para deals e projetos. Frontend NÃO toca em
    // deals.value nem projetos.valor_total. Apenas mantém kwp técnico no deal.
    const syncDealId = params.dealId;
    if (syncDealId && params.potenciaKwp > 0) {
      await supabase
        .from("deals")
        .update({ kwp: params.potenciaKwp, updated_at: new Date().toISOString() } as any)
        .eq("id", syncDealId);
    }

    let syncProjetoId = params.projetoId || null;
    if (!syncProjetoId && effectivePropostaId) {
      const { data: pn } = await supabase
        .from("propostas_nativas")
        .select("projeto_id")
        .eq("id", effectivePropostaId)
        .maybeSingle();
      syncProjetoId = (pn as any)?.projeto_id ?? null;
    }
    if (syncProjetoId && params.potenciaKwp > 0) {
      await supabase
        .from("projetos")
        .update({ potencia_kwp: params.potenciaKwp, updated_at: new Date().toISOString() } as any)
        .eq("id", syncProjetoId);
    }

    return {
      status: "success",
      propostaId: effectivePropostaId,
      versaoId: finalVersaoId,
      newVersionCreated,
      message: newVersionCreated
        ? (setActive ? "Nova versão gerada" : "Nova versão criada")
        : (setActive ? "Proposta gerada" : "Proposta atualizada"),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[persist] exceção:", message);
    return {
      status: "error",
      reason: message,
      message: "Erro ao salvar proposta",
    };
  }
}

// ─── Hook ─────────────────────────────────────────────────

export function useWizardPersistence() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const persistAtomic = useCallback(
    async (
      params: PersistenceParams,
      intent: SaveIntent,
    ): Promise<AtomicPersistResult> => {
      const intentKey = buildIntentKey(params, intent);

      // Promise reuse: if same intent is already in-flight, return same promise
      const existing = inflightMap.get(intentKey);
      if (existing) {
        const reusedResult = await existing;
        return { ...reusedResult, status: "reused" as AtomicPersistStatus };
      }

      // Single-flight guard: block if any different operation is in-flight
      if (inflightMap.size > 0 || savingRef.current) {
        console.warn("[persist] bloqueado — operação em voo");
        return {
          status: "blocked",
          reason: "concurrent_save",
          message: "Aguarde o salvamento anterior terminar",
        };
      }

      savingRef.current = true;
      setSaving(true);

      const promise = persistProposalAtomic(params, intent);

      inflightMap.set(intentKey, promise);

      try {
        const result = await promise;
        
        // Success: invalidate project and proposal queries to reflect updated totals and versions
        if (result.status === "success") {
          const projetoId = result.projetoId || params.projetoId;
          const dealId = result.dealId || params.dealId;
          const customerId = result.clienteId || params.snapshot?.cliente?.id;

          if (projetoId) {
            queryClient.invalidateQueries({ queryKey: ["projeto", projetoId] });
            // For older hooks or direct projeto ID queries
            queryClient.invalidateQueries({ queryKey: ["projeto-detalhe", projetoId] });
          }
          
          if (dealId) {
            queryClient.invalidateQueries({ queryKey: projetoDetalheKeys.detail(dealId) });
            queryClient.invalidateQueries({ queryKey: projetoDetalheKeys.propostasCount(dealId) });
            queryClient.invalidateQueries({ queryKey: ["deal-pipeline", dealId] });
          }

          // Invalidate Propostas Tab query
          queryClient.invalidateQueries({ queryKey: ["propostas-projeto-tab"] });
        }

        return result;
      } finally {
        inflightMap.delete(intentKey);
        savingRef.current = false;
        setSaving(false);
      }
    },
    [],
  );

  return { persistAtomic, saving };
}
