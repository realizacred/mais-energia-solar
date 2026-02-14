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

// ─── Hook ────────────────────────────────────────────────────

export function useProjetoPipeline() {
  const [funis, setFunis] = useState<ProjetoFunil[]>([]);
  const [etapas, setEtapas] = useState<ProjetoEtapa[]>([]);
  const [etiquetas, setEtiquetas] = useState<ProjetoEtiqueta[]>([]);
  const [projetos, setProjetos] = useState<ProjetoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFunilId, setSelectedFunilId] = useState<string | null>(null);
  const { toast } = useToast();

  // ─── Fetch all data ──────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [funisRes, etapasRes, etiquetasRes, projetosRes, relsRes] = await Promise.all([
        supabase.from("projeto_funis").select("id, nome, ordem, ativo, tenant_id").order("ordem"),
        supabase.from("projeto_etapas").select("id, funil_id, nome, cor, ordem, categoria, tenant_id").order("ordem"),
        supabase.from("projeto_etiquetas").select("id, nome, cor, tenant_id"),
        supabase
          .from("projetos")
          .select("id, codigo, lead_id, cliente_id, consultor_id, funil_id, etapa_id, proposta_id, potencia_kwp, valor_total, status, observacoes, created_at, updated_at, clientes:cliente_id(nome, telefone), consultores:consultor_id(nome)")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("projeto_etiqueta_rel").select("projeto_id, etiqueta_id"),
      ]);

      if (funisRes.error) throw funisRes.error;
      if (etapasRes.error) throw etapasRes.error;
      if (etiquetasRes.error) throw etiquetasRes.error;
      if (projetosRes.error) throw projetosRes.error;

      setFunis(funisRes.data || []);
      setEtapas(etapasRes.data as ProjetoEtapa[] || []);
      setEtiquetas(etiquetasRes.data || []);

      // Map etiqueta relations
      const relMap = new Map<string, string[]>();
      (relsRes.data || []).forEach((r: any) => {
        const arr = relMap.get(r.projeto_id) || [];
        arr.push(r.etiqueta_id);
        relMap.set(r.projeto_id, arr);
      });

      const enriched: ProjetoItem[] = (projetosRes.data || []).map((p: any) => ({
        ...p,
        cliente: p.clientes || null,
        consultor: p.consultores || null,
        clientes: undefined,
        consultores: undefined,
        etiquetas: relMap.get(p.id) || [],
      }));

      setProjetos(enriched);

      // Auto-select first funil
      if (funisRes.data && funisRes.data.length > 0 && !selectedFunilId) {
        setSelectedFunilId(funisRes.data[0].id);
      }
    } catch (err: any) {
      console.error("useProjetoPipeline fetchAll:", err);
      toast({ title: "Erro ao carregar projetos", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, selectedFunilId]);

  useEffect(() => { fetchAll(); }, []);

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

    // Create default etapas
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

  // ─── Projeto move (drag) ─────────────────────────────────

  const moveProjetoToEtapa = useCallback(async (projetoId: string, etapaId: string) => {
    // Optimistic
    setProjetos(prev => prev.map(p => p.id === projetoId ? { ...p, etapa_id: etapaId } : p));
    const { error } = await supabase.from("projetos").update({ etapa_id: etapaId }).eq("id", projetoId);
    if (error) {
      toast({ title: "Erro ao mover projeto", description: error.message, variant: "destructive" });
      fetchAll();
    }
  }, [toast, fetchAll]);

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

  // Unique consultores for filter
  const consultoresFilter = useMemo(() => {
    const map = new Map<string, string>();
    projetos.forEach(p => {
      if (p.consultor_id && p.consultor?.nome) {
        map.set(p.consultor_id, p.consultor.nome);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [projetos]);

  return {
    funis,
    etapas,
    etiquetas,
    projetos,
    loading,
    selectedFunilId,
    setSelectedFunilId,
    selectedFunilEtapas,
    projetosByEtapa,
    consultoresFilter,
    fetchAll,
    createFunil,
    renameFunil,
    toggleFunilAtivo,
    reorderFunis,
    createEtapa,
    renameEtapa,
    moveProjetoToEtapa,
  };
}
