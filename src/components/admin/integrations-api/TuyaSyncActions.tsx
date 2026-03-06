/**
 * TuyaSyncActions — Action buttons and sync logs for a Tuya integration config.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tuyaIntegrationService } from "@/services/tuyaIntegrationService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import {
  TestTube2, Download, RefreshCw, Zap, Clock, AlertTriangle,
  CheckCircle2, XCircle, Loader2, Gauge
} from "lucide-react";

interface Props {
  configId: string;
  configName: string;
}

export function TuyaSyncActions({ configId, configName }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const { data: meterCount = 0 } = useQuery({
    queryKey: ["tuya_meter_count", configId],
    queryFn: () => tuyaIntegrationService.getImportedMeterCount(configId),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["tuya_sync_logs", configId],
    queryFn: () => tuyaIntegrationService.getSyncLogs(configId, 5),
    refetchInterval: loadingAction ? 3000 : false,
  });

  function formatResult(action: string, result: any): string {
    if (action === "test") {
      if (result?.success) return "Conexão estabelecida com sucesso!";
      const msg = result?.message || "Falha na autenticação";
      if (/sign invalid/i.test(msg)) return "Client Secret inválido. Verifique e tente novamente.";
      if (/clientId/i.test(msg)) return "Client ID inválido. Verifique e tente novamente.";
      return msg;
    }
    if (result?.total !== undefined) {
      const parts: string[] = [];
      if (result.created) parts.push(`${result.created} criados`);
      if (result.updated) parts.push(`${result.updated} atualizados`);
      if (result.processed) parts.push(`${result.processed} processados`);
      if (result.failed) parts.push(`${result.failed} com erro`);
      return parts.length ? parts.join(", ") : `${result.total} itens processados`;
    }
    return "Operação concluída.";
  }

  async function runAction(action: string, label: string, fn: () => Promise<any>) {
    setLoadingAction(action);
    try {
      const result = await fn();
      const isSuccess = action === "test" ? result?.success !== false : true;
      const description = formatResult(action, result);

      toast({
        title: isSuccess ? `${label}: Sucesso ✓` : `${label}: Falhou`,
        description,
        variant: isSuccess ? "default" : "destructive",
      });

      qc.invalidateQueries({ queryKey: ["integrations_api_configs"] });
      qc.invalidateQueries({ queryKey: ["tuya_meter_count", configId] });
      qc.invalidateQueries({ queryKey: ["tuya_sync_logs", configId] });
      qc.invalidateQueries({ queryKey: ["meter_devices"] });
    } catch (err: any) {
      toast({ title: `${label}: Erro`, description: err?.message, variant: "destructive" });
    } finally {
      setLoadingAction(null);
    }
  }

  const isLoading = !!loadingAction;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Gauge className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{meterCount}</span>
          <span className="text-muted-foreground">medidores importados</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => runAction("test", "Teste", () => tuyaIntegrationService.testConnection(configId))}
        >
          {loadingAction === "test" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5 mr-1" />}
          Testar Conexão
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => runAction("devices", "Importar", () => tuyaIntegrationService.syncDevices(configId))}
        >
          {loadingAction === "devices" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
          Importar Medidores
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => runAction("status", "Leituras", () => tuyaIntegrationService.syncDeviceStatus(configId))}
        >
          {loadingAction === "status" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
          Sincronizar Leituras
        </Button>
        <Button
          size="sm"
          disabled={isLoading}
          onClick={() => runAction("all", "Sync Completo", () => tuyaIntegrationService.syncAll(configId))}
        >
          {loadingAction === "all" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
          Sincronizar Tudo
        </Button>
      </div>

      {/* Sync Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Últimas Sincronizações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-xs border-b pb-2 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {log.status === "completed" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : log.status === "error" ? (
                      <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                    )}
                    <Badge variant="outline" className="text-[10px]">{log.sync_type}</Badge>
                    <span className="text-muted-foreground truncate">
                      {log.items_processed} processados
                      {log.items_failed > 0 && <span className="text-destructive ml-1">({log.items_failed} erros)</span>}
                    </span>
                  </div>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {log.started_at ? new Date(log.started_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
