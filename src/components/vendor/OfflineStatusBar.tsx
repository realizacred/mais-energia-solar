import { WifiOff, Wifi, RefreshCw, Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineLeadSync } from "@/hooks/useOfflineLeadSync";
import { cn } from "@/lib/utils";

interface OfflineStatusBarProps {
  vendedorNome?: string | null;
}

export function OfflineStatusBar({ vendedorNome }: OfflineStatusBarProps = {}) {
  const { isOnline, pendingCount, isSyncing, retrySync } = useOfflineLeadSync({ vendedorNome });

  return (
    <div 
      className={cn(
        "py-2.5 px-4 border-b transition-colors duration-300",
        isOnline 
          ? "bg-success/10 border-success/20" 
          : "bg-warning/10 border-warning/20"
      )}
    >
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Status de Conexão */}
        <div className="flex items-center gap-4">
          {/* Ícone + Status */}
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-success" />
            ) : (
              <WifiOff className="w-4 h-4 text-warning animate-pulse-soft" />
            )}
            <span className={cn(
              "text-sm font-semibold",
              isOnline ? "text-success" : "text-warning"
            )}>
              {isOnline ? "Online" : "Sem Internet"}
            </span>
          </div>

          {/* Separador */}
          <div className="w-px h-4 bg-border" />

          {/* Contador de Leads Pendentes */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Pendentes:
            </span>
            <span 
              className={cn(
                "inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-xs font-bold",
                pendingCount > 0 
                  ? "bg-warning text-warning-foreground" 
                  : "bg-success text-success-foreground"
              )}
            >
              {pendingCount}
            </span>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2">
          {/* Botão de Sincronização Manual */}
          {pendingCount > 0 && isOnline && (
            <Button 
              size="sm" 
              onClick={() => retrySync()}
              disabled={isSyncing}
              className="gap-1.5 h-7 text-xs bg-primary hover:bg-primary/90"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3" />
                  Sincronizar
                </>
              )}
            </Button>
          )}

          {/* Mensagem quando offline com pendentes */}
          {!isOnline && pendingCount > 0 && (
            <span className="text-xs text-warning">
              Será enviado quando a conexão voltar
            </span>
          )}

          {/* Mensagem quando offline sem pendentes */}
          {!isOnline && pendingCount === 0 && (
            <span className="text-xs text-muted-foreground">
              Você pode cadastrar leads offline
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
