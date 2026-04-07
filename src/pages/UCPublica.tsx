/**
 * UCPublica — Public page for a UC accessed via shareable token.
 * Route: /uc/:token
 * No authentication required.
 */
import { useState, useMemo, useCallback } from "react";
import { usePublicGdData } from "@/hooks/usePublicGdData";
import { GdPublicDashboard } from "@/components/public/gd/GdPublicDashboard";
import { PortalValueHeader } from "@/components/public/PortalValueHeader";
import { PortalSavingsHighlight } from "@/components/public/PortalSavingsHighlight";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUCPublicToken, useUCPublicMonitoring, useUCPublicInvoices, useUCPublicTarifa, type SiblingUC, type ResolvedUC } from "@/hooks/useUCPublicData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Legend,
} from "recharts";
import {
  Building2, Zap, DollarSign, Leaf, TrendingUp, FileText, Sun, Wifi,
  Gauge, Activity, Download, Calendar, ArrowDownUp, Clock, BatteryCharging,
  BarChart3, Info,
} from "lucide-react";
import { toast } from "sonner";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const BANDEIRA_LABELS: Record<string, string> = {
  verde: "Verde", amarela: "Amarela", vermelha_1: "Vermelha 1", vermelha_2: "Vermelha 2",
};
const BANDEIRA_COLORS: Record<string, string> = {
  verde: "text-success", amarela: "text-warning", vermelha_1: "text-destructive", vermelha_2: "text-destructive",
};

const PAPEL_GD_LABELS: Record<string, string> = {
  geradora: "Geradora", beneficiaria: "Beneficiária", mista: "Mista",
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

function derivePlantStatusSimple(lastSeenAt: string | null, isActive: boolean): { label: string; color: string } {
  if (!isActive) return { label: "Inativa", color: "text-muted-foreground" };
  if (!lastSeenAt) return { label: "Sem dados", color: "text-muted-foreground" };
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours <= 2) return { label: "Online", color: "text-success" };
  if (diffHours <= 6) return { label: "Standby", color: "text-warning" };
  return { label: "Offline", color: "text-destructive" };
}

function deriveMeterStatusSimple(onlineStatus: string | null, lastSeenAt: string | null): { label: string; color: string } {
  if (onlineStatus === "online") {
    if (lastSeenAt) {
      const diffHours = (Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60);
      if (diffHours <= 2) return { label: "Conectado", color: "text-success" };
    }
    return { label: "Online", color: "text-success" };
  }
  if (lastSeenAt) {
    const diffHours = (Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60);
    if (diffHours <= 2) return { label: "Conectado", color: "text-success" };
    if (diffHours <= 6) return { label: "Intermitente", color: "text-warning" };
  }
  return { label: "Desconectado", color: "text-destructive" };
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Agora";
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

interface SiblingUC {
  unit_id: string;
  unit_name: string;
  codigo_uc: string;
  papel_gd: string | null;
  token: string;
}

interface ResolvedUC {
  unit_id: string;
  unit_name: string;
  codigo_uc: string;
  concessionaria_nome: string;
  tipo_uc: string;
  tenant_id: string;
  brand: { logo_url?: string; color_primary?: string; company_name?: string };
  ultima_leitura_data?: string | null;
  ultima_leitura_kwh_03?: number | null;
  ultima_leitura_kwh_103?: number | null;
  potencia_kwp?: number | null;
  categoria_gd?: string | null;
  papel_gd?: string | null;
  siblings?: SiblingUC[];
}

export default function UCPublica() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: gdData, isLoading: loadingGd } = usePublicGdData(token ?? null);

  const { data: resolved, isLoading: loadingToken, error: tokenError } = useQuery({
    queryKey: ["uc_public_token", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_uc_client_token", { p_token: token! });
      if (error) throw error;
      const parsed = data as any;
      if (parsed?.error) throw new Error(parsed.error);
      return parsed as ResolvedUC;
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 10,
  });

  const { data: monitoring } = useQuery({
    queryKey: ["uc_public_monitoring", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_uc_monitoring", { p_token: token! });
      if (error) throw error;
      const parsed = data as any;
      if (parsed?.error) return null;
      return parsed as {
        plants: Array<{ id: string; name: string; installed_power_kwp: number; is_active: boolean; last_seen_at: string | null; provider_id: string; allocation_percent: number }>;
        meters: Array<{ id: string; name: string; model: string; manufacturer: string; serial_number: string; online_status: string | null; last_seen_at: string | null; last_reading_at: string | null }>;
        daily: Array<{ date: string; energy_kwh: number; peak_power_kw: number }>;
        today_kwh: number;
        month_kwh: number;
      };
    },
    enabled: !!token && !!resolved,
    staleTime: 1000 * 60 * 2,
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["uc_public_invoices", resolved?.unit_id, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_invoices")
        .select("id, reference_month, reference_year, energy_consumed_kwh, energy_injected_kwh, compensated_kwh, total_amount, bandeira_tarifaria, due_date, has_file, pdf_file_url, current_balance_kwh, previous_balance_kwh, status, estimated_savings_brl")
        .eq("unit_id", resolved!.unit_id)
        .eq("reference_year", Number(selectedYear))
        .order("reference_month", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!resolved?.unit_id,
    staleTime: 1000 * 60 * 5,
  });

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

  const handleDownloadPdf = useCallback(async (invoiceId: string, pdfUrl: string | null, month: number, year: number) => {
    if (!pdfUrl) {
      toast.error("PDF não disponível para esta fatura.");
      return;
    }
    setDownloadingId(invoiceId);
    try {
      const { data, error } = await supabase.storage
        .from("faturas-energia")
        .createSignedUrl(pdfUrl, 60);
      if (error || !data?.signedUrl) throw new Error("Erro ao gerar link de download");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = `fatura-${MONTHS[month - 1]}-${year}.pdf`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Download iniciado!");
    } catch {
      toast.error("Não foi possível baixar o PDF.");
    } finally {
      setDownloadingId(null);
    }
  }, []);

  // Economy calculations
  const stats = useMemo(() => {
    if (!invoices.length) return null;
    let totalEconomia = 0, totalCompensado = 0, totalConsumo = 0, totalInjected = 0;
    invoices.forEach((inv: any) => {
      const comp = Number(inv.compensated_kwh || 0);
      totalCompensado += comp;
      const savings = Number(inv.estimated_savings_brl || 0);
      totalEconomia += savings > 0 ? savings : comp * tarifa;
      totalConsumo += Number(inv.energy_consumed_kwh || 0);
      totalInjected += Number(inv.energy_injected_kwh || 0);
    });
    const avgPercent = totalConsumo > 0 ? (totalCompensado / (totalConsumo + totalCompensado)) * 100 : 0;
    const co2 = totalCompensado * 0.0817;
    return { totalEconomia, totalCompensado, avgPercent, co2, totalConsumo, totalInjected };
  }, [invoices, tarifa]);

  // Charts
  const chartData = useMemo(() => {
    return invoices.map((inv: any) => {
      const comp = Number(inv.compensated_kwh || 0);
      const consumed = Number(inv.energy_consumed_kwh || 0);
      const savings = Number(inv.estimated_savings_brl || 0);
      const economia = savings > 0 ? savings : comp * tarifa;
      const pct = (consumed + comp) > 0 ? (comp / (consumed + comp)) * 100 : 0;
      return {
        mes: MONTHS[(inv.reference_month ?? 1) - 1],
        "Economia (R$)": Math.round(economia * 100) / 100,
        "Aproveitamento (%)": Math.round(pct * 10) / 10,
      };
    });
  }, [invoices, tarifa]);

  const energyChartData = useMemo(() => {
    return invoices.map((inv: any) => ({
      mes: MONTHS[(inv.reference_month ?? 1) - 1],
      "Consumo": Math.round(Number(inv.energy_consumed_kwh || 0)),
      "Compensado": Math.round(Number(inv.compensated_kwh || 0)),
      "Injetado": Math.round(Number(inv.energy_injected_kwh || 0)),
    }));
  }, [invoices]);

  const dailyChartData = useMemo(() => {
    if (!monitoring?.daily?.length) return [];
    return monitoring.daily.map((d) => {
      const date = new Date(d.date + "T12:00:00");
      const dayName = WEEKDAYS[date.getDay()];
      const dayNum = date.getDate();
      return {
        label: `${dayName} ${dayNum}`,
        "Geração (kWh)": Math.round((d.energy_kwh ?? 0) * 10) / 10,
        "Pico (kW)": Math.round((d.peak_power_kw ?? 0) * 100) / 100,
      };
    });
  }, [monitoring?.daily]);

  const years = Array.from({ length: 4 }, (_, i) => String(currentYear - i));

  const hasPlants = monitoring?.plants && monitoring.plants.length > 0;
  const hasMeters = monitoring?.meters && monitoring.meters.length > 0;
  const hasMonitoring = hasPlants || hasMeters;

  // Derive brand accent color for dynamic styling
  const brandPrimary = resolved?.brand?.color_primary;

  // Loading
  if (loadingToken) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 flex justify-center">
        <div className="w-full max-w-4xl space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

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
  const latestInvoice = invoices.length > 0 ? invoices[invoices.length - 1] as any : null;
  const siblings = (resolved.siblings || []).filter((s: SiblingUC) => s.unit_id !== resolved.unit_id);
  const hasSiblings = siblings.length > 0;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* ═══ HEADER ═══ */}
        <header
          className="border-b border-border px-4 md:px-8 py-4 sticky top-0 z-10"
          style={{
            backgroundColor: brandPrimary ? brandPrimary : undefined,
            color: brandPrimary ? "#fff" : undefined,
          }}
        >
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            {brand?.logo_url && (
              <img src={brand.logo_url} alt={brand.company_name || ""} className="h-9 w-auto object-contain" />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold truncate" style={{ color: brandPrimary ? "#fff" : undefined }}>
                {brand?.company_name || "Energia Solar"}
              </h1>
              <p className="text-xs opacity-80">Portal do Cliente — Unidade Consumidora</p>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">

          {/* ═══ UC SWITCHER ═══ */}
          {hasSiblings && (
            <Card className="border border-primary/20 bg-primary/5">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-2 shrink-0">
                    <ArrowDownUp className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-foreground">Trocar unidade:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {/* Current UC */}
                    <Badge className="text-xs bg-primary text-primary-foreground cursor-default">
                      {resolved.unit_name}
                      {resolved.papel_gd && <span className="ml-1 opacity-70">({PAPEL_GD_LABELS[resolved.papel_gd] || resolved.papel_gd})</span>}
                    </Badge>
                    {/* Sibling UCs */}
                    {siblings.map((sib: SiblingUC) => (
                      <Badge
                        key={sib.unit_id}
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={() => navigate(`/uc/${sib.token}`)}
                      >
                        {sib.unit_name}
                        {sib.papel_gd && <span className="ml-1 opacity-60">({PAPEL_GD_LABELS[sib.papel_gd] || sib.papel_gd})</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══ UC INFO HERO ═══ */}
          <Card className="overflow-hidden">
            <div
              className="p-4 sm:p-5"
              style={{
                background: brandPrimary
                  ? `linear-gradient(135deg, ${brandPrimary}15, ${brandPrimary}08)`
                  : undefined,
              }}
            >
              <div className="flex items-start sm:items-center gap-3 flex-wrap sm:flex-nowrap">
                <div
                  className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: brandPrimary ? `${brandPrimary}20` : undefined }}
                >
                  <Building2 className="h-5 w-5" style={{ color: brandPrimary || undefined }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground truncate text-base sm:text-lg">{resolved.unit_name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                    <span>UC: <span className="font-mono font-medium text-foreground">{resolved.codigo_uc}</span></span>
                    {resolved.concessionaria_nome && <span>· {resolved.concessionaria_nome}</span>}
                    {resolved.potencia_kwp && <span>· <span className="font-medium text-foreground">{Number(resolved.potencia_kwp).toLocaleString("pt-BR")} kWp</span></span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {resolved.papel_gd && (
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                      {PAPEL_GD_LABELS[resolved.papel_gd] || resolved.papel_gd}
                    </Badge>
                  )}
                  {resolved.categoria_gd && (
                    <Badge variant="outline" className="text-xs border-success/30 text-success">
                      {resolved.categoria_gd}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* ═══ COMMERCIAL VALUE HEADER ═══ */}
          <PortalValueHeader
            unitName={resolved.unit_name}
            codigoUc={resolved.codigo_uc}
            hasGd={gdData?.has_gd ?? false}
            totalSavingsYear={stats?.totalEconomia}
          />

          {/* ═══ METER READINGS (03 & 103) ═══ */}
          {(resolved.ultima_leitura_kwh_03 != null || resolved.ultima_leitura_kwh_103 != null) && (
            <Card className="border-l-[3px] border-l-info">
              <CardHeader className="pb-2 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-info" /> Leitura do Medidor
                  {resolved.ultima_leitura_data && (
                    <span className="text-xs font-normal text-muted-foreground ml-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(resolved.ultima_leitura_data + "T12:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Registro 03 — Consumo */}
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <ArrowDownUp className="w-4 h-4 text-destructive" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Registro 03</p>
                        <p className="text-xs font-semibold text-foreground">Consumo (Ativa)</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold font-mono text-foreground">
                      {resolved.ultima_leitura_kwh_03 != null
                        ? Number(resolved.ultima_leitura_kwh_03).toLocaleString("pt-BR", { maximumFractionDigits: 0 })
                        : "—"
                      }
                      <span className="text-sm font-normal text-muted-foreground ml-1">kWh</span>
                    </p>
                  </div>

                  {/* Registro 103 — Injeção */}
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                        <BatteryCharging className="w-4 h-4 text-success" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Registro 103</p>
                        <p className="text-xs font-semibold text-foreground">Injeção (Geração)</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold font-mono text-foreground">
                      {resolved.ultima_leitura_kwh_103 != null
                        ? Number(resolved.ultima_leitura_kwh_103).toLocaleString("pt-BR", { maximumFractionDigits: 0 })
                        : "—"
                      }
                      <span className="text-sm font-normal text-muted-foreground ml-1">kWh</span>
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Valores acumulados do medidor bidirecional. Registro 03 = energia consumida da rede. Registro 103 = energia injetada (geração solar).
                </p>
              </CardContent>
            </Card>
          )}

          {/* ═══ MONITORING SECTION ═══ */}
          {hasMonitoring && (
            <>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="text-base sm:text-lg font-bold text-foreground">Monitoramento em Tempo Real</h2>
              </div>

              {/* Generation KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-l-[3px] border-l-primary">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sun className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-[11px] sm:text-xs text-muted-foreground">Geração Hoje</span>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-foreground font-mono">
                      {(monitoring?.today_kwh ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                      <span className="text-xs font-normal text-muted-foreground ml-1">kWh</span>
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-[3px] border-l-info">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="w-3.5 h-3.5 text-info shrink-0" />
                      <span className="text-[11px] sm:text-xs text-muted-foreground">Geração Mês</span>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-foreground font-mono">
                      {(monitoring?.month_kwh ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      <span className="text-xs font-normal text-muted-foreground ml-1">kWh</span>
                    </p>
                  </CardContent>
                </Card>

                {hasPlants && (
                  <Card className="border-l-[3px] border-l-success">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Wifi className="w-3.5 h-3.5 text-success shrink-0" />
                        <span className="text-[11px] sm:text-xs text-muted-foreground">Usina</span>
                      </div>
                      {monitoring!.plants.map((plant) => {
                        const status = derivePlantStatusSimple(plant.last_seen_at, plant.is_active);
                        return (
                          <div key={plant.id} className="flex items-center gap-1.5">
                            <span className={`text-sm font-bold ${status.color}`}>● {status.label}</span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {hasMeters && (
                  <Card className="border-l-[3px] border-l-warning">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Gauge className="w-3.5 h-3.5 text-warning shrink-0" />
                        <span className="text-[11px] sm:text-xs text-muted-foreground">Medidor</span>
                      </div>
                      {monitoring!.meters.map((meter) => {
                        const status = deriveMeterStatusSimple(meter.online_status, meter.last_seen_at);
                        return (
                          <div key={meter.id} className="flex items-center gap-1.5">
                            <span className={`text-sm font-bold ${status.color}`}>● {status.label}</span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Plants detail */}
              {hasPlants && (
                <Card>
                  <CardHeader className="pb-2 px-4">
                    <CardTitle className="text-sm flex items-center gap-2"><Sun className="w-4 h-4 text-primary" /> Usinas Vinculadas</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="font-semibold text-foreground">Usina</TableHead>
                            <TableHead className="font-semibold text-foreground text-right">Potência</TableHead>
                            <TableHead className="font-semibold text-foreground">Status</TableHead>
                            <TableHead className="font-semibold text-foreground hidden sm:table-cell">Última comunicação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monitoring!.plants.map((plant) => {
                            const status = derivePlantStatusSimple(plant.last_seen_at, plant.is_active);
                            return (
                              <TableRow key={plant.id} className="hover:bg-muted/30">
                                <TableCell className="font-medium text-foreground text-sm">{plant.name}</TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {plant.installed_power_kwp ? `${Number(plant.installed_power_kwp).toLocaleString("pt-BR")} kWp` : "—"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-xs ${status.color}`}>
                                    {status.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                                  {timeAgo(plant.last_seen_at)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Meters detail */}
              {hasMeters && (
                <Card>
                  <CardHeader className="pb-2 px-4">
                    <CardTitle className="text-sm flex items-center gap-2"><Gauge className="w-4 h-4 text-warning" /> Medidores</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="font-semibold text-foreground">Medidor</TableHead>
                            <TableHead className="font-semibold text-foreground hidden sm:table-cell">Modelo</TableHead>
                            <TableHead className="font-semibold text-foreground">Status</TableHead>
                            <TableHead className="font-semibold text-foreground hidden sm:table-cell">Última leitura</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monitoring!.meters.map((meter) => {
                            const status = deriveMeterStatusSimple(meter.online_status, meter.last_seen_at);
                            return (
                              <TableRow key={meter.id} className="hover:bg-muted/30">
                                <TableCell className="font-medium text-foreground text-sm">{meter.name || meter.serial_number || "—"}</TableCell>
                                <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                                  {[meter.manufacturer, meter.model].filter(Boolean).join(" ") || "—"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-xs ${status.color}`}>
                                    {status.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                                  {timeAgo(meter.last_reading_at || meter.last_seen_at)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 7-day generation chart */}
              {dailyChartData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 px-4">
                    <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Geração — Últimos 7 dias</CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-4">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={dailyChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <RechartsTooltip content={<ChartTooltip />} />
                        <Bar dataKey="Geração (kWh)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ═══ GD DASHBOARD ═══ */}
          {(gdData?.has_gd || loadingGd) && (
            <GdPublicDashboard
              gdData={gdData!}
              isLoading={loadingGd}
              brandPrimary={brandPrimary}
            />
          )}

          {/* ═══ SAVINGS HIGHLIGHT ═══ */}
          {latestInvoice && (() => {
            const comp = Number(latestInvoice.compensated_kwh || 0);
            const savings = Number(latestInvoice.estimated_savings_brl || 0);
            const economia = savings > 0 ? savings : comp * tarifa;
            const monthIdx = (latestInvoice.reference_month ?? 1) - 1;
            return (
              <PortalSavingsHighlight
                savingsBrl={economia}
                monthLabel={`${MONTHS_FULL[monthIdx]} ${latestInvoice.reference_year}`}
                compensatedKwh={comp}
              />
            );
          })()}

          {/* ═══ ECONOMY SECTION ═══ */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="text-base sm:text-lg font-bold text-foreground">Relatório de Economia</h2>
            </div>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-[11px] sm:text-xs text-muted-foreground">Economia Total</span>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-foreground font-mono">
                    R$ {stats.totalEconomia.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-l-[3px] border-l-info bg-card shadow-sm">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap className="w-3.5 h-3.5 text-info shrink-0" />
                    <span className="text-[11px] sm:text-xs text-muted-foreground">Compensado</span>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-foreground font-mono">
                    {stats.totalCompensado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                    <span className="text-xs font-normal text-muted-foreground ml-1">kWh</span>
                  </p>
                </CardContent>
              </Card>
              <Card className="border-l-[3px] border-l-success bg-card shadow-sm">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-success shrink-0" />
                    <span className="text-[11px] sm:text-xs text-muted-foreground">Aproveitamento</span>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-foreground font-mono">
                    {stats.avgPercent.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
              <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Leaf className="w-3.5 h-3.5 text-warning shrink-0" />
                    <span className="text-[11px] sm:text-xs text-muted-foreground">CO₂ Evitado</span>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-foreground font-mono">
                    {stats.co2.toFixed(0)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">kg</span>
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Energy Balance Chart */}
          {energyChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowDownUp className="w-4 h-4 text-primary" /> Balanço Energético Mensal
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-4">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={energyChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Bar dataKey="Consumo" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Compensado" fill="hsl(var(--success))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Injetado" fill="hsl(var(--secondary))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap items-center justify-center gap-4 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-destructive" /> Consumo</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-success" /> Compensado</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-secondary" /> Injetado</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Economy Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" /> Economia Mensal
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-4">
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Bar yAxisId="left" dataKey="Economia (R$)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="Aproveitamento (%)" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap items-center justify-center gap-4 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Economia (R$)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-success" /> Aproveitamento (%)</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══ INVOICES TABLE ═══ */}
          {loadingInvoices ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : invoices.length > 0 ? (
            <Card>
              <CardHeader className="pb-2 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Faturas
                  <span className="text-xs font-normal text-muted-foreground ml-auto">
                    {invoices.length} {invoices.length === 1 ? "fatura" : "faturas"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold text-foreground">Mês</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Consumo</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Compensado</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Injetado</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Valor</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Economia</TableHead>
                        <TableHead className="font-semibold text-foreground">Bandeira</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Vencimento</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv: any) => {
                        const comp = Number(inv.compensated_kwh || 0);
                        const savings = Number(inv.estimated_savings_brl || 0);
                        const economia = savings > 0 ? savings : comp * tarifa;
                        const injected = Number(inv.energy_injected_kwh || 0);
                        return (
                          <TableRow key={inv.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium text-sm">{MONTHS[(inv.reference_month ?? 1) - 1]}/{inv.reference_year}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {Number(inv.energy_consumed_kwh || 0).toLocaleString("pt-BR")} kWh
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-success">
                              {comp.toLocaleString("pt-BR")} kWh
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-warning">
                              {injected > 0 ? `${injected.toLocaleString("pt-BR")} kWh` : "—"}
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
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {inv.due_date ? new Date(inv.due_date + "T12:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}
                            </TableCell>
                            <TableCell>
                              {inv.has_file && inv.pdf_file_url ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      disabled={downloadingId === inv.id}
                                      onClick={() => handleDownloadPdf(inv.id, inv.pdf_file_url, inv.reference_month, inv.reference_year)}
                                    >
                                      <Download className="w-4 h-4 text-primary" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Baixar fatura PDF</TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile card list */}
                <div className="sm:hidden divide-y divide-border">
                  {invoices.map((inv: any) => {
                    const comp = Number(inv.compensated_kwh || 0);
                    const savings = Number(inv.estimated_savings_brl || 0);
                    const economia = savings > 0 ? savings : comp * tarifa;
                    const consumed = Number(inv.energy_consumed_kwh || 0);
                    const hasPdf = inv.has_file && inv.pdf_file_url;
                    return (
                      <div key={inv.id} className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-foreground">
                            {MONTHS_FULL[(inv.reference_month ?? 1) - 1]} {inv.reference_year}
                          </span>
                          <div className="flex items-center gap-2">
                            {inv.bandeira_tarifaria && (
                              <Badge variant="outline" className={`text-[10px] ${BANDEIRA_COLORS[inv.bandeira_tarifaria] || ""}`}>
                                {BANDEIRA_LABELS[inv.bandeira_tarifaria] || inv.bandeira_tarifaria}
                              </Badge>
                            )}
                            {hasPdf && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                disabled={downloadingId === inv.id}
                                onClick={() => handleDownloadPdf(inv.id, inv.pdf_file_url, inv.reference_month, inv.reference_year)}
                              >
                                <Download className="w-3 h-3" />
                                PDF
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Consumo</span>
                            <span className="font-mono">{consumed.toLocaleString("pt-BR")} kWh</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Compensado</span>
                            <span className="font-mono text-success">{comp.toLocaleString("pt-BR")} kWh</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Valor</span>
                            <span className="font-mono">{inv.total_amount != null ? `R$ ${Number(inv.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Economia</span>
                            <span className="font-mono text-success font-medium">R$ {economia.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                          </div>
                          {inv.due_date && (
                            <div className="flex justify-between col-span-2">
                              <span className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Vencimento</span>
                              <span className="text-sm">{new Date(inv.due_date + "T12:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma fatura registrada para {selectedYear}.</p>
            </Card>
          )}

          {/* Saldo GD */}
          {latestInvoice?.current_balance_kwh != null && Number(latestInvoice.current_balance_kwh) > 0 && (
            <Card className="border-l-[3px] border-l-success">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                  <BatteryCharging className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Saldo de Crédito Acumulado (GD)</p>
                  <p className="text-xl font-bold font-mono text-success">
                    {Number(latestInvoice.current_balance_kwh).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <footer className="text-center text-xs text-muted-foreground py-4 border-t border-border">
            <p>Dados atualizados automaticamente · {brand?.company_name || ""}</p>
            <p className="mt-1 opacity-60">Powered by Mais Energia Solar CRM</p>
          </footer>
        </main>
      </div>
    </TooltipProvider>
  );
}
