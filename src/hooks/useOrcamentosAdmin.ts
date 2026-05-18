import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handleSupabaseError } from "@/lib/errorHandler";
import type { OrcamentoDisplayItem } from "@/types/orcamento";
import type { LeadStatus } from "@/types/lead";
import type { VendedorFilter } from "@/hooks/useLeads";
import { normalizeBrazilianPhone } from "@/utils/phone/normalizeBrazilianPhone";
import { toCanonicalPhoneDigits } from "@/utils/phone/toCanonicalPhoneDigits";

const PAGE_SIZE = 25;

// ⚠️ HARDENING: Use the new commercial view for advanced filtering and counts
const ORC_ADMIN_SELECT = `
  id, orc_code, lead_id, cep, estado, cidade, bairro, rua, numero, complemento,
  area, tipo_telhado, rede_atendimento, media_consumo, consumo_previsto,
  observacoes, arquivos_urls, consultor, consultor_id, visto, visto_admin,
  status_id, ultimo_contato, proxima_acao, data_proxima_acao, created_at, updated_at,
  leads!inner (id, lead_code, nome, telefone, telefone_normalized, email)
`;

export interface ConversionStats {
  total: number;
  sem_proposta: number;
  com_proposta: number;
  sem_projeto: number;
  convertidos: number;
  perdidos: number;
  novos_mes: number;
}

interface UseOrcamentosAdminOptions {
  autoFetch?: boolean;
  pageSize?: number;
  searchTerm?: string;
  filterVisto?: string;
  filterVendedor?: string;
  filterEstado?: string;
  filterStatus?: string;
  filterConversao?: string;
}

export function useOrcamentosAdmin({ 
  autoFetch = true, 
  pageSize = PAGE_SIZE,
  searchTerm = "",
  filterVisto = "todos",
  filterVendedor = "todos",
  filterEstado = "todos",
  filterStatus = "todos",
  filterConversao = "todos"
}: UseOrcamentosAdminOptions = {}) {
  const [orcamentos, setOrcamentos] = useState<OrcamentoDisplayItem[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ConversionStats | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const fetchOrcamentos = useCallback(async () => {
    try {
      setLoading(true);
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const { data: tenantId } = await supabase.rpc("get_user_tenant_id");

      let query = supabase
        .from("orcamentos")
        .select(ORC_ADMIN_SELECT, { count: "exact" });

      // Apply standard filters
      // Phase 1: search uses telefone_normalized (canonical digits) + cidade.
      if (searchTerm) {
        const term = searchTerm.trim();
        const digits = toCanonicalPhoneDigits(term) || term.replace(/\D/g, "");
        const leadOr: string[] = [
          `nome.ilike.%${term}%`,
          `lead_code.ilike.%${term}%`,
          `email.ilike.%${term}%`,
        ];
        if (digits && digits.length >= 4) {
          leadOr.push(`telefone_normalized.ilike.%${digits}%`);
        }
        const { data: matchingLeads } = await supabase
          .from("leads")
          .select("id")
          .or(leadOr.join(","))
          .limit(500);
        const leadIds = (matchingLeads || []).map((lead) => lead.id);
        const orcOr: string[] = [
          `orc_code.ilike.%${term}%`,
          `cidade.ilike.%${term}%`,
        ];
        if (leadIds.length > 0) orcOr.push(`lead_id.in.(${leadIds.join(",")})`);
        query = query.or(orcOr.join(","));
      }

      if (filterVisto === "visto") {
        query = query.eq("visto_admin", true);
      } else if (filterVisto === "nao_visto") {
        query = query.eq("visto_admin", false);
      }

      if (filterVendedor === "sem_vendedor") {
        query = query.is("consultor_id", null);
      } else if (filterVendedor !== "todos") {
        query = query.eq("consultor_id", filterVendedor);
      }

      if (filterEstado !== "todos") {
        query = query.eq("estado", filterEstado);
      }

      if (filterStatus !== "todos") {
        query = query.eq("status_id", filterStatus);
      }

      // ⚠️ Conversion pre-filter: derive eligible orcamento ids from the
      // commercial view (proposal_count/project_count/lead_status_nome are
      // canonical there) and constrain the main query before pagination.
      // HARDENING: isolated try/catch — failure here must NOT break the
      // main listing nor trigger a generic error toast.
      if (filterConversao !== "todos" && tenantId) {
        try {
          let viewQ = supabase
            .from("vw_orcamentos_comercial")
            .select("id")
            .eq("tenant_id", tenantId);

          if (filterConversao === "sem_proposta" || filterConversao === "sem_projeto") {
            // Semântica alinhada ao ícone de pasta: lead sem projeto vinculado
            // NULL-safe: lead_status_nome != 'Perdido' OR lead_status_nome IS NULL
            viewQ = viewQ
              .is("matched_projeto_id", null)
              .or("lead_status_nome.is.null,lead_status_nome.not.eq.Perdido");
          } else if (filterConversao === "com_proposta" || filterConversao === "convertidos") {
            viewQ = viewQ.not("matched_projeto_id", "is", null);
          } else if (filterConversao === "perdidos") {
            viewQ = viewQ.eq("lead_status_nome", "Perdido");
          }

          const { data: idsRows, error: idsErr } = await viewQ.limit(5000);
          if (idsErr) throw idsErr;
          const ids = (idsRows || []).map((r: any) => r.id);
          // Use a sentinel UUID when empty to force zero rows without breaking the query
          query = query.in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
        } catch (convErr) {
          // Non-blocking: log and proceed with unfiltered listing
          console.warn("[useOrcamentosAdmin] conversion pre-filter failed (non-blocking):", convErr);
        }
      }

      // ⚠️ HARDENING: Separate stats fetch from main query to avoid global failure
      let statsRes: { data: any; error: any } = { data: null, error: null };
      
      if (tenantId) try {
        const statsPromise = supabase.rpc("get_orcamentos_comercial_stats", {
          p_tenant_id: tenantId,
          p_search: searchTerm,
          p_vendedor_id: filterVendedor !== "todos" && filterVendedor !== "sem_vendedor" ? filterVendedor : null,
          p_status_id: filterStatus !== "todos" ? filterStatus : null,
          p_estado: filterEstado
        });

        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            console.warn("RPC get_orcamentos_comercial_stats timed out after 8s");
            resolve({ data: null, error: null });
          }, 8000);
        });

        statsRes = await Promise.race([statsPromise, timeoutPromise]) as any;
        if (statsRes.error) {
          console.error("Stats fetch error (non-blocking):", statsRes.error);
        }
      } catch (statsErr) {
        console.error("Stats catch error (non-blocking):", statsErr);
      }

      const [orcamentosRes, statusesRes] = await Promise.all([
        query
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
        supabase
          .from("lead_status")
          .select("id, nome, ordem, cor")
          .order("ordem")
      ]);

      if (orcamentosRes.error) throw orcamentosRes.error;

      // ⚠️ Enrich with derived fields (projeto_id, proposta count) from the
      // commercial view — only for the page rows. Cheap (≤25 ids), no count.
      const pageRows = orcamentosRes.data || [];
      const pageIds = pageRows.map((o: any) => o.id);
      const enrichMap = new Map<string, { projeto_id: string | null; tem_proposta: boolean }>();
      if (pageIds.length > 0) {
        const { data: enrichRows, error: enrichErr } = await supabase
          .from("vw_orcamentos_comercial")
          .select("id, matched_projeto_id, proposal_count")
          .in("id", pageIds);
        if (enrichErr) {
          console.warn("[useOrcamentosAdmin] enrich failed (non-blocking):", enrichErr.message);
        }
        for (const r of (enrichRows || []) as any[]) {
          enrichMap.set(r.id, {
            projeto_id: r.matched_projeto_id ?? null,
            // NOTE: tem_proposta controla apenas a COR do ícone (verde/vermelho).
            // Semanticamente = "cliente matchado tem alguma proposta", NÃO
            // "este projeto tem proposta". A existência do ícone é gated por
            // projeto_id (matched_projeto_id), alinhado aos contadores.
            tem_proposta: (r.proposal_count ?? 0) > 0,
          });
        }
      }

      // Transform to flat display format
      const displayItems: OrcamentoDisplayItem[] = pageRows.map((orc: any) => {
        const enr = enrichMap.get(orc.id);
        return {
          id: orc.id,
          orc_code: orc.orc_code,
          lead_id: orc.lead_id,
          lead_code: orc.leads?.lead_code || null,
          nome: orc.leads?.nome || "",
          telefone: orc.leads?.telefone || "",
          email: orc.leads?.email || null,
          cep: orc.cep,
          estado: orc.estado,
          cidade: orc.cidade,
          bairro: orc.bairro,
          rua: orc.rua,
          numero: orc.numero,
          complemento: orc.complemento || null,
          area: orc.area,
          tipo_telhado: orc.tipo_telhado,
          rede_atendimento: orc.rede_atendimento,
          media_consumo: orc.media_consumo,
          consumo_previsto: orc.consumo_previsto,
          arquivos_urls: orc.arquivos_urls,
          observacoes: orc.observacoes,
          vendedor: orc.consultor,
          vendedor_id: orc.consultor_id,
          vendedor_nome: orc.consultor || null,
          status_id: orc.status_id,
          visto: orc.visto,
          visto_admin: orc.visto_admin,
          ultimo_contato: orc.ultimo_contato,
          proxima_acao: orc.proxima_acao,
          data_proxima_acao: orc.data_proxima_acao,
          created_at: orc.created_at,
          updated_at: orc.updated_at,
          projeto_id: enr?.projeto_id ?? null,
          projeto_tem_proposta: enr?.tem_proposta ?? false,
        };
      });

      // Phase 1 — telemetry: warn legacy ownership rows (FK NULL but consultor text set)
      const legacyCount = displayItems.filter(o => !o.vendedor_id && o.vendedor).length;
      if (legacyCount > 0) {
        console.warn(
          `[useOrcamentosAdmin] LEGACY ownership: ${legacyCount}/${displayItems.length} orçamento(s) com consultor_id NULL e consultor texto preenchido. Considere backfill (Fase 4).`
        );
      }

      setOrcamentos(displayItems);
      setTotalCount(orcamentosRes.count || 0);
      setStats(statsRes?.data as unknown as ConversionStats || null);
      
      if (statusesRes.data) {
        setStatuses(statusesRes.data);
      }
    } catch (error) {
      console.error("Full fetch_orcamentos error:", error);
      const appError = handleSupabaseError(error, "fetch_orcamentos");
      toast({
        title: "Erro",
        description: appError.userMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, page, pageSize, searchTerm, filterVisto, filterVendedor, filterEstado, filterStatus, filterConversao]);

  const toggleVisto = useCallback(async (orcamento: OrcamentoDisplayItem) => {
    const newVisto = !orcamento.visto_admin;
    
    setOrcamentos((prev) =>
      prev.map((o) => (o.id === orcamento.id ? { ...o, visto_admin: newVisto } : o))
    );
    
    try {
      const { error } = await supabase
        .from("orcamentos")
        .update({ visto_admin: newVisto })
        .eq("id", orcamento.id);
        
      if (error) throw error;
    } catch (error) {
      const appError = handleSupabaseError(error, "toggle_visto_orcamento", { entityId: orcamento.id });
      setOrcamentos((prev) =>
        prev.map((o) => (o.id === orcamento.id ? { ...o, visto_admin: orcamento.visto_admin } : o))
      );
      toast({
        title: "Erro",
        description: appError.userMessage,
        variant: "destructive",
      });
    }
  }, [toast]);

  const deleteOrcamento = useCallback(async (orcamentoId: string) => {
    try {
      // Busca o lead pai
      const { data: orc, error: orcErr } = await supabase
        .from("orcamentos")
        .select("lead_id, leads(nome)")
        .eq("id", orcamentoId)
        .maybeSingle();
      if (orcErr) throw orcErr;

      if (!orc?.lead_id) {
        throw new Error("Lead não encontrado");
      }

      const { data, error } = await supabase.rpc("archive_lead", { p_lead_id: orc.lead_id });
      if (error) throw error;
      
      const res = data as any;
      if (res && res.success === false) {
        toast({
          title: "Não é possível arquivar",
          description: res.error || "Este lead possui vínculos que impedem o arquivamento.",
          variant: "destructive",
        });
        return false;
      }

      setOrcamentos((prev) => prev.filter((o) => o.id !== orcamentoId));
      setTotalCount((prev) => prev - 1);
      toast({
        title: "Lead arquivado",
        description: `O lead ${orc.leads?.nome || ""} foi arquivado com sucesso.`,
      });
      return true;
    } catch (error) {
      const appError = handleSupabaseError(error, "delete_orcamento", { entityId: orcamentoId });
      toast({
        title: "Erro",
        description: appError.userMessage,
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  useEffect(() => {
    if (autoFetch) {
      fetchOrcamentos();
    }
  }, [autoFetch, fetchOrcamentos]);

  // Phase 1 — Realtime stabilized via ref so the channel is NOT recreated on
  // every filter/search keystroke (deps no longer include fetchOrcamentos).
  const fetchRef = useRef(fetchOrcamentos);
  useEffect(() => {
    fetchRef.current = fetchOrcamentos;
  }, [fetchOrcamentos]);

  useEffect(() => {
    if (!autoFetch) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('orcamentos-admin-changes')
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
            setOrcamentos(prev => prev.map(o =>
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
            ));
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
    // Channel lifecycle depends ONLY on autoFetch — not on filters/search.
  }, [autoFetch]);

  // Computed values — filter by vendedor_id
  const totalKwh = orcamentos.reduce((acc, o) => acc + o.media_consumo, 0);
  const uniqueEstados = new Set(orcamentos.map((o) => o.estado)).size;

  const vendedorFilterMap = new Map<string, string>();
  orcamentos.forEach((o) => {
    if (o.vendedor_id && o.vendedor_nome) {
      vendedorFilterMap.set(o.vendedor_id, o.vendedor_nome);
    }
  });
  const uniqueVendedores: VendedorFilter[] = Array.from(vendedorFilterMap.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const estadosList = [...new Set(orcamentos.map((o) => o.estado))].sort();

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    orcamentos,
    statuses,
    loading,
    fetchOrcamentos,
    toggleVisto,
    deleteOrcamento,
    page,
    setPage,
    totalCount,
    totalPages,
    pageSize,
    stats: {
      total: totalCount,
      totalKwh,
      uniqueEstados,
      conversion: stats,
    },
    filters: {
      vendedores: uniqueVendedores,
      estados: estadosList,
    },
  };
}
