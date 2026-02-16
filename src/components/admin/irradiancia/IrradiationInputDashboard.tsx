import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { Download, Clock, MapPin, Sun, Thermometer, Droplets } from "lucide-react";

// ── Types ────────────────────────────────────────────────
interface CoordData {
  latitude: string;
  longitude: string;
  altitude: string;
}

interface EnvironmentData {
  albedo: string;
  temperatureAvg: string;
  soilingIndex: string;
}

interface ChangeLogEntry {
  timestamp: string;
  field: string;
  oldValue: string;
  newValue: string;
  user: string;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTH_KEYS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const ALBEDO_OPTIONS = [
  { value: "0.20", label: "Solo padrão (0.20)" },
  { value: "0.25", label: "Grama / Vegetação (0.25)" },
  { value: "0.12", label: "Asfalto (0.12)" },
  { value: "0.30", label: "Concreto claro (0.30)" },
  { value: "0.60", label: "Areia / Deserto (0.60)" },
  { value: "0.80", label: "Neve (0.80)" },
  { value: "0.10", label: "Água (0.10)" },
];

const SOILING_OPTIONS = [
  { value: "0.02", label: "Baixo (2%)" },
  { value: "0.05", label: "Moderado (5%)" },
  { value: "0.08", label: "Alto (8%)" },
  { value: "0.12", label: "Severo (12%)" },
];

// ── Main Component ───────────────────────────────────────
export function IrradiationInputDashboard() {
  const [coords, setCoords] = useState<CoordData>({
    latitude: "",
    longitude: "",
    altitude: "",
  });

  const [hsp, setHsp] = useState<Record<string, string>>(() =>
    Object.fromEntries(MONTH_KEYS.map((k) => [k, ""]))
  );

  const [env, setEnv] = useState<EnvironmentData>({
    albedo: "0.20",
    temperatureAvg: "",
    soilingIndex: "0.02",
  });

  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);

  const logChange = useCallback(
    (field: string, oldVal: string, newVal: string) => {
      if (oldVal === newVal) return;
      setChangeLog((prev) => [
        {
          timestamp: new Date().toLocaleString("pt-BR"),
          field,
          oldValue: oldVal || "—",
          newValue: newVal || "—",
          user: "Auditor",
        },
        ...prev.slice(0, 99),
      ]);
    },
    []
  );

  const handleCoordChange = (key: keyof CoordData, value: string) => {
    // Allow only numbers, minus, dot
    const sanitized = value.replace(/[^0-9.\-]/g, "");
    logChange(key, coords[key], sanitized);
    setCoords((prev) => ({ ...prev, [key]: sanitized }));
  };

  const handleHspChange = (month: string, value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, "");
    if (sanitized && (parseFloat(sanitized) < 0 || parseFloat(sanitized) > 12)) return;
    logChange(`HSP ${month.toUpperCase()}`, hsp[month], sanitized);
    setHsp((prev) => ({ ...prev, [month]: sanitized }));
  };

  const handleEnvChange = (key: keyof EnvironmentData, value: string) => {
    logChange(key, env[key], value);
    setEnv((prev) => ({ ...prev, [key]: value }));
  };

  // ── Chart Data ──
  const chartData = useMemo(
    () =>
      MONTHS.map((label, i) => ({
        month: label,
        hsp: parseFloat(hsp[MONTH_KEYS[i]]) || 0,
      })),
    [hsp]
  );

  const hasAnyHsp = chartData.some((d) => d.hsp > 0);

  // ── Export ──
  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      coordinates: {
        latitude: parseFloat(coords.latitude) || null,
        longitude: parseFloat(coords.longitude) || null,
        altitude: parseFloat(coords.altitude) || null,
      },
      hsp_monthly: Object.fromEntries(
        MONTH_KEYS.map((k, i) => [MONTHS[i], parseFloat(hsp[k]) || null])
      ),
      environment: {
        albedo: parseFloat(env.albedo),
        temperature_avg_c: parseFloat(env.temperatureAvg) || null,
        soiling_index: parseFloat(env.soilingIndex),
      },
      annual_avg_hsp:
        chartData.reduce((s, d) => s + d.hsp, 0) / 12 || null,
      changeLog: changeLog.slice(0, 50),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-irradiacao-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Annual Summary ──
  const annualAvg = useMemo(() => {
    const vals = chartData.filter((d) => d.hsp > 0);
    return vals.length ? (vals.reduce((s, d) => s + d.hsp, 0) / vals.length).toFixed(2) : "—";
  }, [chartData]);

  const annualTotal = useMemo(() => {
    const total = chartData.reduce((s, d) => s + d.hsp * 30.44, 0);
    return total > 0 ? total.toFixed(0) : "—";
  }, [chartData]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
      {/* ── Main Content ── */}
      <div className="space-y-4">
        {/* ── Header Row ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Insumos de Irradiação Solar
            </h2>
            <p className="text-xs text-muted-foreground">
              Capture dados técnicos para auditoria de dimensionamento
            </p>
          </div>
          <Button size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Exportar para Auditoria
          </Button>
        </div>

        {/* ── Row 1: Coords + Environment ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Coordinates */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Coordenadas
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Latitude</Label>
                  <Input
                    placeholder="-15.7801"
                    value={coords.latitude}
                    onChange={(e) => handleCoordChange("latitude", e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Longitude</Label>
                  <Input
                    placeholder="-47.9292"
                    value={coords.longitude}
                    onChange={(e) => handleCoordChange("longitude", e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Altitude (m)</Label>
                  <Input
                    placeholder="1172"
                    value={coords.altitude}
                    onChange={(e) => handleCoordChange("altitude", e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Environment */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Thermometer className="h-3.5 w-3.5" />
                Variáveis Ambientais
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Albedo</Label>
                  <Select
                    value={env.albedo}
                    onValueChange={(v) => handleEnvChange("albedo", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALBEDO_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Temp. Média (°C)</Label>
                  <Input
                    placeholder="25.3"
                    value={env.temperatureAvg}
                    onChange={(e) =>
                      handleEnvChange(
                        "temperatureAvg",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Droplets className="h-3 w-3" />
                    Sujidade
                  </Label>
                  <Select
                    value={env.soilingIndex}
                    onValueChange={(v) => handleEnvChange("soilingIndex", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOILING_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 2: HSP Grid ── */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sun className="h-3.5 w-3.5" />
                Horas de Sol Pleno (HSP) — kWh/m²/dia
              </CardTitle>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">
                  Média:{" "}
                  <span className="font-semibold text-foreground">{annualAvg} h</span>
                </span>
                <span className="text-muted-foreground">
                  Geração est.:{" "}
                  <span className="font-semibold text-foreground">
                    {annualTotal} kWh/m²/ano
                  </span>
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
              {MONTHS.map((label, i) => (
                <div key={label} className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground font-medium text-center block">
                    {label}
                  </Label>
                  <Input
                    placeholder="0.00"
                    value={hsp[MONTH_KEYS[i]]}
                    onChange={(e) => handleHspChange(MONTH_KEYS[i], e.target.value)}
                    className="h-8 text-xs font-mono text-center px-1"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Row 3: Chart ── */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Curva de Irradiação Anual
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            {!hasAnyHsp ? (
              <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                Preencha os valores de HSP acima para visualizar o gráfico
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="hspGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(28 95% 53%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(28 95% 53%)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(220 10% 90%)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: "hsl(220 8% 46%)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(220 8% 46%)" }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, "auto"]}
                      unit=" h"
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 11,
                        borderRadius: 8,
                        border: "1px solid hsl(220 10% 90%)",
                        boxShadow: "0 4px 12px -3px rgb(0 0 0 / 0.04)",
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)} h`, "HSP"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="hsp"
                      stroke="hsl(28 95% 53%)"
                      strokeWidth={2}
                      fill="url(#hspGradient)"
                      dot={{
                        r: 3,
                        fill: "hsl(28 95% 53%)",
                        stroke: "white",
                        strokeWidth: 2,
                      }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Sidebar: Change Log ── */}
      <Card className="xl:sticky xl:top-4 self-start">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Log de Alterações
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <ScrollArea className="h-[480px]">
            {changeLog.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Nenhuma alteração registrada
              </p>
            ) : (
              <div className="space-y-2">
                {changeLog.map((entry, i) => (
                  <div
                    key={i}
                    className="border border-border/50 rounded-md p-2 text-[10px] space-y-0.5"
                  >
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-medium text-foreground">{entry.field}</span>
                      <span>{entry.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-destructive line-through">{entry.oldValue}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-success font-medium">{entry.newValue}</span>
                    </div>
                    <div className="text-muted-foreground">por {entry.user}</div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export default IrradiationInputDashboard;
