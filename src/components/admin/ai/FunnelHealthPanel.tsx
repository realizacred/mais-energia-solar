/**
 * FunnelHealthPanel — Painel de Saúde dos Funis.
 *
 * Mostra cada projeto e em que etapa ele está em cada papel de funil.
 * Destaca incoerências detectadas pela tabela ai_funnel_alerts.
 *
 * Governança:
 *  - RB-04: queries via hook (useFunnelHealth)
 *  - SRP: só renderização. Lógica de detecção fica no banco/hook.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle2, Activity } from "lucide-react";
import { useFunnelAlerts, useUpdateAlertState, PAPEL_LABEL } from "@/hooks/useFunnelGovernance";
import { LoadingState } from "@/components/ui-kit";
import { toast } from "sonner";

export function FunnelHealthPanel() {
  const { data: alerts, isLoading } = useFunnelAlerts("aberto");
  const updateState = useUpdateAlertState();

  const stats = useMemo(() => {
    const list = alerts ?? [];
    return {
      total: list.length,
      alta: list.filter((a) => a.severidade === "alta").length,
      media: list.filter((a) => a.severidade === "media").length,
      baixa: list.filter((a) => a.severidade === "baixa").length,
    };
  }, [alerts]);

  if (isLoading) return <LoadingState />;

  const handleResolve = async (id: string, estado: "corrigido" | "ignorado") => {
    try {
      await updateState.mutateAsync({ id, estado });
      toast.success(estado === "corrigido" ? "Alerta marcado como corrigido" : "Alerta ignorado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar alerta");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard label="Alertas abertos" value={stats.total} icon={Activity} tone="default" />
        <StatCard label="Severidade alta" value={stats.alta} icon={AlertTriangle} tone="destructive" />
        <StatCard label="Severidade média" value={stats.media} icon={AlertTriangle} tone="warning" />
        <StatCard label="Severidade baixa" value={stats.baixa} icon={CheckCircle2} tone="muted" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incoerências detectadas</CardTitle>
        </CardHeader>
        <CardContent>
          {!alerts || alerts.length === 0 ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Tudo coerente</AlertTitle>
              <AlertDescription>
                Nenhum alerta aberto. Os funis estão sincronizados conforme as regras ativas.
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-2">
                {alerts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-md border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severidade={a.severidade} />
                        <Badge variant="outline" className="text-xs">
                          {PAPEL_LABEL[a.funil_origem_papel]} → {PAPEL_LABEL[a.funil_alvo_papel]}
                        </Badge>
                      </div>
                      <p className="text-sm">{a.mensagem ?? "Incoerência entre funis."}</p>
                      {a.etapa_atual_alvo && a.etapa_esperada_alvo && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Atual: <strong>{a.etapa_atual_alvo}</strong> · Esperado:{" "}
                          <strong>{a.etapa_esperada_alvo}</strong>
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button size="sm" variant="default" onClick={() => handleResolve(a.id, "corrigido")}>
                        Corrigido
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleResolve(a.id, "ignorado")}>
                        Ignorar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "default" | "destructive" | "warning" | "muted";
}) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-primary";
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
        </div>
        <Icon className={`h-6 w-6 ${toneClass}`} />
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ severidade }: { severidade: "baixa" | "media" | "alta" }) {
  const map = {
    alta: { label: "Alta", className: "bg-destructive/15 text-destructive border-destructive/30" },
    media: { label: "Média", className: "bg-warning/15 text-warning border-warning/30" },
    baixa: { label: "Baixa", className: "bg-muted text-muted-foreground border-border" },
  } as const;
  const cfg = map[severidade];
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
