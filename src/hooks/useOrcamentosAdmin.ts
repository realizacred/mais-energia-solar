import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handleSupabaseError } from "@/lib/errorHandler";
import type { OrcamentoDisplayItem } from "@/types/orcamento";
import type { LeadStatus } from "@/types/lead";
import type { VendedorFilter } from "@/hooks/useLeads";

const PAGE_SIZE = 25;

// ⚠️ HARDENING: Explicit columns — never SELECT * on hot paths
const ORC_ADMIN_SELECT = `
  id, orc_code, lead_id, cep, estado, cidade, bairro, rua, numero, complemento,
  area, tipo_telhado, rede_atendimento, media_consumo, consumo_previsto,
  observacoes, arquivos_urls, consultor, consultor_id, visto, visto_admin,
  status_id, ultimo_contato, proxima_acao, data_proxima_acao, created_at, updated_at,
  leads!inner (
    id, lead_code, nome, telefone, telefone_normalized, email,
    consultor_id, consultor,
    consultores:consultor_id(id, nome)
  ),
  orc_consultores:consultor_id(id, nome)
`;

interface UseOrcamentosAdminOptions {
  autoFetch?: boolean;
  pageSize?: number;
}

export function useOrcamentosAdmin({ autoFetch = true, pageSize = PAGE_SIZE }: UseOrcamentosAdminOptions = {}) {
  const [orcamentos, setOrcamentos] = useState<OrcamentoDisplayItem[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const fetchOrcamentos = useCallback(async () => {
    try {
      setLoading(true);
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const [orcamentosRes, statusesRes] = await Promise.all([
        supabase
          .from("orcamentos")
          .select(ORC_ADMIN_SELECT, { count: "exact" })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
        supabase
          .from("lead_status")
          .select("id, nome, ordem, cor")
          .order("ordem"),
      ]);

      if (orcamentosRes.error) throw orcamentosRes.error;

      // Buscar projetos vinculados via cliente (telefone_normalized OU email).
      // Observação: projetos.lead_id está sempre NULL nesta base — o vínculo
      // canônico lead↔projeto acontece através de clientes (SSOT do cadastro).
      const leadsForLookup = (orcamentosRes.data || [])
        .map((o: any) => ({
          lead_id: o.lead_id as string | null,
          telefone_normalized: o.leads?.telefone_normalized as string | null,
          email: (o.leads?.email as string | null)?.toLowerCase() || null,
        }))
        .filter((l) => l.lead_id);

      const phones = Array.from(
        new Set(leadsForLookup.map((l) => l.telefone_normalized).filter(Boolean) as string[])
      );
      const emails = Array.from(
        new Set(leadsForLookup.map((l) => l.email).filter(Boolean) as string[])
      );

      const projetoByLead = new Map<string, string>();
      if (phones.length > 0 || emails.length > 0) {
        // 1) clientes que casam por telefone OU email
        const orParts: string[] = [];
        if (phones.length > 0) orParts.push(`telefone_normalized.in.(${phones.join(",")})`);
        if (emails.length > 0) {
          // emails podem conter vírgulas/aspas raramente — escapamos via quoting do PostgREST
          const safeEmails = emails.map((e) => `"${e.replace(/"/g, '\\"')}"`).join(",");
          orParts.push(`email.in.(${safeEmails})`);
        }
        const { data: clientesData } = await supabase
          .from("clientes")
          .select("id, telefone_normalized, email")
          .or(orParts.join(","));

        const clienteIds = (clientesData || []).map((c: any) => c.id);
        if (clienteIds.length > 0) {
          const { data: projsData } = await supabase
            .from("projetos")
            .select("id, cliente_id, created_at")
            .in("cliente_id", clienteIds)
            .order("created_at", { ascending: false });

          // cliente_id -> projeto mais recente
          const projetoByCliente = new Map<string, string>();
          for (const p of (projsData || []) as any[]) {
            if (p.cliente_id && !projetoByCliente.has(p.cliente_id)) {
              projetoByCliente.set(p.cliente_id, p.id);
            }
          }

          // Indexar clientes por telefone e email para casar com leads
          const clienteByPhone = new Map<string, string>();
          const clienteByEmail = new Map<string, string>();
          for (const c of (clientesData || []) as any[]) {
            if (c.telefone_normalized) clienteByPhone.set(c.telefone_normalized, c.id);
            if (c.email) clienteByEmail.set(String(c.email).toLowerCase(), c.id);
          }

          for (const l of leadsForLookup) {
            if (!l.lead_id) continue;
            const cid =
              (l.telefone_normalized && clienteByPhone.get(l.telefone_normalized)) ||
              (l.email && clienteByEmail.get(l.email)) ||
              null;
            const pid = cid ? projetoByCliente.get(cid) : null;
            if (pid) projetoByLead.set(l.lead_id, pid);
          }
        }
      }

      // Transform to flat display format
      const displayItems: OrcamentoDisplayItem[] = (orcamentosRes.data || []).map((orc: any) => {
        const leadVendedorNome = orc.orc_consultores?.nome || orc.leads?.consultores?.nome || orc.leads?.consultor || orc.consultor || null;
        const leadVendedorId = orc.consultor_id || orc.leads?.consultor_id || null;

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
          vendedor: orc.consultor, // keep text for backward compat
          vendedor_id: leadVendedorId,
          vendedor_nome: leadVendedorNome,
          status_id: orc.status_id,
          visto: orc.visto,
          visto_admin: orc.visto_admin,
          ultimo_contato: orc.ultimo_contato,
          proxima_acao: orc.proxima_acao,
          data_proxima_acao: orc.data_proxima_acao,
          created_at: orc.created_at,
          updated_at: orc.updated_at,
          projeto_id: orc.lead_id ? projetoByLead.get(orc.lead_id) ?? null : null,
        };
      });

      setOrcamentos(displayItems);
      setTotalCount(orcamentosRes.count || 0);
      
      if (statusesRes.data) {
        setStatuses(statusesRes.data);
      }
    } catch (error) {
      const appError = handleSupabaseError(error, "fetch_orcamentos");
      toast({
        title: "Erro",
        description: appError.userMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, page, pageSize]);

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
      const { error } = await supabase
        .from("orcamentos")
        .delete()
        .eq("id", orcamentoId);

      if (error) throw error;

      setOrcamentos((prev) => prev.filter((o) => o.id !== orcamentoId));
      setTotalCount((prev) => prev - 1);
      toast({
        title: "Orçamento excluído",
        description: "O orçamento foi excluído com sucesso.",
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

  // ⚠️ HARDENING: Realtime with debounce, local updates for UPDATE, no full refetch
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
          debounceTimer = setTimeout(() => fetchOrcamentos(), 500);
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
          // Lead name/phone/status changed — debounced refetch
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchOrcamentos(), 800);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [autoFetch, fetchOrcamentos]);

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
    },
    filters: {
      vendedores: uniqueVendedores,
      estados: estadosList,
    },
  };
}
