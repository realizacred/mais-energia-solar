/**
 * UCPublica — Public page for a UC accessed via shareable token.
 * Route: /uc/:token
 * No authentication required.
 */
import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Building2, Zap, DollarSign, Leaf, TrendingUp, FileText } from "lucide-react";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const BANDEIRA_LABELS: Record<string, string> = {
  verde: "Verde", amarela: "Amarela", vermelha_1: "Vermelha 1", vermelha_2: "Vermelha 2",
};
const BANDEIRA_COLORS: Record<string, string> = {
  verde: "text-success", amarela: "text-warning", vermelha_1: "text-destructive", vermelha_2: "text-destructive",
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">
            {typeof p.value === "number" ? p.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
};

export default function UCPublica() {
  const { token } = useParams<{ token: string }>();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

  // Resolve token → UC data + brand
  const { data: resolved, isLoading: loadingToken, error: tokenError } = useQuery({
    queryKey: ["uc_public_token", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_uc_client_token", { p_token: token! });
      if (error) throw error;
      const parsed = data as any;
      if (parsed?.error) throw new Error(parsed.error);
      return parsed as {
        unit_id: string; unit_name: string; codigo_uc: string;
        concessionaria_nome: string; tipo_uc: string; tenant_id: string;
        brand: { logo_url?: string; color_primary?: string; company_name?: string };
      };
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 10,
  });

  // Fetch invoices for the UC
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["uc_public_invoices", resolved?.unit_id, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_invoices")
        .select("*")
        .eq("unit_id", resolved!.unit_id)
        .eq("reference_year", Number(selectedYear))
        .order("reference_month", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!resolved?.unit_id,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch tarifa for economy calc
  const { data: tarifaConfig } = useQuery({
    queryKey: ["public_tarifa", resolved?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("calculadora_config")
        .select("tarifa_media_kwh")
        .eq("tenant_id", resolved!.tenant_id)
        .maybeSingle();
      return data?.tarifa_media_kwh ?? 0.85;
    },
    enabled: !!resolved?.tenant_id,
    staleTime: 1000 * 60 * 15,
  });

  const tarifa = tarifaConfig ?? 0.85;

  // Economy calculations
  const stats = useMemo(() => {
    if (!invoices.length) return null;
    let totalEconomia = 0, totalCompensado = 0, totalConsumo = 0;
    invoices.forEach((inv: any) => {
      const comp = Number(inv.compensated_kwh || 0);
      totalCompensado += comp;
      totalEconomia += comp * tarifa;
      totalConsumo += Number(inv.energy_consumed_kwh || 0);
    });
    const avgPercent = totalConsumo > 0 ? (totalCompensado / (totalConsumo + totalCompensado)) * 100 : 0;
    const co2 = totalCompensado * 0.0817;
    return { totalEconomia, totalCompensado, avgPercent, co2 };
  }, [invoices, tarifa]);

  const chartData = useMemo(() => {
    return invoices.map((inv: any) => {
      const comp = Number(inv.compensated_kwh || 0);
      const consumed = Number(inv.energy_consumed_kwh || 0);
      const economia = comp * tarifa;
      const pct = (consumed + comp) > 0 ? (comp / (consumed + comp)) * 100 : 0;
      return {
        mes: MONTHS[(inv.reference_month ?? 1) - 1],
        "Economia (R$)": Math.round(economia * 100) / 100,
        "Aproveitamento (%)": Math.round(pct * 10) / 10,
      };
    });
  }, [invoices, tarifa]);

  const years = Array.from({ length: 4 }, (_, i) => String(currentYear - i));

  // Loading state
  if (loadingToken) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 flex justify-center">
        <div className="w-full max-w-4xl space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Invalid token
  if (tokenError || !resolved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-lg font-bold text-foreground mb-2">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground">
            Este link de acesso não é mais válido. Solicite um novo link ao seu consultor.
          </p>
        </Card>
      </div>
    );
  }

  const brand = resolved.brand;

  return (
    <div className="min-h-screen bg-background">
      {/* Header with brand */}
      <header className="border-b border-border bg-card px-4 md:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          {brand?.logo_url && (
            <img src={brand.logo_url} alt={brand.company_name || ""} className="h-8 w-auto object-contain" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-foreground truncate">{brand?.company_name || "Energia Solar"}</h1>
            <p className="text-xs text-muted-foreground">Portal do Cliente</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* UC Info */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground truncate">{resolved.unit_name}</p>
                <p className="text-xs text-muted-foreground">
                  Contrato: <span className="font-mono">{resolved.codigo_uc}</span> · {resolved.concessionaria_nome || "—"}
                </p>
              </div>
              <Badge variant="outline" className="text-xs shrink-0">
                {resolved.tipo_uc === "gd_geradora" ? "GD Geradora" : resolved.tipo_uc === "beneficiaria" ? "Beneficiária" : "Consumo"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Year selector */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Relatório de Economia</h2>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-l-[3px] border-l-primary">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Economia Total</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  R$ {stats.totalEconomia.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-[3px] border-l-info">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-info" />
                  <span className="text-xs text-muted-foreground">Compensado</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {stats.totalCompensado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-[3px] border-l-success">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-xs text-muted-foreground">Aproveitamento</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {stats.avgPercent.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-[3px] border-l-warning">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Leaf className="w-4 h-4 text-warning" />
                  <span className="text-xs text-muted-foreground">CO₂ Evitado</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {stats.co2.toFixed(0)} kg
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Economia Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar yAxisId="left" dataKey="Economia (R$)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="Aproveitamento (%)" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Invoice table */}
        {loadingInvoices ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : invoices.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Faturas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-foreground">Mês</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Consumo</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Compensado</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Valor Fatura</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Economia</TableHead>
                      <TableHead className="font-semibold text-foreground">Bandeira</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv: any) => {
                      const comp = Number(inv.compensated_kwh || 0);
                      const economia = comp * tarifa;
                      return (
                        <TableRow key={inv.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{MONTHS[(inv.reference_month ?? 1) - 1]}/{inv.reference_year}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {Number(inv.energy_consumed_kwh || 0).toLocaleString("pt-BR")} kWh
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {comp.toLocaleString("pt-BR")} kWh
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {inv.total_amount != null ? `R$ ${Number(inv.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-success font-medium">
                            R$ {economia.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell>
                            {inv.bandeira_tarifaria ? (
                              <Badge variant="outline" className={`text-xs ${BANDEIRA_COLORS[inv.bandeira_tarifaria] || ""}`}>
                                {BANDEIRA_LABELS[inv.bandeira_tarifaria] || inv.bandeira_tarifaria}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma fatura registrada para {selectedYear}.</p>
          </Card>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground py-4 border-t border-border">
          Dados atualizados automaticamente · {brand?.company_name || ""}
        </footer>
      </main>
    </div>
  );
}
