/**
 * ClosingTimeCard — Average deal closing time with breakdown by consultant.
 * §DS-02: KPI card. RB-01: semantic colors. RB-18: table overflow.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClosingTime } from "@/hooks/useCommercialMetrics";
import { Clock, TrendingDown, TrendingUp } from "lucide-react";

const PERIOD_OPTIONS = [
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "12", label: "Último ano" },
];

export function ClosingTimeCard() {
  const [months, setMonths] = useState(12);
  const { data, isLoading } = useClosingTime(months);

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full rounded-lg mb-4" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const { byConsultor, mediaGeral } = data;
  const totalDeals = byConsultor.reduce((s, c) => s + c.dealsFechados, 0);

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-info" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Tempo Médio de Fechamento</CardTitle>
            <CardDescription>{totalDeals} deals fechados no período</CardDescription>
          </div>
        </div>
        <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hero KPI */}
        <div className="text-center py-4 rounded-lg bg-muted/30 border border-border/40">
          <p className="text-4xl font-bold tracking-tight text-foreground leading-none">
            {mediaGeral > 0 ? mediaGeral : "—"}
          </p>
          <p className="text-sm text-muted-foreground mt-2">dias em média</p>
        </div>

        {/* Table by consultant */}
        {byConsultor.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground">Consultor</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Deals</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Média</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Mais rápido</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Mais lento</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">vs Média</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byConsultor.map((c) => {
                  const diff = c.diasMedio - mediaGeral;
                  const isFaster = diff < 0;
                  return (
                    <TableRow key={c.consultor} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">{c.consultor}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{c.dealsFechados}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold">{c.diasMedio}d</TableCell>
                      <TableCell className="text-right font-mono text-sm text-success">{c.maisRapido}d</TableCell>
                      <TableCell className="text-right font-mono text-sm text-destructive">{c.maisLento}d</TableCell>
                      <TableCell className="text-center">
                        {mediaGeral > 0 ? (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              isFaster
                                ? "bg-success/10 text-success border-success/20"
                                : diff === 0
                                  ? "bg-muted text-muted-foreground border-border"
                                  : "bg-warning/10 text-warning border-warning/20"
                            }`}
                          >
                            {isFaster ? <TrendingDown className="w-3 h-3 mr-1" /> : diff > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : null}
                            {diff > 0 ? "+" : ""}{diff}d
                          </Badge>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {byConsultor.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum deal fechado no período.</p>
        )}
      </CardContent>
    </Card>
  );
}
