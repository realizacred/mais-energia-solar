import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { LeadStatus } from "@/types/lead";
import { toCanonicalPhoneDigits } from "@/utils/phone/toCanonicalPhoneDigits";

export interface OrcamentoVendedor {
  id: string;
  orc_code: string | null;
  lead_id: string;
  lead_code: string | null;
  nome: string;
  telefone: string;
  cep: string | null;
  estado: string;
  cidade: string;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  area: string;
  tipo_telhado: string;
  rede_atendimento: string;
  media_consumo: number;
  consumo_previsto: number;
  observacoes: string | null;
  arquivos_urls: string[];
  vendedor: string | null;
  vendedor_id: string | null;
  visto: boolean;
  visto_admin: boolean;
  status_id: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  created_at: string;
  updated_at: string;
}

interface UseOrcamentosVendedorOptions {
  vendedorId: string | null;
  vendedorNome: string | null;
  isAdminMode?: boolean;
  filterByVendedor?: boolean;
  // Phase 1: server-side filters (no client-side filtering over partial page)
  searchTerm?: string;
  filterVisto?: string;
  filterEstado?: string;
  filterStatus?: string;
}

const VENDEDOR_PAGE_SIZE = 25;

const ORC_SELECT = `
  id, orc_code, lead_id, cep, estado, cidade, bairro, rua, numero, complemento,
  area, tipo_telhado, rede_atendimento, media_consumo, consumo_previsto,
  observacoes, arquivos_urls, consultor, consultor_id, visto, visto_admin,
  status_id, ultimo_contato, proxima_acao, data_proxima_acao, created_at, updated_at,
  leads!inner (id, lead_code, nome, telefone, telefone_normalized)
`;

function mapRow(orc: any): OrcamentoVendedor {
  return {
    id: orc.id,
    orc_code: orc.orc_code,
    lead_id: orc.lead_id,
    lead_code: orc.leads?.lead_code || null,
    nome: orc.leads?.nome || "Desconhecido",
    telefone: orc.leads?.telefone || "",
    cep: orc.cep,
    estado: orc.estado,
    cidade: orc.cidade,
    bairro: orc.bairro,
    rua: orc.rua,
    numero: orc.numero,
    complemento: orc.complemento,
    area: orc.area,
    tipo_telhado: orc.tipo_telhado,
    rede_atendimento: orc.rede_atendimento,
    media_consumo: orc.media_consumo,
    consumo_previsto: orc.consumo_previsto,
    observacoes: orc.observacoes,
    arquivos_urls: orc.arquivos_urls || [],
    vendedor: orc.consultor,
    vendedor_id: orc.consultor_id || null,
    visto: orc.visto,
    visto_admin: orc.visto_admin,
    status_id: orc.status_id,
    ultimo_contato: orc.ultimo_contato,
    proxima_acao: orc.proxima_acao,
    data_proxima_acao: orc.data_proxima_acao,
    created_at: orc.created_at,
    updated_at: orc.updated_at,
  };
}

export function useOrcamentosVendedor({
  vendedorId,
  vendedorNome,
  isAdminMode = false,
  filterByVendedor = false,
  searchTerm = "",
  filterVisto = "todos",
  filterEstado = "todos",
  filterStatus = "todos",
}: UseOrcamentosVendedorOptions) {
  const [orcamentos, setOrcamentos] = useState<OrcamentoVendedor[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  // Phase 1 — must-filter mode: vendedor view (own portal OR admin viewing-as)
  const mustFilterByVendedor = (filterByVendedor || !isAdminMode) && (!!vendedorId || !!vendedorNome);

  const fetchOrcamentos = useCallback(async (append = false) => {
    if (!vendedorId && !vendedorNome && !isAdminMode) {
      setLoading(false);
      return;
    }

    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const from = append ? orcamentos.length : 0;
      const to = from + VENDEDOR_PAGE_SIZE - 1;

      // Build base query (server-side filters)
      const buildBase = () => {
        let q = supabase
          .from("orcamentos")
          .select(ORC_SELECT, { count: "exact" })
          .order("created_at", { ascending: false });

        if (filterVisto === "visto") q = q.eq("visto", true);
        else if (filterVisto === "nao_visto") q = q.eq("visto", false);

        if (filterEstado !== "todos") q = q.eq("estado", filterEstado);

        if (filterStatus === "novo") q = q.is("status_id", null);
        else if (filterStatus !== "todos") q = q.eq("status_id", filterStatus);

        return q;
      };

      // Server-side search: pre-resolve lead ids matching nome/telefone_normalized,
      // then OR with orc_code/cidade on orcamentos.
      let searchLeadIds: string[] | null = null;
      let searchActive = false;
      const term = (searchTerm || "").trim();
      if (term) {
        searchActive = true;
        const digits = toCanonicalPhoneDigits(term) || term.replace(/\D/g, "");
        const leadOr: string[] = [`nome.ilike.%${term}%`, `lead_code.ilike.%${term}%`];
        if (digits && digits.length >= 4) leadOr.push(`telefone_normalized.ilike.%${digits}%`);
        const { data: matchingLeads } = await supabase
          .from("leads")
          .select("id")
          .or(leadOr.join(","))
          .limit(500);
        searchLeadIds = (matchingLeads || []).map((l: any) => l.id);
      }

      const applySearch = (q: any) => {
        if (!searchActive) return q;
        const term2 = term;
        const orParts: string[] = [
          `orc_code.ilike.%${term2}%`,
          `cidade.ilike.%${term2}%`,
        ];
        if (searchLeadIds && searchLeadIds.length > 0) {
          orParts.push(`lead_id.in.(${searchLeadIds.join(",")})`);
        }
        return q.or(orParts.join(","));
      };

      // Phase 1 — ownership SSOT: consultor_id (FK) is primary.
      // Legacy fallback (consultor_id IS NULL AND consultor = nome) runs as a
      // SEPARATE safe query to avoid PostgREST .or injection with names that
      // may contain commas/quotes/parens.
      let primaryRows: any[] = [];
      let primaryCount = 0;
      let legacyRows: any[] = [];

      if (mustFilterByVendedor) {
        // Primary: FK
        if (vendedorId) {
          const q1 = applySearch(buildBase().eq("consultor_id", vendedorId)).range(from, to);
          const r1 = await q1;
          if (r1.error) throw r1.error;
          primaryRows = r1.data || [];
          primaryCount = r1.count || 0;
        }

        // Legacy fallback: only on first page, only if a nome is available.
        // Two-query merge by id (no .or with raw nome → injection-safe).
        if (!append && vendedorNome) {
          const q2 = applySearch(
            buildBase()
              .is("consultor_id", null)
              .eq("consultor", vendedorNome)
          ).limit(100);
          const r2 = await q2;
          if (!r2.error && r2.data && r2.data.length > 0) {
            legacyRows = r2.data;
            console.warn(
              `[useOrcamentosVendedor] LEGACY ownership fallback hit: ${legacyRows.length} orcamento(s) com consultor_id NULL e consultor='${vendedorNome}'. Considere backfill consultor_id (Fase 4).`
            );
          }
        }
      } else {
        // Admin mode without vendor filter
        const q1 = applySearch(buildBase()).range(from, to);
        const r1 = await q1;
        if (r1.error) throw r1.error;
        primaryRows = r1.data || [];
        primaryCount = r1.count || 0;
      }

      // Merge primary + legacy by id (legacy first page only)
      const seen = new Set<string>();
      const mergedRaw: any[] = [];
      for (const row of [...legacyRows, ...primaryRows]) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          mergedRaw.push(row);
        }
      }
      // Re-sort by created_at desc to keep ordering deterministic
      mergedRaw.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      const newData = mergedRaw.map(mapRow);
      const totalForCount = primaryCount + (append ? 0 : legacyRows.length);
      setTotalCount(totalForCount);

      if (append) {
        setOrcamentos(prev => [...prev, ...newData]);
        setHasMore(orcamentos.length + newData.length < totalForCount);
      } else {
        setOrcamentos(newData);
        setHasMore(newData.length < totalForCount);
      }

      // Statuses (only initial load)
      if (!append) {
        const statusesRes = await supabase
          .from("lead_status")
          .select("id, nome, ordem, cor")
          .order("ordem");
        if (statusesRes.data) setStatuses(statusesRes.data);
      }
    } catch (error) {
      console.error("Erro ao buscar orçamentos do vendedor:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os orçamentos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [
    vendedorId, vendedorNome, isAdminMode, mustFilterByVendedor,
    searchTerm, filterVisto, filterEstado, filterStatus,
    orcamentos.length, toast,
  ]);

  const toggleVisto = useCallback(async (orcamento: OrcamentoVendedor) => {
    const newVisto = !orcamento.visto;
    setOrcamentos((prev) =>
      prev.map((o) => (o.id === orcamento.id ? { ...o, visto: newVisto } : o))
    );
    try {
      const { error } = await supabase
        .from("orcamentos")
        .update({ visto: newVisto })
        .eq("id", orcamento.id);
      if (error) throw error;
    } catch (error) {
      console.error("Erro ao atualizar visto:", error);
      setOrcamentos((prev) =>
        prev.map((o) => (o.id === orcamento.id ? { ...o, visto: orcamento.visto } : o))
      );
      toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" });
    }
  }, [toast]);

  const updateStatus = useCallback(async (orcamentoId: string, newStatusId: string | null) => {
    setOrcamentos((prev) =>
      prev.map((o) =>
        o.id === orcamentoId
          ? { ...o, status_id: newStatusId, ultimo_contato: new Date().toISOString() }
          : o
      )
    );
    try {
      const { error } = await supabase
        .from("orcamentos")
        .update({ status_id: newStatusId, ultimo_contato: new Date().toISOString() })
        .eq("id", orcamentoId);
      if (error) throw error;
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" });
    }
  }, [toast]);

  const deleteOrcamento = useCallback(async (orcamentoId: string) => {
    try {
      const { error } = await supabase.from("orcamentos").delete().eq("id", orcamentoId);
      if (error) throw error;
      setOrcamentos((prev) => prev.filter((o) => o.id !== orcamentoId));
      toast({ title: "Orçamento excluído", description: "O orçamento foi excluído com sucesso." });
      return true;
    } catch (error) {
      console.error("Erro ao excluir orçamento:", error);
      toast({ title: "Erro", description: "Não foi possível excluir o orçamento.", variant: "destructive" });
      return false;
    }
  }, [toast]);

  useEffect(() => {
    fetchOrcamentos();
  }, [fetchOrcamentos]);

  // Phase 1 — Realtime stabilized via ref so the channel is NOT recreated on
  // every filter/search keystroke. Channel name uses vendedorId (stable) instead
  // of mutable nome.
  const fetchRef = useRef(fetchOrcamentos);
  useEffect(() => {
    fetchRef.current = fetchOrcamentos;
  }, [fetchOrcamentos]);

  useEffect(() => {
    if (!vendedorId && !vendedorNome && !isAdminMode) return;
    const channelKey = vendedorId || (isAdminMode ? "admin" : "anon");
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`orcamentos-vendedor-${channelKey}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orcamentos' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchRef.current(), 500);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orcamentos' },
        (payload) => {
          if (payload.new) {
            const updated = payload.new as any;
            setOrcamentos((prev) =>
              prev.map((o) =>
                o.id === updated.id
                  ? {
                      ...o,
                      visto: updated.visto,
                      visto_admin: updated.visto_admin,
                      status_id: updated.status_id,
                      ultimo_contato: updated.ultimo_contato,
                      proxima_acao: updated.proxima_acao,
                      data_proxima_acao: updated.data_proxima_acao,
                    }
                  : o
              )
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orcamentos' },
        (payload) => {
          if (payload.old) {
            const deletedId = (payload.old as any).id;
            setOrcamentos(prev => prev.filter(o => o.id !== deletedId));
            setTotalCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchRef.current(), 800);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
    // Channel lifecycle depends ONLY on identity, not on filters/search.
  }, [vendedorId, vendedorNome, isAdminMode]);

  const stats = {
    total: orcamentos.length,
    novos: orcamentos.filter((o) => !o.visto).length,
    esteMes: orcamentos.filter((o) => {
      const date = new Date(o.created_at);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length,
  };

  const estados = [...new Set(orcamentos.map((o) => o.estado).filter(Boolean))].sort();

  return {
    orcamentos,
    statuses,
    stats,
    estados,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    fetchOrcamentos,
    loadMore: () => fetchOrcamentos(true),
    toggleVisto,
    updateStatus,
    deleteOrcamento,
  };
}
