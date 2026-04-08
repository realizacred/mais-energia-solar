/**
 * ConsultorDashboard — Personalized consultant dashboard.
 * §26: Header. §27: KPI cards. §4: Tables. §12: Skeletons. §23: staleTime. RB-13: Brasília.
 */
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useConsultorDashboard } from "@/hooks/useConsultorDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Flame, CalendarClock, FileText, Phone, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatters/index";

export default function ConsultorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useConsultorDashboard(user?.id);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMes, setExportMes] = useState(String(new Date().getMonth() + 1));
  const [exportAno, setExportAno] = useState(String(new Date().getFullYear()));
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!user?.id) return;
    setExporting(true);
    try {
      const { data: consultor, error: cErr } = await supabase
        .from("consultores")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (cErr || !consultor) throw new Error("Consultor não encontrado");

      const res = await supabase.functions.invoke("generate-consultant-report", {
        body: { consultor_id: consultor.id, mes: Number(exportMes), ano: Number(exportAno) },
      });
      if (res.error) throw res.error;

      const blob = new Blob([res.data], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-${exportMes}-${exportAno}.html`;
      a.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
      toast.success("Relatório gerado com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar relatório");
    } finally {
      setExporting(false);
    }
  };

  const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  return (
    <div className="w-full space-y-6 p-4 md:p-6">
      {/* §26 Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Meu Painel</h1>
            <p className="text-sm text-muted-foreground">Seus leads e metas</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
          <Download className="w-4 h-4 mr-2" />
          Exportar Relatório
        </Button>
      </div>

      {/* Export Dialog — §25-S1, RB-07 */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Exportar Relatório
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Mês</label>
              <Select value={exportMes} onValueChange={setExportMes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Ano</label>
              <Select value={exportAno} onValueChange={setExportAno}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportOpen(false)} disabled={exporting}>
              Cancelar
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? "Gerando..." : "Gerar Relatório"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* §27 KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard icon={<User className="w-5 h-5" />} value={data?.kpis.totalLeads ?? 0} label="Meus Leads" color="primary" />
          <KPICard icon={<Flame className="w-5 h-5" />} value={data?.kpis.hotLeads ?? 0} label="Hot Leads" color="destructive" />
          <KPICard icon={<CalendarClock className="w-5 h-5" />} value={data?.kpis.followUpsHoje ?? 0} label="Follow-ups Atrasados" color="warning" />
          <KPICard icon={<FileText className="w-5 h-5" />} value={data?.kpis.propostasEnviadasMes ?? 0} label="Propostas no Mês" color="success" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hot Leads */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="w-4 h-4 text-destructive" /> Leads Quentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
            ) : !data?.hotLeads.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum lead quente no momento</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-foreground">Nome</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Score</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Último contato</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.hotLeads.map(lead => (
                      <TableRow key={lead.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/admin/leads`)}>
                        <TableCell className="font-medium text-foreground">{lead.nome}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                            🔥 {lead.score}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {lead.updated_at ? formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true, locale: ptBR }) : "—"}
                        </TableCell>
                        <TableCell>
                          {lead.telefone && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${lead.telefone?.replace(/\D/g, "")}`, "_blank"); }}>
                              <Phone className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Follow-ups */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" /> Follow-ups Atrasados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
            ) : !data?.overdueFollowUps.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum follow-up atrasado 🎉</p>
            ) : (
              <div className="space-y-2">
                {data.overdueFollowUps.map(f => (
                  <FollowUpRow key={f.id} followUp={f} userId={user?.id} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Funnel Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Meu Funil</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}</div>
          ) : !data?.funnelStages.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum dado de funil disponível</p>
          ) : (
            <FunnelBars stages={data.funnelStages} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const KPI_COLOR_MAP: Record<string, { border: string; iconBg: string; iconText: string }> = {
  primary:     { border: "border-l-primary",     iconBg: "bg-primary/10",     iconText: "text-primary" },
  destructive: { border: "border-l-destructive", iconBg: "bg-destructive/10", iconText: "text-destructive" },
  warning:     { border: "border-l-warning",     iconBg: "bg-warning/10",     iconText: "text-warning" },
  success:     { border: "border-l-success",     iconBg: "bg-success/10",     iconText: "text-success" },
  info:        { border: "border-l-info",        iconBg: "bg-info/10",        iconText: "text-info" },
};

function KPICard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  const c = KPI_COLOR_MAP[color] ?? KPI_COLOR_MAP.primary;
  return (
    <Card className={`border-l-[3px] ${c.border} bg-card shadow-sm hover:shadow-md transition-shadow`}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.iconBg} ${c.iconText} shrink-0`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{value}</p>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FollowUpRow({ followUp, userId }: { followUp: { id: string; lead_id: string; lead_nome: string; descricao: string | null; data_agendada: string }; userId?: string }) {
  const queryClient = useQueryClient();
  const conclude = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("lead_atividades")
        .update({ concluido: true } as any)
        .eq("id", followUp.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultor-dashboard"] });
      toast.success("Follow-up concluído!");
    },
  });

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{followUp.lead_nome}</p>
        <p className="text-xs text-muted-foreground truncate">{followUp.descricao || "Sem descrição"}</p>
        <p className="text-xs text-destructive mt-0.5">
          Vencido em {formatDate(followUp.data_agendada)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => conclude.mutate()}
        disabled={conclude.isPending}
      >
        <CheckCircle2 className="w-4 h-4 text-success" />
      </Button>
    </div>
  );
}

function FunnelBars({ stages }: { stages: { nome: string; cor: string | null; count: number }[] }) {
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <div key={stage.nome} className="flex items-center gap-3">
          <div className="w-32 shrink-0 text-sm text-foreground font-medium truncate">{stage.nome}</div>
          <div className="flex-1 bg-muted rounded-full h-7 overflow-hidden">
            <div
              className="h-full rounded-full flex items-center px-3 transition-all duration-500"
              style={{
                width: `${Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 8 : 0)}%`,
                backgroundColor: stage.cor || "hsl(var(--primary))",
              }}
            >
              {stage.count > 0 && (
                <span className="text-xs font-bold text-white drop-shadow-sm">{stage.count}</span>
              )}
            </div>
          </div>
          {stage.count === 0 && <span className="text-xs text-muted-foreground w-6 text-right">0</span>}
        </div>
      ))}
    </div>
  );
}
