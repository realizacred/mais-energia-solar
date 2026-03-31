/**
 * UCComparativoTab — Estimated vs real generation comparison.
 * §27: KPI cards, §5: Recharts, §12: Skeleton, §25: Modal, §4: Table shadcn.
 */
import { useState } from "react";
import { formatNumberBR } from "@/lib/formatters";
import { useUnitComparativo, usePropostaVersoesForLink, useLinkSimulacao } from "@/hooks/useUnitComparativo";
import { useTenantSettings } from "@/hooks/useTenantSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { BarChart3, TrendingUp, TrendingDown, Activity, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
interface Props {
  unitId: string;
  simulacaoId: string | null;
}

/** §5: Custom tooltip */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">
            {typeof p.value === "number" ? p.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : p.value} kWh
          </span>
        </p>
      ))}
    </div>
  );
};

function perfColor(pct: number) {
  if (pct >= 100) return { border: "border-l-success", bg: "bg-success/10", text: "text-success" };
  if (pct >= 80) return { border: "border-l-primary", bg: "bg-primary/10", text: "text-primary" };
  return { border: "border-l-destructive", bg: "bg-destructive/10", text: "text-destructive" };
}

export function UCComparativoTab({ unitId, simulacaoId }: Props) {
  const { data, isLoading } = useUnitComparativo(unitId, simulacaoId);
  const [linkOpen, setLinkOpen] = useState(false);

  // Loading skeleton §12
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
          ))}
        </div>
        <Skeleton className="h-[220px] w-full rounded-lg" />
      </div>
    );
  }

  // Empty state: no simulacao linked
  if (!simulacaoId || !data?.simulacao) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={BarChart3}
          title="Nenhuma simulação vinculada"
          description="Vincule uma proposta para comparar a geração estimada com o consumo real."
          action={{ label: "Vincular agora", onClick: () => setLinkOpen(true), icon: Link2 }}
        />
        <LinkSimulacaoModal open={linkOpen} onOpenChange={setLinkOpen} unitId={unitId} />
      </div>
    );
  }

  // Has simulacao but no invoice data
  if (data.meses.length === 0) {
    return (
      <div className="space-y-4">
        <SimulacaoInfo simulacao={data.simulacao} onChangeClick={() => setLinkOpen(true)} />
        <EmptyState
          icon={BarChart3}
          title="Sem dados de faturas"
          description="Registre faturas na aba Faturas para visualizar o comparativo."
        />
        <LinkSimulacaoModal open={linkOpen} onOpenChange={setLinkOpen} unitId={unitId} />
      </div>
    );
  }

  const mediaColor = perfColor(data.mediaPerformance);
  const melhorColor = data.melhorMes ? perfColor(data.melhorMes.pct) : null;
  const piorColor = data.piorMes ? perfColor(data.piorMes.pct) : null;

  return (
    <div className="space-y-4">
      {/* Header §26 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Comparativo de Geração</h3>
            <p className="text-xs text-muted-foreground">Estimado vs consumo real da unidade</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)} className="gap-1.5 text-xs">
          <Link2 className="w-3.5 h-3.5" /> Alterar Simulação
        </Button>
      </div>

      {/* Simulacao info */}
      <SimulacaoInfo simulacao={data.simulacao} onChangeClick={() => setLinkOpen(true)} />

      {/* KPI Cards §27 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className={`border-l-[3px] ${mediaColor.border} bg-card shadow-sm`}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${mediaColor.bg} ${mediaColor.text} shrink-0`}>
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-foreground leading-none">
                {data.mediaPerformance}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Performance média</p>
            </div>
          </CardContent>
        </Card>

        {data.melhorMes && melhorColor && (
          <Card className={`border-l-[3px] ${melhorColor.border} bg-card shadow-sm`}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${melhorColor.bg} ${melhorColor.text} shrink-0`}>
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight text-foreground leading-none">
                  {data.melhorMes.pct}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Melhor mês ({data.melhorMes.label})</p>
              </div>
            </CardContent>
          </Card>
        )}

        {data.piorMes && piorColor && (
          <Card className={`border-l-[3px] ${piorColor.border} bg-card shadow-sm`}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${piorColor.bg} ${piorColor.text} shrink-0`}>
                <TrendingDown className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight text-foreground leading-none">
                  {data.piorMes.pct}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Pior mês ({data.piorMes.label})</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Chart §5 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Geração Estimada vs Real</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.meses} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="estimado_kwh"
                name="Estimado"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="real_kwh"
                name="Real"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Comparison table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detalhamento por Mês</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground text-xs">Mês</TableHead>
                <TableHead className="font-semibold text-foreground text-xs text-right">Estimado</TableHead>
                <TableHead className="font-semibold text-foreground text-xs text-right">Real</TableHead>
                <TableHead className="font-semibold text-foreground text-xs text-right">Diferença</TableHead>
                <TableHead className="font-semibold text-foreground text-xs text-right">Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.meses.map((m) => {
                const c = perfColor(m.performance_pct);
                return (
                  <TableRow key={m.month} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-foreground">{m.mes}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{formatNumberBR(m.estimado_kwh)} kWh</TableCell>
                    <TableCell className="text-right font-mono">{formatNumberBR(m.real_kwh)} kWh</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={m.diferenca_kwh >= 0 ? "text-success" : "text-destructive"}>
                        {m.diferenca_kwh >= 0 ? "+" : ""}{formatNumberBR(m.diferenca_kwh)} kWh
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={`text-xs ${c.text}`}>
                        {m.performance_pct}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LinkSimulacaoModal open={linkOpen} onOpenChange={setLinkOpen} unitId={unitId} />
    </div>
  );
}

/** Info card about linked simulacao */
function SimulacaoInfo({ simulacao, onChangeClick }: { simulacao: NonNullable<import("@/hooks/useUnitComparativo").ComparativoData["simulacao"]>; onChangeClick: () => void }) {
  return (
    <Card className="bg-muted/30">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Potência</p>
            <p className="font-semibold">{simulacao.potencia_kwp ? formatNumberBR(simulacao.potencia_kwp) : "—"} kWp</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Geração Mensal Estimada</p>
            <p className="font-semibold">{simulacao.geracao_mensal ? formatNumberBR(simulacao.geracao_mensal) : "—"} kWh</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Geração Anual Estimada</p>
            <p className="font-semibold">{simulacao.geracao_anual ? formatNumberBR(simulacao.geracao_anual) : "—"} kWh</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Modal to link a simulacao §25-S1 */
function LinkSimulacaoModal({ open, onOpenChange, unitId }: { open: boolean; onOpenChange: (v: boolean) => void; unitId: string }) {
  const { tenant } = useTenantSettings();
  const { data: versoes = [], isLoading } = usePropostaVersoesForLink(tenant?.id ?? null);
  const linkMut = useLinkSimulacao();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string>("");

  const handleSave = async () => {
    if (!selected) return;
    try {
      await linkMut.mutateAsync({ unitId, simulacaoId: selected });
      toast({ title: "Simulação vinculada com sucesso!" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* RB-07: w-[90vw] */}
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">Vincular Simulação</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Selecione uma proposta para comparar a geração estimada</p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : (
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma proposta..." />
                </SelectTrigger>
                <SelectContent>
                  {versoes.map((v) => {
                    const snap = v.snapshot as any;
                    const clienteNome = snap?.clienteNome ?? snap?.cliente_nome ?? snap?.nome_cliente ?? "";
                    const dateStr = v.created_at ? new Date(v.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
                    const vNum = v.versao_numero ? `v${v.versao_numero}` : "";
                    const kwp = Number(v.potencia_kwp || 0).toLocaleString("pt-BR");
                    const kwh = Number(v.geracao_mensal || 0).toLocaleString("pt-BR");
                    const label = [clienteNome, vNum, dateStr].filter(Boolean).join(" · ");
                    return (
                      <SelectItem key={v.id} value={v.id}>
                        {label || "Proposta"} — {kwp} kWp — {kwh} kWh/mês
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}

            {selected && versoes.length > 0 && (() => {
              const v = versoes.find((x) => x.id === selected);
              if (!v) return null;
              return (
                <Card className="bg-muted/30">
                  <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Potência</p>
                      <p className="font-semibold">{Number(v.potencia_kwp || 0).toLocaleString("pt-BR")} kWp</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Geração Mensal</p>
                      <p className="font-semibold">{Number(v.geracao_mensal || 0).toLocaleString("pt-BR")} kWh</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Distribuidora</p>
                      <p className="font-semibold">{v.distribuidora_nome || "—"}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={linkMut.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!selected || linkMut.isPending}>
            {linkMut.isPending ? "Salvando..." : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
