/**
 * LookupTester — Tests irradiance lookup against active version OR via NSRDB API fallback.
 * Always visible so users can test even without an active local version.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, CheckCircle2, Satellite, Database } from "lucide-react";
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
  const [source, setSource] = useState<"local" | "nsrdb" | "">("");
  const [lat, setLat] = useState(String(BRASILIA.lat));
  const [lon, setLon] = useState(String(BRASILIA.lon));

  const handleTestLocal = async () => {
    if (!activeVersion) {
      toast.error("Nenhuma versão ativa para testar localmente.");
      return;
    }
    setTesting(true);
    setResult(null);
    setError("");
    setSource("local");
    try {
      const { data, error: rpcError } = await supabase.rpc("get_irradiance_for_simulation", {
        _version_id: activeVersion.id,
        _lat: parseFloat(lat),
        _lon: parseFloat(lon),
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

  const handleTestNsrdb = async () => {
    setTesting(true);
    setResult(null);
    setError("");
    setSource("nsrdb");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("nsrdb-lookup", {
        body: { lat: parseFloat(lat), lon: parseFloat(lon) },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      // Normalize NSRDB response to match local format for display
      const monthly = data?.monthly_ghi || data?.monthly;
      setResult({
        ghi: monthly
          ? Object.fromEntries(MONTH_LABELS.map((_, i) => [`m${String(i + 1).padStart(2, "0")}`, monthly[i] ?? 0]))
          : null,
        ghi_annual_avg: data?.annual_average ?? data?.annual_avg ?? null,
        distance_km: data?.distance_km ?? null,
        dataset_code: "NSRDB",
        units: "kWh/m²/dia",
        raw: data,
      });
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
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Teste de Consulta
      </p>

      {/* Coordinate inputs */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Latitude</label>
          <Input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="h-8 text-xs font-mono"
            placeholder="-15.7942"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Longitude</label>
          <Input
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            className="h-8 text-xs font-mono"
            placeholder="-47.8822"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {activeVersion && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestLocal}
            disabled={testing}
            className="gap-1.5 text-xs"
          >
            {testing && source === "local" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Database className="h-3.5 w-3.5" />
            )}
            Testar Local (BD)
          </Button>
        )}

        <Button
          size="sm"
          variant={activeVersion ? "outline" : "default"}
          onClick={handleTestNsrdb}
          disabled={testing}
          className="gap-1.5 text-xs"
        >
          {testing && source === "nsrdb" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Satellite className="h-3.5 w-3.5" />
          )}
          Testar NSRDB (API)
        </Button>
      </div>

      {/* Source badge */}
      {result && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] gap-1 text-success border-success/30">
            <CheckCircle2 className="h-3 w-3" />
            {source === "nsrdb" ? "Via NSRDB API" : `${result.distance_km}km do ponto mais próximo`}
          </Badge>
        </div>
      )}

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
                Irradiância Mensal — ({lat}°, {lon}°)
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
