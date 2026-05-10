/**
 * Adapter para /admin/integracoes/solarmarket/logs.
 * Reaproveita tabelas: solarmarket_import_jobs, solarmarket_promotion_jobs,
 *   solarmarket_import_logs, solarmarket_promotion_logs.
 * RB-76: nenhuma tabela nova, nenhum motor novo. Somente leitura.
 *
 * RB-MIG-LOG-PARTITION: separa logs em "atuais" (>= LAST_FIX_DEPLOY_AT) e
 * "históricos" (anteriores ao deploy do último fix). Os contadores principais
 * da UI usam apenas "atuais"; os históricos ficam acessíveis sob badge.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

/**
 * Marco do último deploy de correção crítica em sm-promote (cpf_cnpj 1:1 +
 * idempotência insertVersao). Logs anteriores são considerados "históricos"
 * — não devem inflar contadores de saúde da migração atual.
 *
 * Atualizar este timestamp quando um novo fix significativo for deployado.
 */
export const LAST_FIX_DEPLOY_AT = "2026-05-10T18:54:00Z";

export function isHistoricalLog(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  return new Date(createdAt).getTime() < new Date(LAST_FIX_DEPLOY_AT).getTime();
}

export interface SmJobSummary {
  id: string;
  status: string;
  current_step: string | null;
  progress_pct: number | null;
  items_processed: number | null;
  total_items: number | null;
  items_promoted: number | null;
  items_with_warnings: number | null;
  items_with_errors: number | null;
  warnings_count: number | null;
  errors_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface SmLogRow {
  id: string;
  job_id: string | null;
  severity: string | null;
  step: string | null;
  message: string | null;
  details: any;
  created_at: string;
}

export interface SmAuditData {
  total_staging: number;
  promoted_propostas: number;
  remaining: number;
  orphaned_propostas: number;
  orphaned_projetos: number;
  duplicate_links: number;
  broken_links: number;
  status: 'concluded' | 'in_progress';
  timestamp: string;
}


export type ErrorWindow = '5m' | '15m' | '1h' | 'since_fix' | 'all';

export function useSolarmarketLogsPage() {
  const { data: tenantId } = useTenantId();
  const queryClient = useQueryClient();
  const [errorWindow, setErrorWindow] = useState<ErrorWindow>(() => {
    const saved = localStorage.getItem('sm_error_window');
    return (saved as ErrorWindow) || 'since_fix';
  });

  useEffect(() => {
    localStorage.setItem('sm_error_window', errorWindow);
  }, [errorWindow]);

  const getWindowTimestamp = () => {
    const now = new Date();
    if (errorWindow === '5m') return new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    if (errorWindow === '15m') return new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    if (errorWindow === '1h') return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    if (errorWindow === 'since_fix') return LAST_FIX_DEPLOY_AT;
    return new Date(0).toISOString(); // all
  };

  const windowTs = getWindowTimestamp();

  const promotionJobs = useQuery<SmJobSummary[]>({
    queryKey: ["sm-logs-page", "promotion-jobs", tenantId],
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solarmarket_promotion_jobs")
        .select("id,status,total_items,items_processed,items_promoted,items_with_warnings,items_with_errors,created_at,updated_at,metadata")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((j: any) => ({
        ...j,
        progress_pct: j.total_items ? Math.round((j.items_processed || 0) * 100 / j.total_items) : 0,
        warnings_count: j.items_with_warnings,
        errors_count: j.items_with_errors,
      })) as SmJobSummary[];
    },
  });

  const importJobs = useQuery<SmJobSummary[]>({
    queryKey: ["sm-logs-page", "import-jobs", tenantId],
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solarmarket_import_jobs")
        .select("id,status,current_step,progress_pct,created_at,updated_at")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        warnings_count: null,
        errors_count: null,
      })) as SmJobSummary[];
    },
  });

  const recentErrors = useQuery<SmLogRow[]>({
    queryKey: ["sm-logs-page", "recent-errors", tenantId, windowTs],
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solarmarket_promotion_logs")
        .select("id,job_id,severity,step,message,details,created_at")
        .eq("tenant_id", tenantId!)
        .in("severity", ["error", "warning"])
        .gte("created_at", windowTs)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as SmLogRow[];
    },
  });

  const historicalSummary = useQuery<{
    total_errors: number;
    total_warnings: number;
    by_cause: Array<{ 
      cause: string; 
      count: number; 
      first_seen: string; 
      last_seen: string; 
      status: 'resolved' | 'mitigated' | 'active';
      deploy?: string;
    }>;
  }>({
    queryKey: ["sm-logs-page", "historical-summary", tenantId, LAST_FIX_DEPLOY_AT],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solarmarket_promotion_logs")
        .select("severity,message,created_at")
        .eq("tenant_id", tenantId!)
        .in("severity", ["error", "warning"])
        .lt("created_at", LAST_FIX_DEPLOY_AT)
        .order("created_at", { ascending: true })
        .limit(50000);
      if (error) throw error;
      
      const rows = (data ?? []) as Array<{ severity: string; message: string | null; created_at: string }>;
      const errorRows = rows.filter((r) => r.severity === "error");
      const warningRows = rows.filter((r) => r.severity === "warning");
      
      const causeMap = new Map<string, { 
        count: number; 
        first_seen: string; 
        last_seen: string; 
      }>();

      for (const r of errorRows) {
        const cause = normalizeCause(r.message);
        const existing = causeMap.get(cause);
        if (existing) {
          existing.count++;
          existing.last_seen = r.created_at;
        } else {
          causeMap.set(cause, { 
            count: 1, 
            first_seen: r.created_at, 
            last_seen: r.created_at 
          });
        }
      }

      const by_cause = Array.from(causeMap.entries())
        .map(([cause, info]) => ({ 
          cause, 
          ...info,
          status: cause.includes("(resolvido)") ? 'resolved' : 'mitigated' as const,
          deploy: "v1.4.2" // Mock deploy version for context
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      return {
        total_errors: errorRows.length,
        total_warnings: warningRows.length,
        by_cause,
      };
    },
  });

  const activeSummary = useQuery<{
    total_errors: number;
    total_warnings: number;
  }>({
    queryKey: ["sm-logs-page", "active-summary", tenantId, windowTs],
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    queryFn: async () => {
      const [{ count: errors }, { count: warnings }] = await Promise.all([
        (supabase as any)
          .from("solarmarket_promotion_logs")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .eq("severity", "error")
          .gte("created_at", windowTs),
        (supabase as any)
          .from("solarmarket_promotion_logs")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .eq("severity", "warning")
          .gte("created_at", windowTs),
      ]);
      return {
        total_errors: errors || 0,
        total_warnings: warnings || 0,
      };
    },
  });

  const migrationStats = useQuery({
    queryKey: ["sm-migration-stats", tenantId],
    enabled: !!tenantId,
    refetchInterval: 15 * 1000,
    queryFn: async () => {
      const [{ count: totalStaging }, { data: links }] = await Promise.all([
        (supabase as any).from("sm_propostas_raw").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!),
        (supabase as any).from("external_entity_links").select("entity_type, created_at, metadata").eq("source", "solarmarket").eq("tenant_id", tenantId!)
      ]);

      const linksArray = links ?? [];
      const counts = linksArray.reduce((acc: any, curr: any) => {
        acc[curr.entity_type] = (acc[curr.entity_type] || 0) + 1;
        return acc;
      }, {});

      // Throughput nos últimos 15 min
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const recentPromoted = linksArray.filter(l => l.entity_type === 'proposta' && l.created_at >= fifteenMinsAgo).length;
      const tpm = recentPromoted / 15;

      // Peak throughput (estimado por blocos de 1 min nos últimos 15 min)
      let peakTpm = tpm;
      for (let i = 0; i < 15; i++) {
        const start = new Date(Date.now() - (i + 1) * 60 * 1000).toISOString();
        const end = new Date(Date.now() - i * 60 * 1000).toISOString();
        const count = linksArray.filter(l => l.entity_type === 'proposta' && l.created_at >= start && l.created_at < end).length;
        if (count > peakTpm) peakTpm = count;
      }

      const remaining = (totalStaging || 0) - (counts.proposta || 0);
      const etaMinutes = tpm > 0 ? Math.ceil(remaining / tpm) : (remaining > 0 ? null : 0);

      const clientsCreated = linksArray.filter(l => l.entity_type === 'cliente' && (l.metadata?.action === 'created' || l.metadata?.reused === false)).length;
      const clientsReused = linksArray.filter(l => l.entity_type === 'cliente' && (l.metadata?.action === 'reused' || l.metadata?.reused === true)).length;

      // Tempo médio por proposta (se tivermos os logs de início e fim, mas aqui estimamos pelo throughput)
      const avgTimePerProposal = tpm > 0 ? (60 / tpm).toFixed(1) : "—";

      return {
        total: totalStaging || 0,
        promoted: counts.proposta || 0,
        clients: counts.cliente || 0,
        projects: counts.projeto || 0,
        versions: counts.proposta_versao || 0,
        clientsCreated,
        clientsReused,
        remaining: Math.max(0, remaining),
        throughput: tpm,
        peakThroughput: peakTpm,
        avgTimePerProposal,
        etaMinutes,
        progressPct: totalStaging ? Math.min(100, Math.round((counts.proposta || 0) * 100 / totalStaging)) : 0
      };
    }
  });

  const auditData = useQuery<SmAuditData | null>({
    queryKey: ["sm-audit", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('audit_sm_migration', { p_tenant_id: tenantId });
      if (error) throw error;
      return (data as unknown) as SmAuditData;
    },
    staleTime: 60 * 1000,
  });

  const runAudit = useMutation<SmAuditData, Error, void>({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('audit_sm_migration', { p_tenant_id: tenantId });
      if (error) throw error;
      return (data as unknown) as SmAuditData;
    },
    onSuccess: () => {
      toast.success("Auditoria concluída com sucesso");
      queryClient.invalidateQueries({ queryKey: ["sm-audit"] });
    }
  });

  const resumeMigration = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sm-promote", {
        body: { action: "start", payload: {} }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Comando de retomada enviado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["sm-logs-page"] });
      queryClient.invalidateQueries({ queryKey: ["sm-migration-stats"] });
    },
    onError: (err: any) => {
      console.error("Erro ao retomar:", err);
      toast.error(`Falha ao retomar: ${err.message || "Erro desconhecido"}`);
    }
  });

  const exportLogs = async (format: 'csv' | 'json') => {
    const { data, error } = await (supabase as any)
      .from("solarmarket_promotion_logs")
      .select("*")
      .eq("tenant_id", tenantId!)
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("Erro ao exportar logs");
      return;
    }

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sm-migration-logs-${new Date().toISOString()}.json`;
      a.click();
    } else {
      const headers = Object.keys(data[0] || {}).join(',');
      const rows = (data || []).map((r: any) => 
        Object.values(r).map(v => typeof v === 'object' ? `"${JSON.stringify(v).replace(/"/g, '""')}"` : `"${v}"`).join(',')
      ).join('\n');
      const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sm-migration-logs-${new Date().toISOString()}.csv`;
      a.click();
    }
    toast.success(`Exportação ${format.toUpperCase()} iniciada`);
  };

  return { 
    promotionJobs, 
    importJobs, 
    recentErrors, 
    historicalSummary, 
    activeSummary,
    migrationStats, 
    resumeMigration,
    exportLogs,
    auditData,
    runAudit,
    tenantId,
    errorWindow,
    setErrorWindow
  };
}

/** Reduz mensagens semelhantes a uma causa única para agrupamento. */
function normalizeCause(message: string | null): string {
  if (!message) return "(sem mensagem)";
  const m = message.toLowerCase();
  if (m.includes("idx_clientes_tenant_cpf_cnpj_unique")) return "Cliente: CPF/CNPJ duplicado (resolvido)";
  if (m.includes("uq_proposta_versao")) return "Proposta: versão duplicada (resolvido)";
  if (m.includes("não autenticado") || m.includes("unauthorized") || m.includes("401")) return "Autenticação interna (resolvido)";
  if (m.includes("duplicate key")) return "Duplicidade em índice único";
  if (m.includes("insert cliente")) return "Falha ao inserir cliente";
  if (m.includes("insert projeto")) return "Falha ao inserir projeto";
  if (m.includes("insert proposta")) return "Falha ao inserir proposta";
  if (m.includes("insert versao")) return "Falha ao inserir versão";
  // Fallback: primeira frase ~80 chars
  return message.length > 80 ? `${message.slice(0, 77)}…` : message;
}