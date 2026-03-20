/**
 * MeterAlarmPanel — Displays fault/alarm status from fault_bitmap DP.
 * SRP: Parse fault bitmap and render alarm badges.
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, ShieldCheck } from "lucide-react";

interface Props {
  faultBitmap: string | null | undefined;
}

/** Known fault bits for Tuya DLQ breaker devices */
const FAULT_BITS: { bit: number; label: string; severity: "destructive" | "warning" }[] = [
  { bit: 0, label: "Curto-circuito", severity: "destructive" },
  { bit: 1, label: "Sobretensão", severity: "destructive" },
  { bit: 2, label: "Sobrecarga", severity: "destructive" },
  { bit: 3, label: "Fuga de corrente", severity: "warning" },
  { bit: 4, label: "Alta potência", severity: "warning" },
  { bit: 5, label: "Desequilíbrio", severity: "warning" },
  { bit: 6, label: "Subtensão", severity: "warning" },
  { bit: 7, label: "Superaquecimento", severity: "destructive" },
];

function parseAlarms(raw: string | null | undefined): { label: string; severity: "destructive" | "warning" }[] {
  if (!raw) return [];
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

export function MeterAlarmPanel({ faultBitmap }: Props) {
  const alarms = parseAlarms(faultBitmap);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Alarmes e Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alarms.length === 0 ? (
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-success" />
            <Badge className="bg-success/10 text-success border-success/20 text-xs">
              Sem alarmes ativos
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
      </CardContent>
    </Card>
  );
}
