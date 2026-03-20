/**
 * MeterAlarmPanel — Displays fault/alarm status from fault_bitmap DP + counters.
 * SRP: Parse fault bitmap (16 bits) and render alarm badges with event counters.
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, ShieldCheck } from "lucide-react";

interface Props {
  faultBitmap: number | string | null | undefined;
  overCurrentCount?: number | null;
  lostCurrentCount?: number | null;
  leakCount?: number | null;
}

/** Known fault bits for Tuya DLQ breaker devices — 16 bits confirmed */
const FAULT_BITS: { bit: number; label: string; severity: "destructive" | "warning" }[] = [
  { bit: 0, label: "Curto-circuito", severity: "destructive" },
  { bit: 1, label: "Sobretensão", severity: "destructive" },
  { bit: 2, label: "Sobrecarga", severity: "destructive" },
  { bit: 3, label: "Fuga de corrente", severity: "warning" },
  { bit: 4, label: "Temperatura", severity: "destructive" },
  { bit: 5, label: "Incêndio", severity: "destructive" },
  { bit: 6, label: "Alta potência", severity: "warning" },
  { bit: 7, label: "Autoteste", severity: "warning" },
  { bit: 8, label: "Sobrecorrente", severity: "destructive" },
  { bit: 9, label: "Desequilíbrio", severity: "warning" },
  { bit: 10, label: "Sobretensão (2)", severity: "destructive" },
  { bit: 11, label: "Subtensão", severity: "warning" },
  { bit: 12, label: "Fase perdida", severity: "destructive" },
  { bit: 13, label: "Interrupção", severity: "warning" },
  { bit: 14, label: "Magnetismo", severity: "warning" },
  { bit: 15, label: "Crédito", severity: "warning" },
];

function parseAlarms(raw: number | string | null | undefined): { label: string; severity: "destructive" | "warning" }[] {
  if (raw == null) return [];
  const num = Number(raw);
  if (isNaN(num) || num === 0) return [];
  const active: { label: string; severity: "destructive" | "warning" }[] = [];
  for (const f of FAULT_BITS) {
    if ((num >> f.bit) & 1) {
      active.push({ label: f.label, severity: f.severity });
    }
  }
  return active;
}

export function MeterAlarmPanel({ faultBitmap, overCurrentCount, lostCurrentCount, leakCount }: Props) {
  const alarms = parseAlarms(faultBitmap);
  const hasCounters = (overCurrentCount != null && overCurrentCount > 0) ||
    (lostCurrentCount != null && lostCurrentCount > 0) ||
    (leakCount != null && leakCount > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Alarmes e Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alarms.length === 0 ? (
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-success" />
            <Badge className="bg-success/10 text-success border-success/20 text-xs">
              Sem alarmes ativos ✓
            </Badge>
            {faultBitmap != null && (
              <span className="text-xs text-muted-foreground font-mono ml-2">
                fault={faultBitmap}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {alarms.map((a) => (
              <Badge
                key={a.label}
                variant="outline"
                className={
                  a.severity === "destructive"
                    ? "bg-destructive/10 text-destructive border-destructive/20 text-xs"
                    : "bg-warning/10 text-warning border-warning/20 text-xs"
                }
              >
                {a.label}
              </Badge>
            ))}
            <span className="text-xs text-muted-foreground font-mono self-center ml-2">
              fault={faultBitmap}
            </span>
          </div>
        )}

        {/* Event counters */}
        {hasCounters && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
            {overCurrentCount != null && overCurrentCount > 0 && (
              <span className="text-xs text-muted-foreground">
                Sobrecarga: <span className="font-mono font-semibold text-foreground">{overCurrentCount}</span> vezes
              </span>
            )}
            {lostCurrentCount != null && lostCurrentCount > 0 && (
              <span className="text-xs text-muted-foreground">
                Fase perdida: <span className="font-mono font-semibold text-foreground">{lostCurrentCount}</span> vezes
              </span>
            )}
            {leakCount != null && leakCount > 0 && (
              <span className="text-xs text-muted-foreground">
                Fuga: <span className="font-mono font-semibold text-foreground">{leakCount}</span> vezes
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
