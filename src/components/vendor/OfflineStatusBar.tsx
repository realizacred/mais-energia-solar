import { WifiOff, Wifi, RefreshCw, Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineLeadSync } from "@/hooks/useOfflineLeadSync";

interface OfflineStatusBarProps {
  vendedorNome?: string | null;
}

export function OfflineStatusBar({ vendedorNome }: OfflineStatusBarProps = {}) {
  const { isOnline, pendingCount, isSyncing, retrySync } = useOfflineLeadSync({ vendedorNome });

  return (
    <div 
      className={`py-2 px-4 ${
        isOnline 
          ? "bg-emerald-50 border-b border-emerald-200" 
          : "bg-amber-50 border-b border-amber-200"
      }`}
    >
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Status de Conexão */}
        <div className="flex items-center gap-4">
          {/* Ícone de Antena + Status */}
          <div className="flex items-center gap-2">
            <Radio 
              className={`w-5 h-5 ${isOnline ? "text-emerald-600" : "text-amber-600"}`} 
            />
            <span className={`text-sm font-semibold ${isOnline ? "text-emerald-700" : "text-amber-700"}`}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>

          {/* Separador */}
          <div className="w-px h-5 bg-gray-300" />

          {/* Contador de Leads Pendentes */}
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isOnline ? "text-emerald-700" : "text-amber-700"}`}>
              Leads a sincronizar:
            </span>
            <span 
              className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-sm font-bold ${
                pendingCount > 0 
                  ? "bg-amber-500 text-white" 
                  : "bg-emerald-500 text-white"
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
            onClick={() => retrySync()}
            disabled={isSyncing}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
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
          <span className="text-xs text-amber-600">
            Será enviado quando a conexão voltar
          </span>
        )}
      </div>
    </div>
  );
}