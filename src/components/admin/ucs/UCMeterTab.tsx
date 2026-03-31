/**
 * UCMeterTab — Shows linked meter, leitura inicial, and allows linking/unlinking.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { meterService } from "@/services/meterService";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Gauge, Link2, Link2Off, ArrowLeftRight, History, Search, Save, Info, BarChart3 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";
import { formatDecimalBR } from "@/lib/formatters";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Props {
  unitId: string;
}

export function UCMeterTab({ unitId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["unit_meter_links", unitId],
    queryFn: () => meterService.getLinksForUnit(unitId),
    staleTime: 1000 * 60 * 5,
  });

  const activeLink = links.find(l => l.is_active);
  const historyLinks = links.filter(l => !l.is_active);

  const { data: activeMeter } = useQuery({
    queryKey: ["meter_device", activeLink?.meter_device_id],
    queryFn: () => meterService.getById(activeLink!.meter_device_id),
    enabled: !!activeLink,
  });

  const { data: latestStatus } = useQuery({
    queryKey: ["meter_status_latest", activeLink?.meter_device_id],
    queryFn: () => meterService.getStatusLatest(activeLink!.meter_device_id),
    enabled: !!activeLink,
  });

  const unlinkMut = useMutation({
    mutationFn: (linkId: string) => meterService.unlinkFromUnit(linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unit_meter_links", unitId] });
      toast({ title: "Medidor desvinculado" });
    },
  });

  if (isLoading) return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {activeMeter ? (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><Gauge className="w-4 h-4" /> Medidor Vinculado</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setLinkDialogOpen(true)}>
                    <ArrowLeftRight className="w-3 h-3 mr-1" /> Trocar
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => activeLink && unlinkMut.mutate(activeLink.id)}>
                    <Link2Off className="w-3 h-3 mr-1" /> Desvincular
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Nome</p>
                  <p className="text-sm font-medium">{activeMeter.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Modelo</p>
                  <p className="text-sm">{activeMeter.model || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Provider</p>
                  <Badge variant="outline" className="text-xs capitalize">{activeMeter.provider}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge variant={activeMeter.online_status === "online" ? "success" : "destructive"} dot>
                    {activeMeter.online_status === "online" ? "Online" : "Offline"}
                  </StatusBadge>
                </div>
                {activeMeter.bidirectional_supported && (
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <Badge variant="outline" className="text-xs"><ArrowLeftRight className="w-3 h-3 mr-0.5" /> Bidirecional</Badge>
                  </div>
                )}
                {latestStatus && (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">Potência</p>
                      <p className="text-sm font-medium">{latestStatus.power_w != null ? `${latestStatus.power_w} W` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Consumo (Cód. 03)</p>
                      <p className="text-sm">{latestStatus.energy_import_kwh != null ? `${latestStatus.energy_import_kwh} kWh` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Injeção (Cód. 103)</p>
                      <p className="text-sm">{latestStatus.energy_export_kwh != null ? `${latestStatus.energy_export_kwh} kWh` : "—"}</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Leitura Inicial do Relógio Físico */}
          <LeituraInicialCard meterId={activeMeter.id} meter={activeMeter} />

          {/* Histórico de Leituras */}
          <MeterReadingsHistory meterId={activeMeter.id} />
        </>
      ) : (
        <EmptyState
          icon={Gauge}
          title="Nenhum medidor vinculado"
          description="Vincule um medidor IoT para acompanhar consumo e geração em tempo real."
          action={{ label: "Vincular Medidor", onClick: () => setLinkDialogOpen(true), icon: Link2 }}
        />
      )}

      {historyLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4" /> Histórico de Vínculos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {historyLinks.map(link => (
                <div key={link.id} className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
                  <span className="font-mono">{link.meter_device_id.slice(0, 8)}...</span>
                  <span>{formatDate(link.started_at)} → {link.ended_at ? formatDate(link.ended_at) : "—"}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {linkDialogOpen && (
        <UCMeterLinkDialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen} unitId={unitId} />
      )}
    </div>
  );
}

/** Dialog to pick a meter and link to this UC */
function UCMeterLinkDialog({ open, onOpenChange, unitId }: { open: boolean; onOpenChange: (o: boolean) => void; unitId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedMeter, setSelectedMeter] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: meters = [] } = useQuery({
    queryKey: ["available_meters", search],
    queryFn: async () => {
      const available = await meterService.getAvailableMeters();
      if (!search) return available;
      const s = search.toLowerCase();
      return available.filter(m => m.name.toLowerCase().includes(s) || m.external_device_id.toLowerCase().includes(s));
    },
  });

  async function handleLink() {
    if (!selectedMeter) return;
    setSaving(true);
    try {
      await meterService.linkToUnit(unitId, selectedMeter, "principal");
      toast({ title: "Medidor vinculado com sucesso" });
      qc.invalidateQueries({ queryKey: ["unit_meter_links", unitId] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md">
        <DialogHeader><DialogTitle>Vincular Medidor</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar medidor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="max-h-[240px] overflow-y-auto border rounded-lg">
            {meters.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum medidor disponível</p>
            ) : (
              meters.map(m => (
                <Button
                  key={m.id}
                  variant="ghost"
                  type="button"
                  onClick={() => setSelectedMeter(m.id)}
                  className={`w-full justify-start rounded-none px-3 py-2.5 h-auto text-sm border-b last:border-b-0 ${
                    selectedMeter === m.id ? "bg-primary/10 text-primary font-medium" : ""
                  }`}
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">{m.external_device_id.slice(0, 12)}</span>
                </Button>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="default" onClick={handleLink} disabled={!selectedMeter || saving}>{saving ? "Vinculando..." : "Vincular"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Sub-component: Leitura Inicial do Relógio Físico */
function LeituraInicialCard({ meterId, meter }: { meterId: string; meter: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [leitura03, setLeitura03] = useState("");
  const [leitura103, setLeitura103] = useState("");
  const [leituraData, setLeituraData] = useState("");
  const [leituraObs, setLeituraObs] = useState("");
  const [baseline, setBaseline] = useState({ l03: "", l103: "", data: "", obs: "" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (meter && !loaded) {
      const l03 = String(meter.leitura_inicial_03 || 0);
      const l103 = String(meter.leitura_inicial_103 || 0);
      const data = meter.leitura_inicial_data || "";
      const obs = meter.leitura_inicial_observacao || "";
      setLeitura03(l03);
      setLeitura103(l103);
      setLeituraData(data);
      setLeituraObs(obs);
      setBaseline({ l03, l103, data, obs });
      setLoaded(true);
    }
  }, [meter, loaded]);

  const isDirty = useMemo(() => {
    return leitura03 !== baseline.l03 || leitura103 !== baseline.l103 || leituraData !== baseline.data || leituraObs !== baseline.obs;
  }, [leitura03, leitura103, leituraData, leituraObs, baseline]);

  const saveMut = useMutation({
    mutationFn: () => meterService.updateLeituraInicial(meterId, {
      leitura_inicial_03: Number(leitura03) || 0,
      leitura_inicial_103: Number(leitura103) || 0,
      leitura_inicial_data: leituraData || null,
      leitura_inicial_observacao: leituraObs || null,
    }),
    onSuccess: () => {
      setBaseline({ l03: leitura03, l103: leitura103, data: leituraData, obs: leituraObs });
      toast({ title: "Leitura inicial salva com sucesso" });
      qc.invalidateQueries({ queryKey: ["meter_device", meterId] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err?.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="w-4 h-4 text-primary" /> Leitura Inicial do Relógio Físico
        </CardTitle>
        <CardDescription>Registre a leitura do relógio no momento da instalação do medidor IoT</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
          <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            A leitura inicial é usada para calcular o consumo real combinando os dados do relógio físico com o medidor IoT.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Leitura Posto 03 (kWh)</Label>
            <Input
              type="number"
              value={leitura03}
              onChange={(e) => setLeitura03(e.target.value)}
              placeholder="Ex: 12345"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Leitura Posto 103 (kWh)</Label>
            <Input
              type="number"
              value={leitura103}
              onChange={(e) => setLeitura103(e.target.value)}
              placeholder="Ex: 6789"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data da leitura</Label>
            <DateInput
              value={leituraData}
              onChange={setLeituraData}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Observações</Label>
          <Textarea
            value={leituraObs}
            onChange={(e) => setLeituraObs(e.target.value)}
            rows={2}
            placeholder="Observações sobre a leitura inicial..."
          />
        </div>

        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !isDirty} size="sm">
          <Save className="w-3 h-3 mr-1" />
          {saveMut.isPending ? "Salvando..." : "Salvar Leitura Inicial"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Chart Tooltip (§5-S1) ───
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{formatDecimalBR(Number(p.value), 2)}</span>
        </p>
      ))}
    </div>
  );
};

const PERIOD_OPTIONS = [
  { label: "Hoje", value: "today", days: 1 },
  { label: "7 dias", value: "7d", days: 7 },
  { label: "30 dias", value: "30d", days: 30 },
  { label: "3 meses", value: "90d", days: 90 },
] as const;

interface MeterReading {
  id: string;
  measured_at: string;
  energy_import_kwh: number | null;
  energy_export_kwh: number | null;
  power_w: number | null;
  voltage_v: number | null;
  created_at: string;
}

/** Sub-component: Histórico de Leituras */
function MeterReadingsHistory({ meterId }: { meterId: string }) {
  const [period, setPeriod] = useState<string>("7d");

  const startDate = useMemo(() => {
    const opt = PERIOD_OPTIONS.find(o => o.value === period) || PERIOD_OPTIONS[1];
    const d = new Date();
    d.setDate(d.getDate() - opt.days);
    return d.toISOString();
  }, [period]);

  const { data: readings = [], isLoading } = useQuery({
    queryKey: ["meter_readings_history", meterId, period],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("meter_readings")
        .select("id, measured_at, energy_import_kwh, energy_export_kwh, power_w, voltage_v, created_at")
        .eq("meter_device_id", meterId)
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as MeterReading[];
    },
    staleTime: 1000 * 30,
    enabled: !!meterId,
  });

  const chartData = useMemo(() => {
    return [...readings]
      .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
      .map(r => ({
        time: new Date(r.measured_at).toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
          timeZone: "America/Sao_Paulo",
        }),
        "Consumo (kWh)": r.energy_import_kwh ?? 0,
        "Injeção (kWh)": r.energy_export_kwh ?? 0,
        "Potência (kW)": r.power_w != null ? r.power_w / 1000 : 0,
      }));
  }, [readings]);

  const tableData = readings.slice(0, 50);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Histórico de Leituras
          </CardTitle>
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                variant={period === opt.value ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 px-2.5"
                onClick={() => setPeriod(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Chart */}
        {isLoading ? (
          <Skeleton className="h-[220px] w-full rounded-lg" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradImport" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradExport" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPower" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="Consumo (kWh)" stroke="hsl(var(--warning))" fill="url(#gradImport)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="Injeção (kWh)" stroke="hsl(var(--success))" fill="url(#gradExport)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="Potência (kW)" stroke="hsl(var(--primary))" fill="url(#gradPower)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhuma leitura no período selecionado
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : tableData.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground text-xs">Data/Hora</TableHead>
                  <TableHead className="font-semibold text-foreground text-xs text-right">Consumo kWh</TableHead>
                  <TableHead className="font-semibold text-foreground text-xs text-right">Injeção kWh</TableHead>
                  <TableHead className="font-semibold text-foreground text-xs text-right">Potência W</TableHead>
                  <TableHead className="font-semibold text-foreground text-xs text-right">Tensão V</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-foreground whitespace-nowrap">
                      {new Date(r.measured_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", year: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                        timeZone: "America/Sao_Paulo",
                      })}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {r.energy_import_kwh != null ? formatDecimalBR(r.energy_import_kwh, 2) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {r.energy_export_kwh != null ? formatDecimalBR(r.energy_export_kwh, 2) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {r.power_w != null ? formatDecimalBR(r.power_w, 0) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {r.voltage_v != null ? formatDecimalBR(r.voltage_v, 1) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
