import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

function sanitizeSnapshot(snapshot: any): Record<string, unknown> {
  if (!snapshot) return snapshot;
   
  const { mapSnapshots, ...rest } = snapshot;
  return { ...rest, grupo: normalizeGrupo(rest.grupo) };
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
      console.log("[persist] criando nova proposta", {
        deal_id: params.dealId || null,
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
        const isDuplicateProject = error.message?.includes("idx_projetos_unique_cliente_ativo");
        return {
          status: "error",
          reason: isDuplicateProject
            ? "Este cliente já possui um projeto ativo. Finalize ou arquive o projeto existente antes de criar uma nova proposta."
            : error.message,
          message: isDuplicateProject
            ? "Projeto duplicado"
            : "Erro ao criar proposta",
        };
      }

      const result = data as any;
      console.log("[persist] proposta criada", {
        proposta_id: result.proposta_id,
        versao_id: result.versao_id,
        projeto_id: result.projeto_id,
      });

      // If intent is active, update the freshly created version
      if (setActive) {
        const updateData: Record<string, any> = {
          status: "generated",
          gerado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await supabase
          .from("proposta_versoes")
          .update(updateData as any)
          .eq("id", result.versao_id);
      }

      return {
        status: "success",
        propostaId: result.proposta_id,
        versaoId: result.versao_id,
        projetoId: result.projeto_id,
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

    // Always overwrite the existing version (unlock if locked)
    console.log("[persist] atualizando versão existente (sobrescrevendo)", effectiveVersaoId);

    const updateData: Record<string, any> = {
      potencia_kwp: params.potenciaKwp,
      valor_total: params.precoFinal,
      economia_mensal: params.economiaMensal || null,
      geracao_mensal: params.geracaoMensal || null,
      grupo: grupoNormalized,
      snapshot: sanitized,
      updated_at: new Date().toISOString(),
      // Unlock so it can be overwritten
      snapshot_locked: setActive,
      finalized_at: null,
    };
    if (setActive) {
      updateData.status = "generated";
      updateData.gerado_em = new Date().toISOString();
    } else {
      updateData.status = "draft";
    }

    const { error: vErr } = await supabase
      .from("proposta_versoes")
      .update(updateData as any)
      .eq("id", effectiveVersaoId);

    if (vErr) {
      console.error("[persist] erro ao atualizar versão:", vErr.message);
      return {
        status: "error",
        reason: vErr.message,
        message: "Erro ao atualizar proposta",
      };
    }

    return {
      status: "success",
      propostaId: effectivePropostaId,
      versaoId: effectiveVersaoId,
      newVersionCreated: false,
      message: setActive ? "Proposta gerada" : "Proposta atualizada",
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
        console.log("[persist] reutilizando promise:", intentKey);
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
        return await promise;
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
