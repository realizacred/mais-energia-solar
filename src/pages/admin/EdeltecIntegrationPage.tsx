/**
 * EdeltecIntegrationPage — Tela admin de integração Edeltec.
 * §16: Queries só em hooks. RB-04/05. §26: Header padrão. §27: KPI cards.
 */
import { useState } from "react";
import { Plug, Package, Warehouse, Clock, ShoppingCart, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEdeltecSyncStatus, useEdeltecSyncLogs } from "@/hooks/integrations/useEdeltecSyncStatus";
import { useEdeltecCatalogStats } from "@/hooks/integrations/useEdeltecCatalog";
import { useEdeltecSync } from "@/hooks/useEdeltecSync";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function formatDateBrasilia(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const statusVariantMap: Record<string, "success" | "warning" | "destructive" | "muted" | "info"> = {
  completed: "success",
  running: "warning",
  error: "destructive",
  idle: "muted",
};

function useTenantId() {
  return useQuery({
    queryKey: ["current-tenant-id"],
    queryFn: async () => {
      const { tenantId } = await getCurrentTenantId();
      return tenantId;
    },
    staleTime: 1000 * 60 * 15,
  });
}

export default function EdeltecIntegrationPage() {
  const { data: tenantId } = useTenantId();

  const { data: syncState, isLoading: loadingSync } = useEdeltecSyncStatus(tenantId);
  const { data: stats, isLoading: loadingStats } = useEdeltecCatalogStats();
  const { data: logs, isLoading: loadingLogs } = useEdeltecSyncLogs(tenantId, 30);
  const syncMutation = useEdeltecSync();

  const [showFullReplace, setShowFullReplace] = useState(false);

  // Fetch api_config_id for tenant
  const { data: apiConfig } = useQuery({
    queryKey: ["edeltec-api-config", tenantId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("integrations_api_config")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("provider", "edeltec")
        .eq("ativo", true)
        .maybeSingle();
      return data as { id: string } | null;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!tenantId,
  });

  const handleSync = (mode: "incremental" | "full_replace") => {
    if (!tenantId || !apiConfig?.id) return;
    syncMutation.mutate({
      tenant_id: tenantId,
      api_config_id: apiConfig.id,
      mode,
    });
  };

  return (
    <div className="space-y-6 p-1">
      <PageHeader
        icon={Plug}
        title="Integração Edeltec"
        description="Sincronização e controle do catálogo de equipamentos"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingStats ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
          ))
        ) : (
          <>
            <StatCard icon={Package} label="Total sincronizado" value={stats?.totalSynced ?? 0} color="primary" />
            <StatCard icon={Warehouse} label="Total de geradores" value={stats?.totalGenerators ?? 0} color="info" />
            <StatCard icon={ShoppingCart} label="Em estoque" value={stats?.emEstoque ?? 0} color="success" />
            <StatCard icon={Clock} label="Sob encomenda" value={stats?.sobEncomenda ?? 0} color="warning" />
          </>
        )}
      </div>

      {/* Status + Ações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Status da sincronização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingSync ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-5 w-48" />
              </div>
            ) : syncState ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-32 shrink-0">Status:</span>
                  <StatusBadge variant={statusVariantMap[syncState.status] ?? "muted"} dot>
                    {syncState.status}
                  </StatusBadge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-32 shrink-0">Modo:</span>
                  <span className="text-foreground font-medium">{syncState.mode || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-32 shrink-0">Progresso:</span>
                  <span className="text-foreground font-medium">
                    {syncState.current_page ?? 0} / {syncState.total_pages ?? "?"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-32 shrink-0">Processados:</span>
                  <span className="text-foreground font-medium">{syncState.processed_items ?? 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-32 shrink-0">Inseridos:</span>
                  <span className="text-foreground font-medium">{syncState.inserted_items ?? 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-32 shrink-0">Atualizados:</span>
                  <span className="text-foreground font-medium">{syncState.updated_items ?? 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-32 shrink-0">Última execução:</span>
                  <span className="text-foreground">{formatDateBrasilia(syncState.last_run_at)}</span>
                </div>
                {syncState.last_error && (
                  <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{syncState.last_error}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma sincronização registrada</p>
            )}
          </CardContent>
        </Card>

        {/* Ações */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Ações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full gap-2"
              onClick={() => handleSync("incremental")}
              disabled={syncMutation.isPending || !apiConfig?.id}
            >
              {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sincronizar incremental
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2 border-warning text-warning hover:bg-warning/10"
              onClick={() => setShowFullReplace(true)}
              disabled={syncMutation.isPending || !apiConfig?.id}
            >
              <RefreshCw className="h-4 w-4" />
              Ressincronizar tudo
            </Button>
            {!apiConfig?.id && (
              <p className="text-xs text-muted-foreground">
                Configure a API Edeltec em Integrações → API Config antes de sincronizar.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Logs de sincronização</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum log registrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Data</TableHead>
                  <TableHead className="w-[80px]">Nível</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {formatDateBrasilia(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={log.level === "error" ? "destructive" : log.level === "warn" ? "warning" : "info"}
                      >
                        {log.level}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-xs">{log.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirm full replace */}
      <AlertDialog open={showFullReplace} onOpenChange={setShowFullReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ressincronizar tudo?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação irá substituir completamente o catálogo Edeltec pelos dados mais recentes da API.
              Todos os produtos sincronizados anteriormente serão removidos e recriados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-warning text-warning-foreground hover:bg-warning/90"
              onClick={() => { handleSync("full_replace"); setShowFullReplace(false); }}
            >
              Confirmar ressincronização
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
