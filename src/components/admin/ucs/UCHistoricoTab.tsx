/**
 * UCHistoricoTab — Historical data for a UC (meter readings, solar generation, invoices).
 * §23: staleTime, §4: empty states, §12: skeletons.
 */
import { useQuery } from "@tanstack/react-query";
import { formatDecimalBR } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { meterService } from "@/services/meterService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge, Sun, FileText, BarChart2 } from "lucide-react";
import { format } from "date-fns";
import { UCInvoicesTab } from "./UCInvoicesTab";

interface Props {
  ucId: string;
  meterId?: string | null;
  plantId?: string | null;
  /** Resolved solar_plants.id for metrics queries */
  solarPlantId?: string | null;
}

const STALE_5M = 1000 * 60 * 5;

export function UCHistoricoTab({ ucId, meterId, plantId, solarPlantId }: Props) {
  const effectivePlantId = solarPlantId || plantId;
  return (
    <Tabs defaultValue="leituras" className="space-y-4">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="leituras" className="gap-1 text-xs">
          <Gauge className="w-3.5 h-3.5" /> Leituras do Medidor
        </TabsTrigger>
        <TabsTrigger value="geracao" className="gap-1 text-xs">
          <Sun className="w-3.5 h-3.5" /> Geração Solar
        </TabsTrigger>
        <TabsTrigger value="faturas" className="gap-1 text-xs">
          <FileText className="w-3.5 h-3.5" /> Faturas
        </TabsTrigger>
      </TabsList>

      <TabsContent value="leituras">
        <MeterReadingsTable meterId={meterId} />
      </TabsContent>

      <TabsContent value="geracao">
        <SolarGenerationTable plantId={effectivePlantId} />
      </TabsContent>

      <TabsContent value="faturas">
        <UCInvoicesTab unitId={ucId} />
      </TabsContent>
    </Tabs>
  );
}

function MeterReadingsTable({ meterId }: { meterId?: string | null }) {
  const { data: readings = [], isLoading } = useQuery({
    queryKey: ["uc_historico_meter_daily", meterId],
    queryFn: () => meterService.getDailyReadings(meterId!, 60),
    enabled: !!meterId,
    staleTime: STALE_5M,
  });

  if (!meterId) {
    return <EmptyState icon={<Gauge className="w-8 h-8" />} title="Sem medidor" desc="Vincule um medidor para ver o histórico de leituras." />;
  }

  if (isLoading) {
    return <TableSkeleton rows={6} />;
  }

  if (readings.length === 0) {
    return <EmptyState icon={<BarChart2 className="w-8 h-8" />} title="Sem leituras" desc="As leituras aparecerão aqui após a primeira sincronização." />;
  }

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold text-foreground">Data</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Consumo do Dia (kWh)</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Injeção do Dia (kWh)</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Acum. Importação (kWh)</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Acum. Exportação (kWh)</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Leituras</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {readings.map((r: any) => (
            <TableRow key={r.id} className="hover:bg-muted/30">
              <TableCell className="text-sm font-mono">
                {r.reading_date ? format(new Date(r.reading_date + "T12:00:00"), "dd/MM/yyyy") : "—"}
              </TableCell>
              <TableCell className="text-sm text-right font-mono">
                {r.consumo_dia_kwh != null ? Number(r.consumo_dia_kwh).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}
              </TableCell>
              <TableCell className="text-sm text-right font-mono">
                {r.injecao_dia_kwh != null ? Number(r.injecao_dia_kwh).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}
              </TableCell>
              <TableCell className="text-sm text-right font-mono text-muted-foreground">
                {r.energy_import_kwh != null ? Number(r.energy_import_kwh).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}
              </TableCell>
              <TableCell className="text-sm text-right font-mono text-muted-foreground">
                {r.energy_export_kwh != null ? Number(r.energy_export_kwh).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}
              </TableCell>
              <TableCell className="text-sm text-right font-mono text-muted-foreground">
                {r.readings_count ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SolarGenerationTable({ plantId }: { plantId?: string | null }) {
  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ["uc_historico_plant_metrics", plantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solar_plant_metrics_daily")
        .select("id, date, energy_kwh, power_kw, total_energy_kwh")
        .eq("plant_id", plantId!)
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!plantId,
    staleTime: STALE_5M,
  });

  if (!plantId) {
    return <EmptyState icon={<Sun className="w-8 h-8" />} title="Sem usina" desc="Vincule uma usina para ver o histórico de geração." />;
  }

  if (isLoading) {
    return <TableSkeleton rows={6} />;
  }

  if (metrics.length === 0) {
    return <EmptyState icon={<BarChart2 className="w-8 h-8" />} title="Sem dados de geração" desc="Os dados serão exibidos após a importação dos dados da usina." />;
  }

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold text-foreground">Data</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Geração (kWh)</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Potência Pico (kW)</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Acumulado (kWh)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.map((m: any) => (
            <TableRow key={m.id} className="hover:bg-muted/30">
              <TableCell className="text-sm font-mono">
                {m.date ? format(new Date(m.date + "T12:00:00"), "dd/MM/yyyy") : "—"}
              </TableCell>
              <TableCell className="text-sm text-right font-mono">
                {m.energy_kwh != null ? Number(m.energy_kwh).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}
              </TableCell>
              <TableCell className="text-sm text-right font-mono">
                {m.power_kw != null ? formatDecimalBR(Number(m.power_kw), 2) : "—"}
              </TableCell>
              <TableCell className="text-sm text-right font-mono">
                {m.total_energy_kwh != null ? Number(m.total_energy_kwh).toLocaleString("pt-BR", { minimumFractionDigits: 1 }) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-muted-foreground/40 mb-3">{icon}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{desc}</p>
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}
