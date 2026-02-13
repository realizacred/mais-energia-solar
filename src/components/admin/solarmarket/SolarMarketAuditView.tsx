import { useState, useEffect } from "react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { supabase } from "@/integrations/supabase/client";
import { SyncProgressTracker } from "./SyncProgressTracker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui-kit";
import {
  Users, FolderOpen, FileText, RefreshCw,
  CheckCircle2, XCircle, Clock, AlertTriangle,
  Filter, Layers, UserCheck, GitBranch
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SyncLog {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  error: string | null;
  counts: Record<string, unknown> | null;
  triggered_by: string | null;
  source: string | null;
  mode: string | null;
}

interface FailedItem {
  id: string;
  entity_type: string;
  entity_id: string;
  error_message: string;
  created_at: string;
}

interface AuditCounts {
  clients: number;
  projects: number;
  proposals: number;
  users: number;
  funnels: number;
  custom_fields: number;
  failed_items: number;
  webhook_events: number;
}

export function SolarMarketAuditView() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<AuditCounts | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const [
        clientsRes,
        projectsRes,
        proposalsRes,
        usersRes,
        funnelsRes,
        customFieldsRes,
        failedRes,
        webhookRes,
        logsRes,
        failedItemsRes,
      ] = await Promise.all([
        supabase.from("solar_market_clients").select("*", { count: "exact", head: true }),
        supabase.from("solar_market_projects").select("*", { count: "exact", head: true }),
        supabase.from("solar_market_proposals").select("*", { count: "exact", head: true }),
        supabase.from("solar_market_users").select("*", { count: "exact", head: true }),
        supabase.from("solar_market_funnels").select("*", { count: "exact", head: true }),
        supabase.from("solar_market_custom_fields").select("*", { count: "exact", head: true }),
        supabase.from("solar_market_sync_items_failed").select("*", { count: "exact", head: true }),
        supabase.from("solar_market_webhook_events").select("*", { count: "exact", head: true }),
        supabase.from("solar_market_sync_logs").select("*").order("started_at", { ascending: false }).limit(10),
        supabase.from("solar_market_sync_items_failed").select("*").order("created_at", { ascending: false }).limit(20),
      ]);

      setCounts({
        clients: clientsRes.count || 0,
        projects: projectsRes.count || 0,
        proposals: proposalsRes.count || 0,
        users: usersRes.count || 0,
        funnels: funnelsRes.count || 0,
        custom_fields: customFieldsRes.count || 0,
        failed_items: failedRes.count || 0,
        webhook_events: webhookRes.count || 0,
      });

      setSyncLogs((logsRes.data as unknown as SyncLog[]) || []);
      setFailedItems((failedItemsRes.data as unknown as FailedItem[]) || []);
    } catch (err) {
      console.error("Error fetching audit data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "running": return <Spinner size="sm" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "completed": return "Concluído";
      case "running": return "Em andamento";
      case "failed": return "Falhou";
      default: return status;
    }
  };

  const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed": return "default";
      case "running": return "secondary";
      case "failed": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Sync Progress */}
      <SyncProgressTracker />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Auditoria da Sincronização</h3>
          <p className="text-sm text-muted-foreground">
            Relatório completo dos dados extraídos do SolarMarket.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAudit} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Counters Grid */}
      {counts && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Clientes" value={counts.clients.toLocaleString("pt-BR")} color="primary" />
          <StatCard icon={FolderOpen} label="Projetos" value={counts.projects.toLocaleString("pt-BR")} color="info" />
          <StatCard icon={FileText} label="Propostas" value={counts.proposals.toLocaleString("pt-BR")} color="success" />
          <StatCard icon={UserCheck} label="Usuários" value={counts.users.toLocaleString("pt-BR")} color="secondary" />
          <StatCard icon={Filter} label="Funis" value={counts.funnels.toLocaleString("pt-BR")} color="warning" />
          <StatCard icon={Layers} label="Campos Custom" value={counts.custom_fields.toLocaleString("pt-BR")} color="muted" />
          <StatCard icon={GitBranch} label="Webhooks" value={counts.webhook_events.toLocaleString("pt-BR")} color="info" />
          <StatCard
            icon={AlertTriangle}
            label="Itens com Falha"
            value={counts.failed_items.toLocaleString("pt-BR")}
            color={counts.failed_items > 0 ? "destructive" : "success"}
          />
        </div>
      )}

      {/* Sync Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-primary" />
            Histórico de Sincronizações
          </CardTitle>
          <CardDescription>Últimas 10 execuções de sync registradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {syncLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma sincronização registrada ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {syncLogs.map((log) => {
                const c = (log.counts || {}) as Record<string, number | unknown[]>;
                return (
                  <div key={log.id} className="flex flex-col gap-2 p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {statusIcon(log.status)}
                        <Badge variant={statusVariant(log.status)}>{statusLabel(log.status)}</Badge>
                        {log.mode && (
                          <Badge variant="outline" className="text-[10px]">
                            {log.mode === "full" ? "Completa" : "Delta"}
                          </Badge>
                        )}
                        {log.source && (
                          <Badge variant="outline" className="text-[10px]">
                            {log.source}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.started_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </span>
                    </div>

                    {/* Counts breakdown */}
                    {Object.keys(c).length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {typeof c.clients_synced === "number" && c.clients_synced > 0 && (
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {c.clients_synced} clientes
                          </span>
                        )}
                        {typeof c.projects_synced === "number" && c.projects_synced > 0 && (
                          <span className="px-2 py-0.5 rounded bg-info/10 text-info">
                            {c.projects_synced} projetos
                          </span>
                        )}
                        {typeof c.proposals_synced === "number" && c.proposals_synced > 0 && (
                          <span className="px-2 py-0.5 rounded bg-success/10 text-success">
                            {c.proposals_synced} propostas
                          </span>
                        )}
                        {typeof c.users_synced === "number" && c.users_synced > 0 && (
                          <span className="px-2 py-0.5 rounded bg-secondary/10 text-secondary">
                            {c.users_synced} usuários
                          </span>
                        )}
                        {typeof c.funnels_synced === "number" && c.funnels_synced > 0 && (
                          <span className="px-2 py-0.5 rounded bg-warning/10 text-warning">
                            {c.funnels_synced} funis
                          </span>
                        )}
                        {typeof c.custom_fields_synced === "number" && c.custom_fields_synced > 0 && (
                          <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {c.custom_fields_synced} campos
                          </span>
                        )}
                        {typeof c.leads_linked === "number" && c.leads_linked > 0 && (
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {c.leads_linked} leads vinculados
                          </span>
                        )}
                        {Array.isArray(c.errors) && c.errors.length > 0 && (
                          <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                            {c.errors.length} erros
                          </span>
                        )}
                      </div>
                    )}

                    {log.error && (
                      <p className="text-xs text-destructive bg-destructive/5 rounded p-2 mt-1">
                        {log.error}
                      </p>
                    )}

                    {log.finished_at && (
                      <p className="text-[10px] text-muted-foreground">
                        Finalizado: {format(new Date(log.finished_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failed Items */}
      {failedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Itens com Falha ({failedItems.length})
            </CardTitle>
            <CardDescription>Itens que falharam durante a sincronização.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {failedItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-destructive/5 border-destructive/20">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{item.entity_type}</Badge>
                      <span className="text-xs font-mono text-muted-foreground">ID: {item.entity_id}</span>
                    </div>
                    <p className="text-xs text-destructive break-all">{item.error_message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
