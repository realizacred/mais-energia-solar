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
  codigo: string | null;
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
  // Joined
  cliente?: { nome: string; telefone: string } | null;
  consultor?: { nome: string } | null;
  etiquetas?: string[]; // etiqueta IDs
}

export interface ConsultorColumn {
  id: string;
  nome: string;
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

// ─── Hook ────────────────────────────────────────────────────

export function useProjetoPipeline() {
  const [funis, setFunis] = useState<ProjetoFunil[]>([]);
  const [etapas, setEtapas] = useState<ProjetoEtapa[]>([]);
  const [etiquetas, setEtiquetas] = useState<ProjetoEtiqueta[]>([]);
  const [projetos, setProjetos] = useState<ProjetoItem[]>([]);
  const [consultores, setConsultores] = useState<{ id: string; nome: string }[]>([]);
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
      supabase.from("consultores").select("id, nome").eq("ativo", true).order("nome"),
    ]);

    if (funisRes.error) throw funisRes.error;
    if (etapasRes.error) throw etapasRes.error;

    setFunis(funisRes.data || []);
    setEtapas(etapasRes.data as ProjetoEtapa[] || []);
    setEtiquetas(etiquetasRes.data || []);
    setConsultores(consultoresRes.data || []);

    return funisRes.data || [];
  }, []);

  // ─── Fetch projetos with backend filters ──────────────────
  const fetchProjetos = useCallback(async (f: ProjetoFiltersState) => {
    let query = supabase
      .from("projetos")
      .select("id, codigo, lead_id, cliente_id, consultor_id, funil_id, etapa_id, proposta_id, potencia_kwp, valor_total, status, observacoes, created_at, updated_at, clientes:cliente_id(nome, telefone)")
      .order("created_at", { ascending: false })
      .limit(500);

    // Backend filters
    if (f.funilId) {
      query = query.eq("funil_id", f.funilId);
    }
    if (f.consultorId !== "todos") {
      query = query.eq("consultor_id", f.consultorId);
    }
    if (f.status !== "todos") {
      query = query.eq("status", f.status as any);
    }
    if (f.search) {
      // Search by codigo or client name via ilike on codigo (client search needs post-filter)
      query = query.or(`codigo.ilike.%${f.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Fetch etiqueta relations
    const projetoIds = (data || []).map((p: any) => p.id);
    let relMap = new Map<string, string[]>();
    if (projetoIds.length > 0) {
      const { data: rels } = await supabase
        .from("projeto_etiqueta_rel")
        .select("projeto_id, etiqueta_id")
        .in("projeto_id", projetoIds);
      (rels || []).forEach((r: any) => {
        const arr = relMap.get(r.projeto_id) || [];
        arr.push(r.etiqueta_id);
        relMap.set(r.projeto_id, arr);
      });
    }

    // Filter by etiquetas if any selected
    let filteredData = data || [];
    if (f.etiquetaIds.length > 0) {
      const projetosComEtiqueta = new Set<string>();
      relMap.forEach((etIds, projId) => {
        if (f.etiquetaIds.some(eid => etIds.includes(eid))) {
          projetosComEtiqueta.add(projId);
        }
      });
      filteredData = filteredData.filter((p: any) => projetosComEtiqueta.has(p.id));
    }

    // Enrich with consultant names
    const consultorIds = [...new Set(filteredData.map((p: any) => p.consultor_id).filter(Boolean))];
    const consultorMap = new Map<string, string>();
    if (consultorIds.length > 0) {
      const { data: cData } = await supabase
        .from("consultores")
        .select("id, nome")
        .in("id", consultorIds);
      (cData || []).forEach((c: any) => consultorMap.set(c.id, c.nome));
    }

    // Post-filter search by client name (not possible via Supabase query on joined field)
    let enriched: ProjetoItem[] = filteredData.map((p: any) => ({
      ...p,
      cliente: p.clientes || null,
      consultor: p.consultor_id && consultorMap.has(p.consultor_id) ? { nome: consultorMap.get(p.consultor_id)! } : null,
      clientes: undefined,
      etiquetas: relMap.get(p.id) || [],
    }));

    if (f.search) {
      const q = f.search.toLowerCase();
      enriched = enriched.filter(p =>
        (p.cliente?.nome || "").toLowerCase().includes(q) ||
        (p.codigo || "").toLowerCase().includes(q) ||
        (p.consultor?.nome || "").toLowerCase().includes(q)
      );
    }

    return enriched;
  }, []);

  // ─── Full fetch ──────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const funisData = await fetchMetadata();
      const enriched = await fetchProjetos(filters);
      setProjetos(enriched);

      // Auto-select first funil
      if (funisData.length > 0 && !selectedFunilId) {
        const firstActive = funisData.find((f: any) => f.ativo);
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

  // Re-fetch projetos when filters change (but not on initial load)
  const applyFilters = useCallback(async (newFilters: Partial<ProjetoFiltersState>) => {
    const merged = { ...filters, ...newFilters };
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
    const { error } = await supabase.from("projeto_funis").update({ ativo }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setFunis(prev => prev.map(f => f.id === id ? { ...f, ativo } : f));
    if (!ativo && selectedFunilId === id) {
      const next = funis.find(f => f.id !== id && f.ativo);
      if (next) setSelectedFunilId(next.id);
    }
    toast({ title: ativo ? "Funil reativado" : "Funil desativado" });
  }, [toast, selectedFunilId, funis]);

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
    setProjetos(prev => prev.map(p => p.id === projetoId ? { ...p, etapa_id: etapaId } : p));
    const { error } = await supabase.from("projetos").update({ etapa_id: etapaId }).eq("id", projetoId);
    if (error) {
      toast({ title: "Erro ao mover projeto", description: error.message, variant: "destructive" });
      fetchAll();
    }
  }, [toast, fetchAll]);

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
      .filter(p => p.funil_id === selectedFunilId || (!p.funil_id && selectedFunilId))
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

    return consultores
      .filter(c => map.has(c.id) || true) // Show all active consultores
      .map(c => {
        const items = map.get(c.id) || [];
        return {
          id: c.id,
          nome: c.nome,
          projetos: items,
          totalValor: items.reduce((sum, p) => sum + (p.valor_total || 0), 0),
          totalKwp: items.reduce((sum, p) => sum + (p.potencia_kwp || 0), 0),
          count: items.length,
        };
      })
      .filter(c => c.count > 0) // Only show consultores with projects
      .sort((a, b) => b.totalValor - a.totalValor);
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
