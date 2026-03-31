/**
 * MeterPhaseStatus — Shows status of each phase (A, B, C) for 3-phase meters.
 * SRP: Parse status codes and render colored mini-cards.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

interface Props {
  statusA: string | null | undefined;
  statusB: string | null | undefined;
  statusC: string | null | undefined;
}

function getPhaseInfo(status: string | null | undefined): { label: string; color: string; badgeClass: string } {
  const num = Number(status ?? "");
  if (isNaN(num) || status == null) return { label: "Sem dados", color: "text-muted-foreground", badgeClass: "bg-muted text-muted-foreground border-border" };
  // Tuya DP status mapping: 0 = desligado/aberto, 1 = ligado/normal, 2 = trip/falha
  switch (num) {
    case 0: return { label: "Desligado", color: "text-muted-foreground", badgeClass: "bg-muted text-muted-foreground border-border" };
    case 1: return { label: "Normal", color: "text-success", badgeClass: "bg-success/10 text-success border-success/20" };
    case 2: return { label: "Trip", color: "text-destructive", badgeClass: "bg-destructive/10 text-destructive border-destructive/20" };
    default: return { label: `Código ${num}`, color: "text-muted-foreground", badgeClass: "bg-muted text-muted-foreground border-border" };
  }
}

export function MeterPhaseStatus({ statusA, statusB, statusC }: Props) {
  const phases = [
    { name: "Fase A", status: statusA },
    { name: "Fase B", status: statusB },
    { name: "Fase C", status: statusC },
  ];

  // Don't render if no phase data at all
  const hasAnyData = phases.some(p => p.status != null);
  if (!hasAnyData) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="w-4 h-4" /> Status das Fases
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {phases.map((p) => {
            const info = getPhaseInfo(p.status);
            return (
              <div
                key={p.name}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border bg-card"
              >
                <span className="text-xs font-medium text-muted-foreground">{p.name}</span>
                <Badge variant="outline" className={`text-xs ${info.badgeClass}`}>
                  {info.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
