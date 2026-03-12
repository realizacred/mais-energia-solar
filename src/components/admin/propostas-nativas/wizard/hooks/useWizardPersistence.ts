import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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

export interface PersistenceParams {
  propostaId?: string | null;
  versaoId?: string | null;
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

export interface AtomicPersistResult {
  propostaId: string;
  versaoId: string;
  projetoId?: string;
  /** Whether the result was reused from an in-flight promise */
  reused?: boolean;
  /** Whether a new version was created because the previous one was locked */
  newVersionCreated?: boolean;
}

type SaveIntent = "draft" | "active";

// ─── Fingerprint: stable, lightweight hash of save intent ──

function stableFingerprint(obj: Record<string, unknown>): string {
  // Deterministic JSON with sorted keys — lightweight, no crypto needed
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  // djb2 hash — fast and sufficient for idempotency dedup
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function buildIntentKey(
  intent: SaveIntent,
  propostaId: string | null | undefined,
  versaoId: string | null | undefined,
  snapshot: WizardSnapshot,
): string {
  // Include only structurally significant fields to avoid volatile false-positives
  const fp = stableFingerprint({
    intent,
    propostaId: propostaId || "",
    versaoId: versaoId || "",
    potencia: snapshot.potenciaKwp,
    grupo: snapshot.grupo,
    titulo: snapshot.nomeProposta,
    ucsLen: snapshot.ucs?.length ?? 0,
    itensLen: snapshot.itens?.length ?? 0,
    precoFinal: snapshot.venda?.desconto_percentual ?? 0,
    pagLen: snapshot.pagamentoOpcoes?.length ?? 0,
  });
  return `${intent}:${propostaId || "new"}:${fp}`;
}

// ─── Hook ─────────────────────────────────────────────────

export function useWizardPersistence() {
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // In-flight promise map for idempotent dedup (promise reuse)
  const inflightMapRef = useRef<Map<string, Promise<AtomicPersistResult | null>>>(new Map());
  // Track last completed intent to suppress duplicate toasts
  const lastCompletedIntentRef = useRef<string | null>(null);

  /** Normalize grupo to 'A' or 'B' only — defense in depth (§33 AGENTS.md) */
  const normalizeGrupo = (g: string | null | undefined): string | null => {
    if (!g) return null;
    if (g.startsWith("A")) return "A";
    if (g.startsWith("B")) return "B";
    return null;
  };

  /** Remove heavy frontend-only fields (base64 images) and normalize grupo before DB persistence */
  const sanitizeSnapshot = (snapshot: any) => {
    if (!snapshot) return snapshot;
    const { mapSnapshots, ...rest } = snapshot;
    return { ...rest, grupo: normalizeGrupo(rest.grupo) };
  };

  // ─── Core: atomic persist (single-flight + idempotent) ───

  const persistAtomicInternal = useCallback(async (
    params: PersistenceParams,
    intent: SaveIntent,
  ): Promise<AtomicPersistResult | null> => {
    const setActive = intent === "active";

    let propostaId = params.propostaId || null;
    let versaoId = params.versaoId || null;

    // Guard: prevent accidental creation when editing (race condition with async restore)
    const urlPropostaId = new URLSearchParams(window.location.search).get("proposta_id");
    const urlVersaoId = new URLSearchParams(window.location.search).get("versao_id");

    if (!propostaId && urlPropostaId) {
      console.error("[persistAtomic] Bloqueado: race condition — proposta_id na URL mas não no estado", { propostaId, urlPropostaId });
      toast({ title: "Aguarde", description: "A proposta ainda está sendo carregada. Tente novamente em instantes.", variant: "destructive" });
      return null;
    }

    // Effective IDs with URL fallback
    const effectivePropostaId = propostaId || urlPropostaId;
    const effectiveVersaoId = versaoId || urlVersaoId;

    // === CREATE: no existing proposal ===
    if (!effectivePropostaId) {
      console.log("[persistAtomic] Creating proposal via atomic RPC", {
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
        p_snapshot: sanitizeSnapshot(params.snapshot) as any,
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
        console.error("[persistAtomic] RPC error:", JSON.stringify(error, null, 2));
        toast({ title: "Erro ao criar proposta", description: error.message, variant: "destructive" });
        return null;
      }

      const result = data as any;
      console.log("[persistAtomic] Proposal created", { proposta_id: result.proposta_id, versao_id: result.versao_id, projeto_id: result.projeto_id });
      toast({ title: "✅ Rascunho criado", description: "Proposta e projeto criados com sucesso." });

      const createResult: AtomicPersistResult = {
        propostaId: result.proposta_id,
        versaoId: result.versao_id,
        projetoId: result.projeto_id,
      };

      // If intent is active, immediately update the freshly created version
      if (setActive) {
        const activeRes = await this_updateVersion(
          result.proposta_id,
          result.versao_id,
          params,
          true,
        );
        if (activeRes) return activeRes;
      }

      return createResult;
    }

    // === UPDATE: proposal exists ===
    console.log("[persistAtomic] Updating existing", { effectivePropostaId, effectiveVersaoId, intent });

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

    if (!effectiveVersaoId) {
      toast({ title: "✅ Proposta atualizada" });
      return { propostaId: effectivePropostaId, versaoId: effectivePropostaId };
    }

    return this_updateVersion(effectivePropostaId, effectiveVersaoId, params, setActive);
  }, []);

  // ─── Helper: update or create version (handles lock) ───

  const this_updateVersion = async (
    propostaId: string,
    versaoId: string,
    params: PersistenceParams,
    setActive: boolean,
  ): Promise<AtomicPersistResult | null> => {
    // Check if current version is locked
    const { data: currentVersao } = await supabase
      .from("proposta_versoes")
      .select("snapshot_locked, status")
      .eq("id", versaoId)
      .single();

    const grupoNormalized = params.snapshot?.grupo
      ? (String(params.snapshot.grupo).startsWith("A") ? "A" : "B")
      : null;

    if (currentVersao?.snapshot_locked) {
      // Version is immutable — create a new draft version
      const { data: newVersao, error: createErr } = await supabase
        .from("proposta_versoes")
        .insert({
          proposta_id: propostaId,
          potencia_kwp: params.potenciaKwp,
          valor_total: params.precoFinal,
          economia_mensal: params.economiaMensal || null,
          geracao_mensal: params.geracaoMensal || null,
          grupo: grupoNormalized,
          snapshot: sanitizeSnapshot(params.snapshot) as any,
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

      toast({
        title: "Nova versão criada",
        description: "Esta proposta já foi gerada. Uma nova versão foi criada para edição.",
      });

      return {
        propostaId,
        versaoId: newVersao.id,
        newVersionCreated: true,
      };
    }

    // Update existing draft version
    const updateData: Record<string, any> = {
      potencia_kwp: params.potenciaKwp,
      valor_total: params.precoFinal,
      economia_mensal: params.economiaMensal || null,
      geracao_mensal: params.geracaoMensal || null,
      grupo: grupoNormalized,
      snapshot: sanitizeSnapshot(params.snapshot),
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

    toast({
      title: setActive ? "✅ Proposta gerada" : "✅ Proposta atualizada",
      description: setActive ? "A proposta foi marcada como gerada." : "Os dados foram atualizados.",
    });

    return { propostaId, versaoId };
  };

  // ─── Public API: atomic persist with single-flight + promise reuse ───

  const persistAtomic = useCallback(async (
    params: PersistenceParams,
    intent: SaveIntent,
  ): Promise<AtomicPersistResult | null> => {
    const intentKey = buildIntentKey(
      intent,
      params.propostaId,
      params.versaoId,
      params.snapshot,
    );

    // Promise reuse: if same intent is already in-flight, return same promise
    const existing = inflightMapRef.current.get(intentKey);
    if (existing) {
      console.log("[persistAtomic] Reusing in-flight promise for intent:", intentKey);
      return existing;
    }

    // Single-flight guard via ref (covers cross-intent concurrency)
    if (savingRef.current) {
      console.warn("[persistAtomic] Another save is in-flight, blocking concurrent call");
      return null;
    }

    savingRef.current = true;
    setSaving(true);

    const promise = persistAtomicInternal(params, intent)
      .then((result) => {
        lastCompletedIntentRef.current = intentKey;
        return result;
      })
      .catch((err: any) => {
        console.error("[persistAtomic] Exception:", err);
        toast({ title: "Erro ao salvar", description: err?.message || "Tente novamente.", variant: "destructive" });
        return null;
      })
      .finally(() => {
        inflightMapRef.current.delete(intentKey);
        savingRef.current = false;
        setSaving(false);
      });

    inflightMapRef.current.set(intentKey, promise);
    return promise;
  }, [persistAtomicInternal]);

  // ─── Legacy API wrappers (preserve backward compatibility) ───

  const saveDraft = useCallback(async (params: PersistenceParams): Promise<AtomicPersistResult | null> => {
    return persistAtomic(params, "draft");
  }, [persistAtomic]);

  const updateProposal = useCallback(async (params: PersistenceParams, setActive: boolean): Promise<AtomicPersistResult | null> => {
    return persistAtomic(params, setActive ? "active" : "draft");
  }, [persistAtomic]);

  return { saveDraft, updateProposal, persistAtomic, saving };
}
