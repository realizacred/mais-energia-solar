import { useState } from "react";
import { AlertTriangle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntelligenceAlerts } from "@/hooks/useIntelligenceAlerts";
import { IntelligenceAlertCard } from "./IntelligenceAlertCard";
import { toast } from "sonner";

export function IntelligenceAlertsPage() {
  const [pendentes, setPendentes] = useState(true);
  const [severidade, setSeveridade] = useState<string>("");
  const { alerts, isLoading, resolveAlert } = useIntelligenceAlerts({
    pendentes,
    severidade: severidade || undefined,
  });

  const handleResolve = (alertId: string, acao: string) => {
    resolveAlert.mutate(
      { alertId, acao_tomada: acao, resultado: acao === "ignorado" ? "fracasso" : "pendente" },
      {
        onSuccess: () => toast.success("Alerta atualizado"),
        onError: () => toast.error("Erro ao atualizar"),
      },
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Alertas de Inteligência</h1>
            <p className="text-sm text-muted-foreground">{alerts.length} alertas {pendentes ? "pendentes" : "total"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={pendentes ? "default" : "outline"}
            size="sm"
            onClick={() => setPendentes(!pendentes)}
          >
            <Filter className="w-3.5 h-3.5 mr-1" />
            {pendentes ? "Pendentes" : "Todos"}
          </Button>
          <Select value={severidade} onValueChange={setSeveridade}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Severidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="critica">Crítica</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum alerta encontrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros ou aguarde novas análises</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert: any) => (
            <IntelligenceAlertCard
              key={alert.id}
              alert={alert}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}
