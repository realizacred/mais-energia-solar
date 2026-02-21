import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, Clock, Shield,
  Lightbulb, TrendingUp, ChevronDown, ChevronRight, RefreshCw,
  Ban, Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ─── Types ───

interface AlertItem {
  id: string;
  tipo: "critico" | "alto" | "medio" | "info";
  titulo: string;
  descricao: string;
  concessionaria?: string;
  subgrupo?: string;
  acao?: string;
}

interface HealthStats {
  totalConcessionarias: number;
  comTarifaAtiva: number;
  semTarifaAtiva: number;
  percentCobertura: number;
  totalRegistrosAtivos: number;
  registrosZerados: number;
  vigenciaVencendo30d: number;
  vigenciaExpirada: number;
  versaoAtiva: { id: string; created_at: string; notas: string | null } | null;
  ultimaImportacao: { created_at: string; status: string; origem: string } | null;
}

// ─── Helpers ───

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function alertIcon(tipo: AlertItem["tipo"]) {
  switch (tipo) {
    case "critico": return <XCircle className="w-4 h-4 text-destructive shrink-0" />;
    case "alto": return <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />;
    case "medio": return <Clock className="w-4 h-4 text-warning shrink-0" />;
    case "info": return <Lightbulb className="w-4 h-4 text-primary shrink-0" />;
  }
}

function alertBadge(tipo: AlertItem["tipo"]) {
  const map: Record<string, { label: string; className: string }> = {
    critico: { label: "Crítico", className: "bg-destructive text-destructive-foreground" },
    alto: { label: "Alto", className: "bg-destructive/80 text-destructive-foreground" },
    medio: { label: "Médio", className: "bg-warning text-warning-foreground" },
    info: { label: "Info", className: "bg-primary/20 text-primary" },
  };
  const s = map[tipo];
  return <Badge className={cn("text-[9px] font-medium", s.className)}>{s.label}</Badge>;
}

// ─── Component ───

export function SaudeTarifariaPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [concSemTarifa, setConcSemTarifa] = useState<Array<{ id: string; nome: string; estado: string | null }>>([]);
  const [registrosZerados, setRegistrosZerados] = useState<Array<{ concessionaria: string; subgrupo: string; campo: string }>>([]);
  const [expandAlerts, setExpandAlerts] = useState(true);
  const [expandSemTarifa, setExpandSemTarifa] = useState(false);
  const [expandZerados, setExpandZerados] = useState(false);

  const runDiagnostico = useCallback(async () => {
    setLoading(true);
    try {
      // 1. All concessionárias (active)
      const { data: concs } = await supabase
        .from("concessionarias")
        .select("id, nome, estado")
        .eq("ativo", true);

      // 2. Active tariff records
      const { data: tarifas } = await supabase
        .from("concessionaria_tarifas_subgrupo")
        .select("id, concessionaria_id, subgrupo, modalidade_tarifaria, tarifa_energia, tarifa_fio_b, te_ponta, te_fora_ponta, tusd_ponta, tusd_fora_ponta, vigencia_inicio, versao_id, is_active, concessionarias!inner(nome)")
        .eq("is_active", true);

      // 3. Active version
      const { data: versaoAtiva } = await supabase
        .from("tarifa_versoes")
        .select("id, created_at, notas")
        .eq("status", "ativa")
        .maybeSingle();

      // 4. Latest import (any version)
      const { data: ultimaVersao } = await supabase
        .from("tarifa_versoes")
        .select("created_at, status, origem")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const allConcs = concs || [];
      const allTarifas = tarifas || [];

      // Compute coverage
      const concIdsComTarifa = new Set(allTarifas.map(t => t.concessionaria_id));
      const semTarifa = allConcs.filter(c => !concIdsComTarifa.has(c.id));
      const percentCobertura = allConcs.length > 0
        ? Math.round((concIdsComTarifa.size / allConcs.length) * 100)
        : 0;

      // Detect zero values
      const zeros: Array<{ concessionaria: string; subgrupo: string; campo: string }> = [];
      const camposCheck = [
        { key: "tarifa_energia", label: "Tarifa Energia", grupo: "B" },
        { key: "te_ponta", label: "TE Ponta", grupo: "A" },
        { key: "te_fora_ponta", label: "TE F.Ponta", grupo: "A" },
        { key: "tusd_ponta", label: "TUSD Ponta", grupo: "A" },
        { key: "tusd_fora_ponta", label: "TUSD F.Ponta", grupo: "A" },
      ];
      for (const t of allTarifas) {
        const isBT = t.subgrupo?.startsWith("B");
        for (const c of camposCheck) {
          if (c.grupo === "B" && !isBT) continue;
          if (c.grupo === "A" && isBT) continue;
          const val = (t as any)[c.key];
          if (val === 0 || val === null) {
            zeros.push({
              concessionaria: (t as any).concessionarias?.nome || "—",
              subgrupo: `${t.subgrupo}${t.modalidade_tarifaria ? ` - ${t.modalidade_tarifaria}` : ""}`,
              campo: c.label,
            });
          }
        }
      }

      // Detect vigência issues
      const now = new Date();
      const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      let vencendo = 0;
      let expirada = 0;
      // Check vigencia_inicio — if older than 12 months, consider "expiring"
      for (const t of allTarifas) {
        if (t.vigencia_inicio) {
          const vigDate = new Date(t.vigencia_inicio);
          const vigEnd = new Date(vigDate.getTime() + 365 * 24 * 60 * 60 * 1000); // ~1 year
          if (vigEnd < now) expirada++;
          else if (vigEnd < in30d) vencendo++;
        }
      }

      // Build stats
      const healthStats: HealthStats = {
        totalConcessionarias: allConcs.length,
        comTarifaAtiva: concIdsComTarifa.size,
        semTarifaAtiva: semTarifa.length,
        percentCobertura,
        totalRegistrosAtivos: allTarifas.length,
        registrosZerados: zeros.length,
        vigenciaVencendo30d: vencendo,
        vigenciaExpirada: expirada,
        versaoAtiva: versaoAtiva || null,
        ultimaImportacao: ultimaVersao ? {
          created_at: ultimaVersao.created_at,
          status: ultimaVersao.status,
          origem: ultimaVersao.origem,
        } : null,
      };

      // Build alerts
      const alertList: AlertItem[] = [];

      if (semTarifa.length > 0) {
        alertList.push({
          id: "sem-tarifa",
          tipo: semTarifa.length > 5 ? "critico" : "alto",
          titulo: `${semTarifa.length} concessionária(s) sem tarifa ativa`,
          descricao: "Propostas para essas concessionárias não terão valores tarifários.",
          acao: "Importe tarifas ou configure manualmente.",
        });
      }

      if (zeros.length > 0) {
        alertList.push({
          id: "zeros",
          tipo: "critico",
          titulo: `${zeros.length} valor(es) zerado(s) em tarifas ativas`,
          descricao: "TE ou TUSD = 0 pode gerar propostas com economia incorreta.",
          acao: "Revise e corrija os valores ou bloqueie a ativação.",
        });
      }

      if (expirada > 0) {
        alertList.push({
          id: "expirada",
          tipo: "alto",
          titulo: `${expirada} tarifa(s) com vigência expirada`,
          descricao: "Tarifas com vigência superior a 12 meses podem estar desatualizadas.",
          acao: "Execute uma nova sincronização ou importe tarifas atualizadas.",
        });
      }

      if (vencendo > 0) {
        alertList.push({
          id: "vencendo",
          tipo: "medio",
          titulo: `${vencendo} tarifa(s) vencem nos próximos 30 dias`,
          descricao: "Prepare uma nova importação para manter a continuidade.",
          acao: "Agende ou execute importação antes do vencimento.",
        });
      }

      if (!versaoAtiva) {
        alertList.push({
          id: "sem-versao",
          tipo: "critico",
          titulo: "Nenhuma versão de tarifa ativa",
          descricao: "O sistema não possui uma versão ativa de tarifas. Propostas não serão calculadas.",
          acao: "Acesse Versões de Tarifa e ative uma versão.",
        });
      }

      if (percentCobertura === 100 && zeros.length === 0 && expirada === 0) {
        alertList.push({
          id: "ok",
          tipo: "info",
          titulo: "Sistema tarifário saudável",
          descricao: "Todas as concessionárias possuem tarifas ativas e sem valores zerados.",
        });
      }

      setStats(healthStats);
      setAlerts(alertList);
      setConcSemTarifa(semTarifa);
      setRegistrosZerados(zeros);
    } catch (err: any) {
      toast({ title: "Erro ao carregar diagnóstico", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { runDiagnostico(); }, [runDiagnostico]);

  const alertCounts = useMemo(() => ({
    critico: alerts.filter(a => a.tipo === "critico").length,
    alto: alerts.filter(a => a.tipo === "alto").length,
    medio: alerts.filter(a => a.tipo === "medio").length,
    info: alerts.filter(a => a.tipo === "info").length,
  }), [alerts]);

  const healthColor = useMemo(() => {
    if (!stats) return "text-muted-foreground";
    if (alertCounts.critico > 0) return "text-destructive";
    if (alertCounts.alto > 0) return "text-destructive/80";
    if (alertCounts.medio > 0) return "text-warning";
    return "text-primary";
  }, [stats, alertCounts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-sm text-muted-foreground animate-pulse">
        <Activity className="w-5 h-5 mr-2 animate-spin" />
        Executando diagnóstico tarifário…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className={cn("w-5 h-5", healthColor)} />
            Saúde Tarifária
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Diagnóstico completo do sistema de tarifas — alertas, cobertura e governança.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={runDiagnostico} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Cobertura */}
          <Card className={cn("border-border/50", stats.percentCobertura < 80 && "border-destructive/30")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Cobertura</p>
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <p className={cn("text-2xl font-bold tabular-nums", stats.percentCobertura === 100 ? "text-primary" : stats.percentCobertura < 80 ? "text-destructive" : "text-foreground")}>
                {stats.percentCobertura}%
              </p>
              <Progress value={stats.percentCobertura} className="h-1.5 mt-2" />
              <p className="text-[10px] text-muted-foreground mt-1">
                {stats.comTarifaAtiva}/{stats.totalConcessionarias} concessionárias
              </p>
            </CardContent>
          </Card>

          {/* Registros Ativos */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Registros Ativos</p>
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-2xl font-bold tabular-nums">{stats.totalRegistrosAtivos}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Versão: {stats.versaoAtiva ? formatDate(stats.versaoAtiva.created_at) : "Nenhuma"}
              </p>
            </CardContent>
          </Card>

          {/* Valores Zerados */}
          <Card className={cn("border-border/50", stats.registrosZerados > 0 && "border-destructive/30")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Valores Zerados</p>
                {stats.registrosZerados > 0
                  ? <Ban className="w-3.5 h-3.5 text-destructive" />
                  : <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
              </div>
              <p className={cn("text-2xl font-bold tabular-nums", stats.registrosZerados > 0 ? "text-destructive" : "text-primary")}>
                {stats.registrosZerados}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {stats.registrosZerados > 0 ? "Requer correção" : "Nenhum problema"}
              </p>
            </CardContent>
          </Card>

          {/* Alertas */}
          <Card className={cn("border-border/50", alertCounts.critico > 0 && "border-destructive/30")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Alertas</p>
                <AlertTriangle className={cn("w-3.5 h-3.5", alertCounts.critico > 0 ? "text-destructive" : "text-muted-foreground")} />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold tabular-nums">{alerts.length}</p>
                {alertCounts.critico > 0 && (
                  <Badge variant="destructive" className="text-[9px]">{alertCounts.critico} crítico(s)</Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {alertCounts.critico === 0 && alertCounts.alto === 0 ? "Sem alertas graves" : "Atenção necessária"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts Section */}
      <Collapsible open={expandAlerts} onOpenChange={setExpandAlerts}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Alertas de Governança
                  <Badge variant="outline" className="text-[9px]">{alerts.length}</Badge>
                </span>
                {expandAlerts ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {alerts.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-primary/30" />
                  <p>Nenhum alerta detectado. Sistema saudável.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map(alert => (
                    <div
                      key={alert.id}
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        alert.tipo === "critico" && "border-destructive/30 bg-destructive/5",
                        alert.tipo === "alto" && "border-destructive/20 bg-destructive/3",
                        alert.tipo === "medio" && "border-warning/30 bg-warning/5",
                        alert.tipo === "info" && "border-primary/20 bg-primary/5",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {alertIcon(alert.tipo)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium">{alert.titulo}</p>
                            {alertBadge(alert.tipo)}
                          </div>
                          <p className="text-xs text-muted-foreground">{alert.descricao}</p>
                          {alert.acao && (
                            <p className="text-xs text-primary mt-1 font-medium">
                              → {alert.acao}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Concessionárias sem tarifa */}
      {concSemTarifa.length > 0 && (
        <Collapsible open={expandSemTarifa} onOpenChange={setExpandSemTarifa}>
          <Card className="border-destructive/20">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-destructive" />
                    Concessionárias sem Tarifa Ativa
                    <Badge variant="destructive" className="text-[9px]">{concSemTarifa.length}</Badge>
                  </span>
                  {expandSemTarifa ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <ScrollArea className="max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Concessionária</TableHead>
                        <TableHead className="text-[10px]">UF</TableHead>
                        <TableHead className="text-[10px]">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {concSemTarifa.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs font-medium">{c.nome}</TableCell>
                          <TableCell className="text-xs">{c.estado || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[9px]">Importar ou editar</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Registros zerados */}
      {registrosZerados.length > 0 && (
        <Collapsible open={expandZerados} onOpenChange={setExpandZerados}>
          <Card className="border-destructive/20">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Ban className="w-4 h-4 text-destructive" />
                    Valores Zerados (TE/TUSD = 0)
                    <Badge variant="destructive" className="text-[9px]">{registrosZerados.length}</Badge>
                  </span>
                  {expandZerados ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <ScrollArea className="max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Concessionária</TableHead>
                        <TableHead className="text-[10px]">Subgrupo</TableHead>
                        <TableHead className="text-[10px]">Campo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registrosZerados.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-medium">{r.concessionaria}</TableCell>
                          <TableCell className="text-xs">{r.subgrupo}</TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="text-[9px]">{r.campo} = 0</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Governance info */}
      <Card className="border-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Regras de Governança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-border/50 p-3 space-y-1.5">
              <p className="font-medium flex items-center gap-1.5">
                <Ban className="w-3 h-3 text-destructive" />
                Bloqueio de Ativação
              </p>
              <ul className="text-muted-foreground space-y-0.5 ml-4 list-disc">
                <li>TE ou TUSD = 0 bloqueiam ativação automática</li>
                <li>Cobertura &lt; 90% requer aprovação Admin + motivo</li>
                <li>Versão sem registros não pode ser ativada</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border/50 p-3 space-y-1.5">
              <p className="font-medium flex items-center gap-1.5">
                <Eye className="w-3 h-3 text-primary" />
                Auditoria Completa
              </p>
              <ul className="text-muted-foreground space-y-0.5 ml-4 list-disc">
                <li>Quem importou, ativou ou editou</li>
                <li>Quando e o que mudou (diff)</li>
                <li>Edição manual exige motivo</li>
                <li>Versão anterior sempre preservada</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
