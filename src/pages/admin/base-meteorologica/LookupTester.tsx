/**
 * LookupTester — Tests irradiance lookup against active version.
 * Redesigned with clearer UI and monthly chart display.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MapPin, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { VersionRow } from "./types";
import { BRASILIA } from "./types";

interface LookupTesterProps {
  activeVersion: VersionRow | undefined;
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function LookupTester({ activeVersion }: LookupTesterProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleTest = async () => {
    if (!activeVersion) {
      toast.error("Nenhuma versão ativa para testar.");
      return;
    }
    setTesting(true);
    setResult(null);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("get_irradiance_for_simulation", {
        _version_id: activeVersion.id,
        _lat: BRASILIA.lat,
        _lon: BRASILIA.lon,
        _radius_deg: 0.3,
      });
      if (rpcError) throw rpcError;
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTesting(false);
    }
  };

  // Extract monthly GHI values for visual display
  const ghiValues = result?.ghi
    ? MONTH_LABELS.map((_, i) => {
        const key = `m${String(i + 1).padStart(2, "0")}`;
        return result.ghi[key] ?? 0;
      })
    : null;
  const maxGhi = ghiValues ? Math.max(...ghiValues) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleTest}
          disabled={testing || !activeVersion}
          className="gap-1.5 text-xs"
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
          Testar Consulta (Brasília)
        </Button>
        {result && (
          <Badge variant="outline" className="text-[10px] gap-1 text-success border-success/30">
            <CheckCircle2 className="h-3 w-3" />
            {result.distance_km}km do ponto mais próximo
          </Badge>
        )}
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-destructive">
          ❌ {error}
        </div>
      )}

      {result && ghiValues && (
        <Card className="rounded-lg border-border/40">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Irradiância Mensal — Brasília ({BRASILIA.lat}°, {BRASILIA.lon}°)
              </p>
              <Badge variant="outline" className="text-[9px]">
                {result.units || "kWh/m²/dia"} • {result.dataset_code}
              </Badge>
            </div>

            {/* Visual bar chart */}
            <div className="flex items-end gap-1 h-16 mt-2">
              {ghiValues.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className="text-[8px] text-muted-foreground font-mono">
                    {val > 0 ? val.toFixed(1) : ""}
                  </span>
                  <div
                    className="w-full rounded-t bg-primary/60 transition-all"
                    style={{ height: maxGhi > 0 ? `${(val / maxGhi) * 40}px` : "2px", minHeight: "2px" }}
                  />
                  <span className="text-[8px] text-muted-foreground">{MONTH_LABELS[i]}</span>
                </div>
              ))}
            </div>

            {result.ghi_annual_avg && (
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Média anual: <span className="font-semibold text-foreground">{Number(result.ghi_annual_avg).toFixed(2)} kWh/m²/dia</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}