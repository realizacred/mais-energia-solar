import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────

export interface ProjetoFunil {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  tenant_id: string;
}

export type ProjetoEtapaCategoria = "aberto" | "ganho" | "perdido" | "excluido";

export interface ProjetoEtapa {
  id: string;
  funil_id: string;
  nome: string;
  cor: string;
  ordem: number;
  categoria: ProjetoEtapaCategoria;
  tenant_id: string;
}

export interface ProjetoEtiqueta {
  id: string;
  nome: string;
  cor: string;
  tenant_id: string;
}

export interface ProjetoItem {
  id: string;
  deal_id: string | null;
  codigo: string | null;
  projeto_num: number | null;
  lead_id: string | null;
  cliente_id: string | null;
  consultor_id: string | null;
  funil_id: string | null;
  etapa_id: string | null;
  proposta_id: string | null;
  potencia_kwp: number | null;
  valor_total: number | null;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  proposta_status?: string | null;
  // Joined
  cliente?: { nome: string; telefone: string } | null;
  consultor?: { nome: string } | null;
  etiquetas?: string[]; // etiqueta IDs
}

export interface ConsultorColumn {
  id: string;
  nome: string;
  ativo: boolean;
  projetos: ProjetoItem[];
  totalValor: number;
  totalKwp: number;
  count: number;
}

export interface ProjetoFiltersState {
  funilId: string | null;
  consultorId: string;
  status: string;
  etiquetaIds: string[];
  search: string;
}

const PROJETOS_FETCH_BATCH_SIZE = 1000;

async function fetchAllProjetosRows(baseQuery: any) {
  const allRows: any[] = [];
  let from = 0;

  while (true) {
    const to = from + PROJETOS_FETCH_BATCH_SIZE - 1;
    const { data, error } = await (baseQuery as any).range(from, to);
    if (error) throw error;

    const batch = data || [];
    allRows.push(...batch);

    if (batch.length < PROJETOS_FETCH_BATCH_SIZE) break;
    from += PROJETOS_FETCH_BATCH_SIZE;
  }

  return allRows;
}

const PROPOSTA_STATUS_PRIORITY: Record<string, number> = {
  aceita: 1,
  accepted: 1,
  aprovada: 1,
  ganha: 1,
  enviada: 2,
  sent: 2,
  vista: 2,
  visualizada: 2,
  gerada: 3,
  generated: 3,
  rascunho: 4,
  draft: 4,
  recusada: 5,
  rejeitada: 5,
  perdida: 5,
  rejected: 5,
  cancelada: 6,
  expirada: 6,
  arquivada: 7,
  excluida: 99,
};

// ─── Hook ────────────────────────────────────────────────────

export function useProjetoPipeline() {
  const [funis, setFunis] = useState<ProjetoFunil[]>([]);
  const [etapas, setEtapas] = useState<ProjetoEtapa[]>([]);
  const [etiquetas, setEtiquetas] = useState<ProjetoEtiqueta[]>([]);
  const [projetos, setProjetos] = useState<ProjetoItem[]>([]);
  const [consultores, setConsultores] = useState<{ id: string; nome: string; ativo: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFunilId, setSelectedFunilId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProjetoFiltersState>({
    funilId: null,
    consultorId: "todos",
    status: "todos",
    etiquetaIds: [],
    search: "",
  });
  const { toast } = useToast();

  // ─── Fetch metadata (funis, etapas, etiquetas, consultores) ──
  const fetchMetadata = useCallback(async () => {
    const [funisRes, etapasRes, etiquetasRes, consultoresRes] = await Promise.all([
      supabase.from("projeto_funis").select("id, nome, ordem, ativo, tenant_id").order("ordem"),
      supabase.from("projeto_etapas").select("id, funil_id, nome, cor, ordem, categoria, tenant_id").order("ordem"),
      supabase.from("projeto_etiquetas").select("id, nome, cor, tenant_id"),
      supabase.from("consultores").select("id, nome, ativo").order("nome"),
    ]);

    if (funisRes.error) throw funisRes.error;
    if (etapasRes.error) throw etapasRes.error;

    const nextFunis = funisRes.data || [];
    const nextEtapas = (etapasRes.data as ProjetoEtapa[]) || [];

    setFunis(nextFunis);
    setEtapas(nextEtapas);
    setEtiquetas(etiquetasRes.data || []);
    setConsultores(consultoresRes.data || []);

    return {
      funis: nextFunis,
      etapas: nextEtapas,
    };
  }, []);

  // ─── Fetch projetos with backend filters ──────────────────
  const fetchProjetos = useCallback(async (
    f: ProjetoFiltersState,
    availableEtapas: ProjetoEtapa[] = etapas,
    availableFunis: ProjetoFunil[] = funis,
  ) => {
    let query = supabase
      .from("projetos")
      .select("id, deal_id, codigo, projeto_num, lead_id, cliente_id, consultor_id, funil_id, etapa_id, proposta_id, potencia_kwp, valor_total, status, observacoes, created_at, updated_at, clientes:cliente_id(nome, telefone)")
      .order("created_at", { ascending: false });

    if (f.consultorId !== "todos") {
      query = query.eq("consultor_id", f.consultorId);
    }
    if (f.status !== "todos") {
      query = query.eq("status", f.status as any);
    }
    if (f.search) {
      query = query.or(`codigo.ilike.%${f.search}%`);
    }

    const data = await fetchAllProjetosRows(query as any);

    const projetoIds = (data || []).map((p: any) => p.id);
    const relMap = new Map<string, string[]>();
    if (projetoIds.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < projetoIds.length; i += chunkSize) {
        const chunk = projetoIds.slice(i, i + chunkSize);
        const { data: rels } = await supabase
          .from("projeto_etiqueta_rel")
          .select("projeto_id, etiqueta_id")
          .in("projeto_id", chunk);
        (rels || []).forEach((r: any) => {
          const arr = relMap.get(r.projeto_id) || [];
          arr.push(r.etiqueta_id);
          relMap.set(r.projeto_id, arr);
        });
      }
    }

    const etapaFunilMap = new Map<string, string>();
    const etapasByFunil = new Map<string, ProjetoEtapa[]>();
    availableEtapas.forEach((etapa) => {
      etapaFunilMap.set(etapa.id, etapa.funil_id);
      const arr = etapasByFunil.get(etapa.funil_id) || [];
      arr.push(etapa);
      etapasByFunil.set(etapa.funil_id, arr);
    });

    let filteredData = data || [];
    if (f.funilId) {
      filteredData = filteredData.filter((p: any) => {
        const effectiveFunilId = p.etapa_id
          ? (etapaFunilMap.get(p.etapa_id) ?? p.funil_id ?? null)
          : (p.funil_id ?? null);

        return effectiveFunilId === f.funilId;
      });
    }

    if (f.etiquetaIds.length > 0) {
      const projetosComEtiqueta = new Set<string>();
      relMap.forEach((etIds, projId) => {
        if (f.etiquetaIds.some((eid) => etIds.includes(eid))) {
          projetosComEtiqueta.add(projId);
        }
      });
      filteredData = filteredData.filter((p: any) => projetosComEtiqueta.has(p.id));
    }

    const consultorIds = [...new Set(filteredData.map((p: any) => p.consultor_id).filter(Boolean))];
    const consultorMap = new Map<string, { nome: string }>();
    if (consultorIds.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < consultorIds.length; i += chunkSize) {
        const chunk = consultorIds.slice(i, i + chunkSize);
        const { data: cons } = await supabase
          .from("consultores")
          .select("id, nome")
          .in("id", chunk);
        (cons || []).forEach((c: any) => consultorMap.set(c.id, { nome: c.nome }));
      }
    }

    const filteredProjetoIds = filteredData.map((p: any) => p.id);
    const dealToProjetoId = new Map<string, string>();
    filteredData.forEach((p: any) => {
      if (p.deal_id) dealToProjetoId.set(p.deal_id, p.id);
    });

    const propostaRows: any[] = [];
    if (filteredProjetoIds.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < filteredProjetoIds.length; i += chunkSize) {
        const projetoChunk = filteredProjetoIds.slice(i, i + chunkSize);
        const dealChunk = filteredData
          .slice(i, i + chunkSize)
          .map((p: any) => p.deal_id)
          .filter(Boolean);

        const [byProjeto, byDeal] = await Promise.all([
          supabase
            .from("propostas_nativas")
            .select("id, deal_id, projeto_id, status, is_principal, created_at")
            .in("projeto_id", projetoChunk)
            .order("created_at", { ascending: false }),
          dealChunk.length > 0
            ? supabase
                .from("propostas_nativas")
                .select("id, deal_id, projeto_id, status, is_principal, created_at")
                .in("deal_id", dealChunk)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (byProjeto.error) throw byProjeto.error;
        if (byDeal.error) throw byDeal.error;

        propostaRows.push(...(byProjeto.data || []), ...(byDeal.data || []));
      }
    }

    const uniquePropostas = new Map<string, any>();
    propostaRows.forEach((proposta) => uniquePropostas.set(proposta.id, proposta));

    const propostasByProjeto = new Map<string, any[]>();
    Array.from(uniquePropostas.values()).forEach((proposta) => {
      const projetoId = proposta.projeto_id || (proposta.deal_id ? dealToProjetoId.get(proposta.deal_id) : null);
      if (!projetoId) return;
      const arr = propostasByProjeto.get(projetoId) || [];
      arr.push(proposta);
      propostasByProjeto.set(projetoId, arr);
    });

    const bestPropostaByProjeto = new Map<string, { id: string; status: string | null }>();
    propostasByProjeto.forEach((propostas, projetoId) => {
      const principal = propostas.find((p) => p.is_principal && !["excluida", "cancelada", "arquivada"].includes(String(p.status || "").toLowerCase()));
      if (principal) {
        bestPropostaByProjeto.set(projetoId, { id: principal.id, status: principal.status || null });
        return;
      }

      const sorted = [...propostas].sort((a, b) => {
        const pa = PROPOSTA_STATUS_PRIORITY[String(a.status || "").toLowerCase()] ?? 50;
        const pb = PROPOSTA_STATUS_PRIORITY[String(b.status || "").toLowerCase()] ?? 50;
        if (pa !== pb) return pa - pb;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });

      const best = sorted[0];
      if (best) {
        bestPropostaByProjeto.set(projetoId, { id: best.id, status: best.status || null });
      }
    });

    let enriched: ProjetoItem[] = filteredData.map((p: any) => ({
      ...p,
      cliente: p.clientes || null,
      consultor: p.consultor_id ? (consultorMap.get(p.consultor_id) || null) : null,
      proposta_id: bestPropostaByProjeto.get(p.id)?.id || null,
      proposta_status: bestPropostaByProjeto.get(p.id)?.status || null,
      clientes: undefined,
      etiquetas: relMap.get(p.id) || [],
    }));

    if (f.search) {
      const q = f.search.toLowerCase();
      enriched = enriched.filter((p) =>
        (p.cliente?.nome || "").toLowerCase().includes(q) ||
        (p.cliente?.telefone || "").toLowerCase().includes(q) ||
        (p.codigo || "").toLowerCase().includes(q) ||
        (p.consultor?.nome || "").toLowerCase().includes(q)
      );
    }

    return enriched;
  }, [etapas, funis]);

  // ─── Full fetch ──────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const metadata = await fetchMetadata();
      const enriched = await fetchProjetos(filters, metadata.etapas, metadata.funis);
      setProjetos(enriched);

      // Auto-select first funil
      if (metadata.funis.length > 0 && !selectedFunilId) {
        const firstActive = metadata.funis.find((f: any) => f.ativo);
        if (firstActive) {
          setSelectedFunilId(firstActive.id);
        }
      }
    } catch (err: any) {
      console.error("useProjetoPipeline fetchAll:", err);
      toast({ title: "Erro ao carregar projetos", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, selectedFunilId, filters, fetchMetadata, fetchProjetos]);

  useEffect(() => { fetchAll(); }, []);

  // ⚠️ HARDENING: Realtime subscription + polling fallback for cross-user sync
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshProjetos = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const enriched = await fetchProjetos(filters);
          setProjetos(enriched);
        } catch (e) {
          console.error("Realtime projetos refresh:", e);
        }
      }, 500);
    };

    const channel = supabase
      .channel('projetos-pipeline-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projetos' }, refreshProjetos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projeto_etapas' }, refreshProjetos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projeto_funis' }, refreshProjetos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_pipeline_stages' }, refreshProjetos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipelines' }, refreshProjetos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_stages' }, refreshProjetos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'propostas_nativas' }, refreshProjetos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, refreshProjetos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, refreshProjetos)
      .subscribe();

    // Polling fallback (30s) — catches service_role inserts missed by Realtime
    const pollInterval = setInterval(refreshProjetos, 30_000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshProjetos();
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [filters, fetchProjetos]);

  // Re-fetch projetos when filters change (but not on initial load)
  const applyFilters = useCallback(async (newFilters: Partial<ProjetoFiltersState>) => {
    const merged = { ...filters, ...newFilters };
    if (Object.prototype.hasOwnProperty.call(newFilters, "funilId")) {
      setSelectedFunilId(newFilters.funilId ?? null);
    }
    setFilters(merged);
    setLoading(true);
    try {
      const enriched = await fetchProjetos(merged);
      setProjetos(enriched);
    } catch (err: any) {
      console.error("useProjetoPipeline applyFilters:", err);
      toast({ title: "Erro ao filtrar projetos", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filters, fetchProjetos, toast]);

  // ─── Funil CRUD ──────────────────────────────────────────

  const createFunil = useCallback(async (nome: string) => {
    const ordem = funis.length;
    const { data, error } = await supabase
      .from("projeto_funis")
      .insert({ nome, ordem } as any)
      .select("id, nome, ordem, ativo, tenant_id")
      .single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return null; }
    setFunis(prev => [...prev, data]);

    const defaultEtapas = [
      { nome: "Novo", cor: "#3B82F6", ordem: 0, categoria: "aberto" as const, funil_id: data.id },
      { nome: "Em Andamento", cor: "#F59E0B", ordem: 1, categoria: "aberto" as const, funil_id: data.id },
      { nome: "Ganho", cor: "#10B981", ordem: 2, categoria: "ganho" as const, funil_id: data.id },
      { nome: "Perdido", cor: "#EF4444", ordem: 3, categoria: "perdido" as const, funil_id: data.id },
    ];
    const { data: newEtapas, error: etapaErr } = await supabase
      .from("projeto_etapas")
      .insert(defaultEtapas as any)
      .select("id, funil_id, nome, cor, ordem, categoria, tenant_id");
    if (!etapaErr && newEtapas) {
      setEtapas(prev => [...prev, ...newEtapas as ProjetoEtapa[]]);
    }

    setSelectedFunilId(data.id);
    toast({ title: `Funil "${nome}" criado` });
    return data;
  }, [funis.length, toast]);

  const renameFunil = useCallback(async (id: string, nome: string) => {
    const { error } = await supabase.from("projeto_funis").update({ nome }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setFunis(prev => prev.map(f => f.id === id ? { ...f, nome } : f));
  }, [toast]);

  const toggleFunilAtivo = useCallback(async (id: string, ativo: boolean) => {
    // Protect "Comercial" only if it has projects
    const funil = funis.find(f => f.id === id);
    if (!ativo && funil?.nome?.toLowerCase() === "comercial") {
      const hasProjects = projetos.some(p => p.funil_id === id);
      if (hasProjects) {
        toast({ title: "Funil protegido", description: "O funil 'Comercial' não pode ser desativado enquanto tiver projetos.", variant: "destructive" });
        return;
      }
    }
    const { error } = await supabase.from("projeto_funis").update({ ativo }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setFunis(prev => prev.map(f => f.id === id ? { ...f, ativo } : f));
    if (!ativo && selectedFunilId === id) {
      const next = funis.find(f => f.id !== id && f.ativo);
      if (next) setSelectedFunilId(next.id);
    }
    toast({ title: ativo ? "Funil reativado" : "Funil desativado" });
  }, [toast, selectedFunilId, funis, projetos]);

  const deleteFunil = useCallback(async (id: string) => {
    const funil = funis.find(f => f.id === id);
    const hasProjects = projetos.some(p => p.funil_id === id);
    if (hasProjects) {
      toast({ title: "Erro", description: "Não é possível deletar funil com projetos vinculados.", variant: "destructive" });
      return false;
    }
    // Delete etapas first, then the funil
    const { error: etapaErr } = await supabase.from("projeto_etapas").delete().eq("funil_id", id);
    if (etapaErr) { toast({ title: "Erro ao deletar etapas", description: etapaErr.message, variant: "destructive" }); return false; }
    const { error } = await supabase.from("projeto_funis").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao deletar funil", description: error.message, variant: "destructive" }); return false; }
    setFunis(prev => prev.filter(f => f.id !== id));
    setEtapas(prev => prev.filter(e => e.funil_id !== id));
    if (selectedFunilId === id) {
      const next = funis.find(f => f.id !== id && f.ativo);
      if (next) setSelectedFunilId(next.id);
    }
    toast({ title: `Funil "${funil?.nome}" deletado com sucesso` });
    return true;
  }, [funis, projetos, selectedFunilId, toast]);

  const reorderFunis = useCallback(async (orderedIds: string[]) => {
    setFunis(prev => prev.map(f => {
      const idx = orderedIds.indexOf(f.id);
      return idx >= 0 ? { ...f, ordem: idx } : f;
    }).sort((a, b) => a.ordem - b.ordem));
    for (let i = 0; i < orderedIds.length; i++) {
      await supabase.from("projeto_funis").update({ ordem: i }).eq("id", orderedIds[i]);
    }
  }, []);

  // ─── Etapa CRUD ──────────────────────────────────────────

  const createEtapa = useCallback(async (funilId: string, nome: string, categoria: ProjetoEtapaCategoria = "aberto") => {
    const funilEtapas = etapas.filter(e => e.funil_id === funilId);
    const ordem = funilEtapas.length;
    const { data, error } = await supabase
      .from("projeto_etapas")
      .insert({ funil_id: funilId, nome, ordem, categoria } as any)
      .select("id, funil_id, nome, cor, ordem, categoria, tenant_id")
      .single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return null; }
    setEtapas(prev => [...prev, data as ProjetoEtapa]);
    return data;
  }, [etapas, toast]);

  const renameEtapa = useCallback(async (id: string, nome: string) => {
    const { error } = await supabase.from("projeto_etapas").update({ nome }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setEtapas(prev => prev.map(e => e.id === id ? { ...e, nome } : e));
  }, [toast]);

  const updateEtapaCor = useCallback(async (id: string, cor: string) => {
    const { error } = await supabase.from("projeto_etapas").update({ cor }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setEtapas(prev => prev.map(e => e.id === id ? { ...e, cor } : e));
  }, [toast]);

  const updateEtapaCategoria = useCallback(async (id: string, categoria: ProjetoEtapaCategoria) => {
    const { error } = await supabase.from("projeto_etapas").update({ categoria }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setEtapas(prev => prev.map(e => e.id === id ? { ...e, categoria } : e));
  }, [toast]);

  const reorderEtapas = useCallback(async (funilId: string, orderedIds: string[]) => {
    setEtapas(prev => prev.map(e => {
      const idx = orderedIds.indexOf(e.id);
      return idx >= 0 ? { ...e, ordem: idx } : e;
    }));
    for (let i = 0; i < orderedIds.length; i++) {
      await supabase.from("projeto_etapas").update({ ordem: i }).eq("id", orderedIds[i]);
    }
  }, []);

  const deleteEtapa = useCallback(async (id: string) => {
    const { error } = await supabase.from("projeto_etapas").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setEtapas(prev => prev.filter(e => e.id !== id));
    toast({ title: "Etapa removida" });
  }, [toast]);

  // ─── Projeto actions ─────────────────────────────────────

  const moveProjetoToEtapa = useCallback(async (projetoId: string, etapaId: string) => {
    const etapa = etapas.find((item) => item.id === etapaId);
    const nextFunilId = etapa?.funil_id ?? null;

    setProjetos(prev => prev.map(p => p.id === projetoId ? {
      ...p,
      etapa_id: etapaId,
      funil_id: nextFunilId ?? p.funil_id,
    } : p));

    const updatePayload = etapa
      ? { etapa_id: etapaId, funil_id: etapa.funil_id }
      : { etapa_id: etapaId };

    const { error } = await supabase.from("projetos").update(updatePayload).eq("id", projetoId);
    if (error) {
      toast({ title: "Erro ao mover projeto", description: error.message, variant: "destructive" });
      fetchAll();
    }
  }, [toast, fetchAll, etapas]);

  const moveProjetoToConsultor = useCallback(async (projetoId: string, consultorId: string) => {
    const consultor = consultores.find(c => c.id === consultorId);
    setProjetos(prev => prev.map(p => p.id === projetoId
      ? { ...p, consultor_id: consultorId, consultor: consultor ? { nome: consultor.nome } : null }
      : p
    ));
    const { error } = await supabase.from("projetos").update({ consultor_id: consultorId }).eq("id", projetoId);
    if (error) {
      toast({ title: "Erro ao mover projeto", description: error.message, variant: "destructive" });
      fetchAll();
    }
  }, [toast, fetchAll, consultores]);

  // ─── Computed ────────────────────────────────────────────

  const selectedFunilEtapas = useMemo(
    () => etapas.filter(e => e.funil_id === selectedFunilId).sort((a, b) => a.ordem - b.ordem),
    [etapas, selectedFunilId]
  );

  const projetosByEtapa = useMemo(() => {
    const map = new Map<string | null, ProjetoItem[]>();
    projetos
      .filter(p => p.funil_id === selectedFunilId)
      .forEach(p => {
        const key = p.etapa_id || null;
        const arr = map.get(key) || [];
        arr.push(p);
        map.set(key, arr);
      });
    return map;
  }, [projetos, selectedFunilId]);

  // Group by consultant for owner-based Kanban
  const consultorColumns = useMemo((): ConsultorColumn[] => {
    const map = new Map<string, ProjetoItem[]>();
    
    projetos.forEach(p => {
      if (p.consultor_id) {
        const arr = map.get(p.consultor_id) || [];
        arr.push(p);
        map.set(p.consultor_id, arr);
      }
    });

    // Show ALL consultores (active + inactive), even those without projects
    return consultores
      .map(c => {
        const items = map.get(c.id) || [];
        return {
          id: c.id,
          nome: c.nome,
          ativo: c.ativo,
          projetos: items,
          totalValor: items.reduce((sum, p) => sum + (p.valor_total || 0), 0),
          totalKwp: items.reduce((sum, p) => sum + (p.potencia_kwp || 0), 0),
          count: items.length,
        };
      })
      // Active first, then by value desc, then name
      .sort((a, b) => {
        if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
        return b.totalValor - a.totalValor || a.nome.localeCompare(b.nome);
      });
  }, [projetos, consultores]);

  // Unique consultores for filter (from loaded consultores)
  const consultoresFilter = useMemo(() => {
    return consultores.map(c => ({ id: c.id, nome: c.nome }));
  }, [consultores]);

  return {
    funis,
    etapas,
    etiquetas,
    projetos,
    consultores,
    loading,
    selectedFunilId,
    setSelectedFunilId,
    filters,
    applyFilters,
    selectedFunilEtapas,
    projetosByEtapa,
    consultorColumns,
    consultoresFilter,
    fetchAll,
    createFunil,
    renameFunil,
    toggleFunilAtivo,
    deleteFunil,
    reorderFunis,
    createEtapa,
    renameEtapa,
    updateEtapaCor,
    updateEtapaCategoria,
    reorderEtapas,
    deleteEtapa,
    moveProjetoToEtapa,
    moveProjetoToConsultor,
  };
}
