import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui-kit/Spinner";
import { PageHeader } from "@/components/ui-kit";
import { Activity, AlertTriangle, CheckCircle2, Clock, Send, XCircle, Lock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HealthData {
  instances: Array<{ id: string; evolution_instance_key: string; status: string; tenant_id: string }>;
  backlog: Record<string, { pending: number; sending: number }>;
  opsStats24h: Record<string, number>;
  failures24h: Array<{ id: string; error_message: string; instance_id: string; created_at: string; retry_count: number }>;
}

export default function WaHealthDashboard() {
  const { data, isLoading, error } = useQuery<HealthData>({
    queryKey: ["wa-health-admin"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("wa-health-admin");
      if (error) throw error;
      return data as HealthData;
    },
  });

  const instances = data?.instances || [];
  const backlog = data?.backlog || {};
  const opsStats = data?.opsStats24h || {};
  const failures = data?.failures24h || [];

  const totalPending = Object.values(backlog).reduce((acc, v) => acc + v.pending, 0);
  const totalSending = Object.values(backlog).reduce((acc, v) => acc + v.sending, 0);
  const sentCount = opsStats["outbox_sent_ack"] || 0;
  const failedCount = opsStats["outbox_failed"] || 0;
  const lockBusyCount = opsStats["lock_busy"] || 0;
  const failRate = sentCount + failedCount > 0 ? (failedCount / (sentCount + failedCount)) * 100 : 0;

  const isHighBacklog = totalPending > 100;
  const isHighFailRate = failRate > 10;
  const hasDisconnected = instances.some((i) => i.status !== "connected");

  if (error) {
    const msg = (error as any)?.message || String(error);
    const isForbidden = msg.includes("403") || msg.includes("Forbidden");
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
          <XCircle className="h-5 w-5" />
          <span className="text-sm font-medium">
            {isForbidden ? "Acesso negado. Apenas administradores podem visualizar esta página." : `Erro ao carregar dados: ${msg}`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="WhatsApp Engine Health"
        description="Monitoramento operacional em tempo real"
      />

      {/* Alerts */}
      {(isHighBacklog || isHighFailRate || hasDisconnected) && (
        <div className="space-y-2">
          {isHighBacklog && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">Backlog alto: {totalPending} mensagens pendentes</span>
            </div>
          )}
          {isHighFailRate && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
              <XCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Taxa de falha alta: {failRate.toFixed(1)}% nas últimas 24h</span>
            </div>
          )}
          {hasDisconnected && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning border border-warning/20">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">Instância(s) desconectada(s)</span>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Send className="h-3.5 w-3.5" /> Enviadas (24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <Spinner size="sm" /> : sentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> Falhas (24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedCount}</div>
            {failRate > 0 && <p className="text-xs text-muted-foreground">{failRate.toFixed(1)}% de falha</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Backlog</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <Spinner size="sm" /> : totalPending}</div>
            {totalSending > 0 && <p className="text-xs text-muted-foreground">{totalSending} em envio</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Lock busy (24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lockBusyCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Instances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Instâncias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {instances.map((inst) => {
              const instBacklog = backlog[inst.id];
              return (
                <div key={inst.id} className="flex items-center justify-between py-2 px-3 rounded border">
                  <div className="flex items-center gap-2">
                    <Badge variant={inst.status === "connected" ? "default" : "destructive"} className="text-xs">
                      {inst.status}
                    </Badge>
                    <span className="text-sm font-medium">{inst.evolution_instance_key}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{instBacklog?.pending || 0} pendentes</span>
                    <span>{instBacklog?.sending || 0} enviando</span>
                  </div>
                </div>
              );
            })}
            {!instances.length && <p className="text-sm text-muted-foreground">Nenhuma instância configurada.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Recent failures */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><XCircle className="h-4 w-4" /> Falhas recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {!failures.length ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" /> Sem falhas nas últimas 24h
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-auto">
              {failures.map((f) => (
                <div key={f.id} className="text-xs p-2 rounded bg-muted/50 border">
                  <div className="flex justify-between">
                    <span className="font-mono text-[10px]">{f.id.slice(0, 8)}</span>
                    <span>{format(new Date(f.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                  </div>
                  <p className="text-destructive mt-1 truncate">{f.error_message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
