import { WifiOff, Wifi, RefreshCw, Radio, Database } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Button } from "@/components/ui/button";
import { useOfflineLeadDb } from "@/hooks/useOfflineLeadDb";

interface OfflineStatusBarDbProps {
  vendedorNome?: string | null;
}

export function OfflineStatusBarDb({ vendedorNome }: OfflineStatusBarDbProps = {}) {
  const { isOnline, pendingCount, isSyncing, syncLeads } = useOfflineLeadDb({ vendedorNome });

  return (
    <div 
      className={`py-2 px-4 ${
        isOnline 
          ? "bg-success/5 border-b border-success/20" 
          : "bg-warning/5 border-b border-warning/20"
      }`}
    >
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Status de Conexão */}
        <div className="flex items-center gap-4">
          {/* Ícone de Antena + Status */}
          <div className="flex items-center gap-2">
            <Radio 
              className={`w-5 h-5 ${isOnline ? "text-success" : "text-warning"}`} 
            />
            <span className={`text-sm font-semibold ${isOnline ? "text-success" : "text-warning"}`}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>

          {/* Separador */}
          <div className="w-px h-5 bg-border" />

          {/* Badge IndexedDB */}
          <div className="flex items-center gap-1.5">
            <Database className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">IndexedDB</span>
          </div>

          {/* Separador */}
          <div className="w-px h-5 bg-border" />

          {/* Contador de Leads Pendentes */}
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isOnline ? "text-success" : "text-warning"}`}>
              Leads a sincronizar:
            </span>
            <span 
              className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-sm font-bold ${
                pendingCount > 0 
                  ? "bg-warning text-warning-foreground" 
                  : "bg-success text-success-foreground"
              }`}
            >
              {pendingCount}
            </span>
          </div>
        </div>

        {/* Botão de Sincronização Manual */}
        {pendingCount > 0 && isOnline && (
          <Button 
            size="sm" 
            onClick={() => syncLeads()}
            disabled={isSyncing}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            {isSyncing ? (
              <>
                <Spinner size="sm" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
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
      </div>
    </div>
  );
}
