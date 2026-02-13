import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cloud, CloudOff, RefreshCw, Check, AlertTriangle, Clock } from "lucide-react";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function SyncStatusWidget() {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    syncErrors,
    manualSync,
    clearFailedItems,
  } = useBackgroundSync();

  const handleSync = () => {
    manualSync();
  };

  return (
    <Card className={!isOnline ? "border-warning/30 bg-warning/5" : undefined}>
      <CardContent className="p-3 sm:pt-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {isOnline ? (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                <Cloud className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              </div>
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                <CloudOff className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                <span className="font-medium text-xs sm:text-sm">
                  {isOnline ? "Conectado" : "Offline"}
                </span>
                {pendingCount > 0 && (
                  <Badge variant={isOnline ? "secondary" : "destructive"} className="text-xs px-1.5 py-0">
                    {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                  </Badge>
                )}
                {pendingCount === 0 && isOnline && (
                  <Badge variant="outline" className="text-xs text-success border-success/30 px-1.5 py-0">
                    <Check className="w-3 h-3 mr-0.5" />
                    Sync
                  </Badge>
                )}
              </div>
              {lastSyncTime && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span className="truncate">{formatDistanceToNow(lastSyncTime, { addSuffix: true, locale: ptBR })}</span>
                </p>
              )}
            </div>
          </div>

          {isOnline && pendingCount > 0 && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleSync}
              disabled={isSyncing}
              className="h-8 px-2 sm:px-3 text-xs shrink-0"
            >
              <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${isSyncing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline ml-1">{isSyncing ? "Sincronizando..." : "Sincronizar"}</span>
            </Button>
          )}
        </div>

        {/* Sync Errors */}
        {syncErrors.length > 0 && (
          <div className="mt-3 p-2 bg-destructive/5 rounded-lg border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-destructive">Erros de sincronização:</p>
                <ul className="text-xs text-destructive/80 mt-1 space-y-0.5">
                  {syncErrors.slice(0, 3).map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={clearFailedItems}
                  className="text-xs text-destructive p-0 h-auto mt-1"
                >
                  Limpar itens com falha
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Offline Message */}
        {!isOnline && (
          <p className="text-xs text-warning mt-2">
            Você está offline. As alterações serão sincronizadas automaticamente quando a conexão for restaurada.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
