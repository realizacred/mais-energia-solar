import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────

export interface Pipeline {
  id: string;
  tenant_id: string;
  name: string;
  version: number;
  is_active: boolean;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  name: string;
  position: number;
  probability: number;
  is_closed: boolean;
  is_won: boolean;
}

export interface DealKanbanCard {
  deal_id: string;
  tenant_id: string;
  pipeline_id: string;
  stage_id: string;
  stage_name: string;
  stage_position: number;
  owner_id: string;
  owner_name: string;
  customer_name: string;
  customer_phone: string;
  deal_title: string;
  deal_value: number;
  deal_kwp: number;
  deal_status: string;
  stage_probability: number;
  last_stage_change: string;
  etiqueta: string | null;
  // Enriched proposal data
  proposta_status?: string | null;
  proposta_economia_mensal?: number | null;
  proposta_id?: string | null;
  customer_id?: string | null;
}

export interface OwnerColumn {
  id: string;
  nome: string;
  deals: DealKanbanCard[];
  totalValor: number;
  totalKwp: number; // kept for compat, not used in deals yet
  count: number;
}

export interface DealFilters {
  pipelineId: string | null;
  ownerId: string;
  status: string;
  search: string;
}

// ─── Hook ────────────────────────────────────────────────────

export function useDealPipeline() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<DealKanbanCard[]>([]);
  const [consultores, setConsultores] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DealFilters>({
    pipelineId: null,
    ownerId: "todos",
    status: "todos",
    search: "",
  });
  const { toast } = useToast();

  // ─── Fetch metadata ────────────────────────────────────
  const fetchMetadata = useCallback(async () => {
    const [pipelinesRes, stagesRes, consultoresRes] = await Promise.all([
      supabase
        .from("pipelines")
        .select("id, tenant_id, name, version, is_active, created_at")
        .eq("is_active", true)
        .order("created_at"),
      supabase
        .from("pipeline_stages")
        .select("id, tenant_id, pipeline_id, name, position, probability, is_closed, is_won")
        .order("position"),
      supabase
        .from("consultores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome"),
    ]);

    if (pipelinesRes.error) throw pipelinesRes.error;
    if (stagesRes.error) throw stagesRes.error;

    setPipelines((pipelinesRes.data || []) as Pipeline[]);
    setStages((stagesRes.data || []) as PipelineStage[]);
    setConsultores(consultoresRes.data || []);

    return (pipelinesRes.data || []) as Pipeline[];
  }, []);

  // ─── Fetch deals from projection ──────────────────────
  const fetchDeals = useCallback(async (f: DealFilters) => {
    let query = supabase
      .from("deal_kanban_projection")
      .select("deal_id, tenant_id, pipeline_id, stage_id, stage_name, stage_position, owner_id, owner_name, customer_name, customer_phone, deal_title, deal_value, deal_kwp, deal_status, stage_probability, last_stage_change, etiqueta")
      .order("last_stage_change", { ascending: false })
      .limit(500);

    if (f.pipelineId) {
      query = query.eq("pipeline_id", f.pipelineId);
    }
    if (f.ownerId !== "todos") {
      query = query.eq("owner_id", f.ownerId);
    }
    if (f.status !== "todos") {
      query = query.eq("deal_status", f.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = (data || []) as DealKanbanCard[];

    // Post-filter search
    if (f.search) {
      const q = f.search.toLowerCase();
      results = results.filter(d =>
        d.customer_name.toLowerCase().includes(q) ||
        d.deal_title.toLowerCase().includes(q) ||
        d.owner_name.toLowerCase().includes(q)
      );
    }

    // Enrich with proposal data
    if (results.length > 0) {
      const dealIds = results.map(d => d.deal_id);
      // Fetch customer_id from deals
      const { data: dealsData } = await supabase
        .from("deals")
        .select("id, customer_id")
        .in("id", dealIds);
      
      const customerMap = new Map<string, string>();
      (dealsData || []).forEach((d: any) => {
        if (d.customer_id) customerMap.set(d.id, d.customer_id);
      });

      // Fetch latest proposal per customer
      const customerIds = [...new Set(Array.from(customerMap.values()))];
      if (customerIds.length > 0) {
        const { data: propostas } = await supabase
          .from("propostas_nativas")
          .select("id, cliente_id, status, versao_atual")
          .in("cliente_id", customerIds)
          .order("created_at", { ascending: false });

        // Get economia from latest version
        const propostaIds = (propostas || []).map((p: any) => p.id);
        let economiaMap = new Map<string, number>();
        if (propostaIds.length > 0) {
          const { data: versoes } = await supabase
            .from("proposta_versoes")
            .select("proposta_id, economia_mensal")
            .in("proposta_id", propostaIds)
            .order("versao_numero", { ascending: false });
          (versoes || []).forEach((v: any) => {
            if (v.economia_mensal && !economiaMap.has(v.proposta_id)) {
              economiaMap.set(v.proposta_id, v.economia_mensal);
            }
          });
        }

        // Map best proposal per customer (latest)
        const bestPropostaByCustomer = new Map<string, { id: string; status: string; economia: number | null }>();
        (propostas || []).forEach((p: any) => {
          if (!bestPropostaByCustomer.has(p.cliente_id)) {
            bestPropostaByCustomer.set(p.cliente_id, {
              id: p.id,
              status: p.status,
              economia: economiaMap.get(p.id) || null,
            });
          }
        });

        // Enrich results
        results = results.map(d => {
          const custId = customerMap.get(d.deal_id);
          const proposta = custId ? bestPropostaByCustomer.get(custId) : null;
          return {
            ...d,
            customer_id: custId || null,
            proposta_id: proposta?.id || null,
            proposta_status: proposta?.status || null,
            proposta_economia_mensal: proposta?.economia || null,
          };
        });
      } else {
        results = results.map(d => ({ ...d, customer_id: customerMap.get(d.deal_id) || null }));
      }
    }

    return results;
  }, []);

  // ─── Full fetch ──────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const pipelinesData = await fetchMetadata();
      const enriched = await fetchDeals(filters);
      setDeals(enriched);

      if (pipelinesData.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(pipelinesData[0].id);
      }
    } catch (err: any) {
      console.error("useDealPipeline fetchAll:", err);
      toast({ title: "Erro ao carregar pipeline", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, selectedPipelineId, filters, fetchMetadata, fetchDeals]);

  useEffect(() => { fetchAll(); }, []);

  // ─── Apply filters ──────────────────────────────────
  const applyFilters = useCallback(async (newFilters: Partial<DealFilters>) => {
    const merged = { ...filters, ...newFilters };
    setFilters(merged);
    setLoading(true);
    try {
      const enriched = await fetchDeals(merged);
      setDeals(enriched);
    } catch (err: any) {
      console.error("useDealPipeline applyFilters:", err);
      toast({ title: "Erro ao filtrar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filters, fetchDeals, toast]);

  // ─── Pipeline CRUD ──────────────────────────────────
  const createPipeline = useCallback(async (name: string, templateStages?: { name: string; probability: number; is_closed?: boolean; is_won?: boolean }[]) => {
    const { data, error } = await supabase
      .from("pipelines")
      .insert({ name } as any)
      .select("id, tenant_id, name, version, is_active, created_at")
      .single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return null; }

    const pipeline = data as Pipeline;
    setPipelines(prev => [...prev, pipeline]);

    // Create stages from template or defaults
    const stagesDef = templateStages
      ? templateStages.map((s, i) => ({
          name: s.name,
          position: i,
          probability: s.probability,
          is_closed: s.is_closed || false,
          is_won: s.is_won || false,
          pipeline_id: pipeline.id,
        }))
      : [
          { name: "Novo", position: 0, probability: 10, pipeline_id: pipeline.id },
          { name: "Qualificação", position: 1, probability: 30, pipeline_id: pipeline.id },
          { name: "Proposta", position: 2, probability: 60, pipeline_id: pipeline.id },
          { name: "Negociação", position: 3, probability: 80, pipeline_id: pipeline.id },
          { name: "Ganho", position: 4, probability: 100, is_closed: true, is_won: true, pipeline_id: pipeline.id },
          { name: "Perdido", position: 5, probability: 0, is_closed: true, is_won: false, pipeline_id: pipeline.id },
        ];
    const { data: newStages, error: stErr } = await supabase
      .from("pipeline_stages")
      .insert(stagesDef as any)
      .select("id, tenant_id, pipeline_id, name, position, probability, is_closed, is_won");
    if (!stErr && newStages) {
      setStages(prev => [...prev, ...(newStages as PipelineStage[])]);
    }

    setSelectedPipelineId(pipeline.id);
    toast({ title: `Pipeline "${name}" criado` });
    return pipeline;
  }, [toast]);

  const renamePipeline = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from("pipelines").update({ name }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setPipelines(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  }, [toast]);

  const togglePipelineActive = useCallback(async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("pipelines").update({ is_active }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setPipelines(prev => prev.map(p => p.id === id ? { ...p, is_active } : p));
    if (!is_active && selectedPipelineId === id) {
      const next = pipelines.find(p => p.id !== id && p.is_active);
      if (next) setSelectedPipelineId(next.id);
    }
    toast({ title: is_active ? "Pipeline reativado" : "Pipeline desativado" });
  }, [toast, selectedPipelineId, pipelines]);

  const reorderPipelines = useCallback(async (orderedIds: string[]) => {
    // Pipelines don't have position column; skip reorder for now
  }, []);

  // ─── Stage CRUD ──────────────────────────────────────
  const createStage = useCallback(async (pipelineId: string, name: string, categoria?: string) => {
    const pipelineStages = stages.filter(s => s.pipeline_id === pipelineId);
    const position = pipelineStages.length;
    const is_closed = categoria === "ganho" || categoria === "perdido" || categoria === "excluido";
    const is_won = categoria === "ganho";
    const probability = categoria === "ganho" ? 100 : categoria === "perdido" || categoria === "excluido" ? 0 : 50;

    const { data, error } = await supabase
      .from("pipeline_stages")
      .insert({ pipeline_id: pipelineId, name, position, probability, is_closed, is_won } as any)
      .select("id, tenant_id, pipeline_id, name, position, probability, is_closed, is_won")
      .single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return null; }
    setStages(prev => [...prev, data as PipelineStage]);
    return data;
  }, [stages, toast]);

  const renameStage = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from("pipeline_stages").update({ name }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setStages(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  }, [toast]);

  const updateStageProbability = useCallback(async (id: string, probability: number) => {
    const { error } = await supabase.from("pipeline_stages").update({ probability }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setStages(prev => prev.map(s => s.id === id ? { ...s, probability } : s));
  }, [toast]);

  const reorderStages = useCallback(async (pipelineId: string, orderedIds: string[]) => {
    // Optimistic update
    setStages(prev => prev.map(s => {
      const idx = orderedIds.indexOf(s.id);
      return idx >= 0 ? { ...s, position: idx } : s;
    }));

    // Single RPC call (eliminates N+1)
    const { error } = await supabase.rpc("reorder_pipeline_stages", {
      _pipeline_id: pipelineId,
      _ordered_ids: orderedIds,
    });
    if (error) {
      toast({ title: "Erro ao reordenar", description: error.message, variant: "destructive" });
      fetchAll();
    }
  }, [toast, fetchAll]);

  const deleteStage = useCallback(async (id: string) => {
    const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setStages(prev => prev.filter(s => s.id !== id));
    toast({ title: "Etapa removida" });
  }, [toast]);

  // ─── Deal actions ─────────────────────────────────────
  const moveDealToStage = useCallback(async (dealId: string, stageId: string) => {
    // Optimistic update
    setDeals(prev => prev.map(d => d.deal_id === dealId ? { ...d, stage_id: stageId } : d));

    const { data, error } = await supabase.rpc("move_deal_to_stage", {
      _deal_id: dealId,
      _to_stage_id: stageId,
    });
    if (error) {
      toast({ title: "Erro ao mover deal", description: error.message, variant: "destructive" });
      fetchAll();
    }
  }, [toast, fetchAll]);

  const moveDealToOwner = useCallback(async (dealId: string, ownerId: string) => {
    const consultor = consultores.find(c => c.id === ownerId);
    // Optimistic update
    setDeals(prev => prev.map(d => d.deal_id === dealId
      ? { ...d, owner_id: ownerId, owner_name: consultor?.nome || "" }
      : d
    ));

    // Secure RPC with row locking + tenant validation
    const { error } = await supabase.rpc("move_deal_to_owner", {
      _deal_id: dealId,
      _to_owner_id: ownerId,
    });
    if (error) {
      toast({ title: "Erro ao mover deal", description: error.message, variant: "destructive" });
      fetchAll();
    }
  }, [toast, fetchAll, consultores]);

  // ─── Computed ──────────────────────────────────────────
  const selectedPipelineStages = useMemo(
    () => stages.filter(s => s.pipeline_id === selectedPipelineId).sort((a, b) => a.position - b.position),
    [stages, selectedPipelineId]
  );

  const ownerColumns = useMemo((): OwnerColumn[] => {
    const map = new Map<string, DealKanbanCard[]>();

    deals.forEach(d => {
      if (d.owner_id) {
        const arr = map.get(d.owner_id) || [];
        arr.push(d);
        map.set(d.owner_id, arr);
      }
    });

    return consultores
      .map(c => {
        const items = map.get(c.id) || [];
        return {
          id: c.id,
          nome: c.nome,
          deals: items,
          totalValor: items.reduce((sum, d) => sum + (d.deal_value || 0), 0),
          totalKwp: 0,
          count: items.length,
        };
      })
      .filter(c => c.count > 0)
      .sort((a, b) => b.totalValor - a.totalValor);
  }, [deals, consultores]);

  const consultoresFilter = useMemo(() => {
    return consultores.map(c => ({ id: c.id, nome: c.nome }));
  }, [consultores]);

  // ─── Create Deal ──────────────────────────────────────
  const createDeal = useCallback(async (params: {
    title: string;
    ownerId: string;
    pipelineId?: string;
    customerId?: string;
    value?: number;
    etiqueta?: string;
    notas?: string;
  }) => {
    const pipeId = params.pipelineId || selectedPipelineId || pipelines[0]?.id;
    if (!pipeId) {
      toast({ title: "Erro", description: "Nenhum funil disponível", variant: "destructive" });
      return null;
    }

    // Get first open stage of this pipeline
    const pipeStages = stages
      .filter(s => s.pipeline_id === pipeId && !s.is_closed)
      .sort((a, b) => a.position - b.position);
    const firstStage = pipeStages[0];
    if (!firstStage) {
      toast({ title: "Erro", description: "Funil sem etapas abertas", variant: "destructive" });
      return null;
    }

    const { data, error } = await supabase
      .from("deals")
      .insert({
        title: params.title,
        pipeline_id: pipeId,
        stage_id: firstStage.id,
        owner_id: params.ownerId,
        customer_id: params.customerId || null,
        value: params.value || 0,
        status: "open",
        etiqueta: params.etiqueta || null,
        notas: params.notas || null,
      } as any)
      .select("id")
      .single();

    if (error) {
      toast({ title: "Erro ao criar projeto", description: error.message, variant: "destructive" });
      return null;
    }

    toast({ title: "Projeto criado com sucesso!" });

    // Refresh deals
    try {
      const enriched = await fetchDeals(filters);
      setDeals(enriched);
    } catch {}

    return data;
  }, [selectedPipelineId, pipelines, stages, filters, fetchDeals, toast]);

  return {
    pipelines,
    stages,
    deals,
    consultores,
    loading,
    selectedPipelineId,
    setSelectedPipelineId,
    filters,
    applyFilters,
    selectedPipelineStages,
    ownerColumns,
    consultoresFilter,
    fetchAll,
    createPipeline,
    renamePipeline,
    togglePipelineActive,
    reorderPipelines,
    createStage,
    renameStage,
    updateStageProbability,
    reorderStages,
    deleteStage,
    moveDealToStage,
    moveDealToOwner,
    createDeal,
  };
}
