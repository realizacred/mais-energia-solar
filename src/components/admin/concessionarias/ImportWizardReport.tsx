import { useState } from "react";
import {
  FileText, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  BarChart3, ShieldCheck, Columns, Users, Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ImportReports } from "./importReportGenerator";

interface ImportWizardReportProps {
  reports: ImportReports;
  onClose: () => void;
}

type ReportTab = "resumo" | "concessionarias" | "colunas" | "sanidade";

export function ImportWizardReport({ reports, onClose }: ImportWizardReportProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>("resumo");

  const { resumo, concessionarias, errosColunas, sanidade } = reports;

  const tabs: { id: ReportTab; label: string; icon: React.ReactNode; badge?: number; color?: string }[] = [
    { id: "resumo", label: "Resumo", icon: <BarChart3 className="w-3.5 h-3.5" /> },
    {
      id: "concessionarias", label: "Não Importadas", icon: <Users className="w-3.5 h-3.5" />,
      badge: concessionarias.items.length, color: concessionarias.items.length > 0 ? "text-warning" : undefined,
    },
    {
      id: "colunas", label: "Erros Coluna", icon: <Columns className="w-3.5 h-3.5" />,
      badge: errosColunas.items.length, color: errosColunas.items.length > 0 ? "text-destructive" : undefined,
    },
    {
      id: "sanidade", label: "Sanidade", icon: <ShieldCheck className="w-3.5 h-3.5" />,
      badge: sanidade.teTusdZero + sanidade.valoresSuspeitosMwh,
      color: (sanidade.teTusdZero + sanidade.valoresSuspeitosMwh) > 0 ? "text-warning" : undefined,
    },
  ];

  const handleDownloadCSV = () => {
    const lines = [
      "Relatório de Importação ANEEL",
      `Arquivo: ${resumo.nomeArquivo}`,
      `Tipo: ${resumo.tipoArquivo}`,
      `Data: ${new Date(resumo.dataImportacao).toLocaleString("pt-BR")}`,
      "",
      "== RESUMO ==",
      `Linhas lidas: ${resumo.totalLinhasLidas}`,
      `Linhas válidas: ${resumo.totalLinhasValidas}`,
      `Linhas rejeitadas: ${resumo.totalLinhasRejeitadas}`,
      `Concessionárias no arquivo: ${resumo.totalConcessionariasArquivo}`,
      `Mapeadas: ${resumo.totalMapeadas}`,
      `Não mapeadas: ${resumo.totalNaoMapeadas}`,
      `Taxa de mapeamento: ${resumo.taxaMapeamento}%`,
      `Registros importados: ${resumo.registrosImportados}`,
      "",
      "== CONCESSIONÁRIAS NÃO IMPORTADAS ==",
      ...concessionarias.items.map(c => `${c.nomeArquivo} | ${c.motivo} | ${c.acaoRecomendada}`),
      "",
      "== ERROS DE COLUNA ==",
      ...errosColunas.items.map(e => `${e.colunaEsperada} | ${e.colunaEncontrada ?? "não encontrada"} | ${e.taxaPreenchimento}% | ${e.sugestao}`),
      "",
      "== SANIDADE DE VALORES ==",
      `TE/TUSD zerados: ${sanidade.teTusdZero}`,
      `Valores suspeitos (MWh?): ${sanidade.valoresSuspeitosMwh}`,
      `Campos vazios críticos: ${sanidade.camposVaziosCriticos}`,
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-import-${resumo.nomeArquivo.replace(/\.[^.]+$/, "")}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <FileText className="w-4 h-4 text-primary" />
          Relatório da Importação
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleDownloadCSV}>
          <Download className="w-3 h-3" />
          Baixar CSV
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all",
              activeTab === tab.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <Badge variant="secondary" className={cn("text-[8px] h-4 px-1", tab.color)}>
                {tab.badge}
              </Badge>
            )}
          </button>
        ))}
      </div>

      <Separator />

      {/* Tab content */}
      <ScrollArea className="max-h-[45vh]">
        <div className="pr-3">
          {activeTab === "resumo" && <ReportResumo data={resumo} />}
          {activeTab === "concessionarias" && <ReportConc data={concessionarias} />}
          {activeTab === "colunas" && <ReportColunas data={errosColunas} />}
          {activeTab === "sanidade" && <ReportSanidade data={sanidade} />}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Resumo Tab ──
function ReportResumo({ data }: { data: ImportReports["resumo"] }) {
  const mappingColor = data.taxaMapeamento >= 90 ? "text-success" : data.taxaMapeamento >= 70 ? "text-warning" : "text-destructive";

  return (
    <div className="space-y-3">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard label="Linhas Lidas" value={data.totalLinhasLidas} />
        <KpiCard label="Válidas" value={data.totalLinhasValidas} color="text-success" />
        <KpiCard label="Rejeitadas" value={data.totalLinhasRejeitadas} color="text-destructive" />
        <KpiCard label="Importadas" value={data.registrosImportados} color="text-primary" />
      </div>

      {/* Mapping rate */}
      <div className="p-3 rounded-lg border bg-muted/20 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Taxa de Mapeamento</span>
          <span className={cn("font-bold font-mono text-lg", mappingColor)}>{data.taxaMapeamento}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", 
              data.taxaMapeamento >= 90 ? "bg-success" : data.taxaMapeamento >= 70 ? "bg-warning" : "bg-destructive"
            )}
            style={{ width: `${data.taxaMapeamento}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{data.totalMapeadas} mapeadas</span>
          <span>{data.totalNaoMapeadas} não mapeadas</span>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
        <DetailRow label="Tipo" value={data.tipoArquivo} />
        <DetailRow label="Arquivo" value={data.nomeArquivo} />
        <DetailRow label="Grupo A (MT)" value={String(data.grupoA)} />
        <DetailRow label="Grupo B (BT)" value={String(data.grupoB)} />
        <DetailRow label="Avisos" value={String(data.totalLinhasAvisos)} />
        <DetailRow label="Erros Persist." value={String(data.errosPersistencia)} />
      </div>

      {data.vigenciasDetectadas.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground">Vigências detectadas:</span>
          <div className="flex flex-wrap gap-1">
            {data.vigenciasDetectadas.map((v, i) => (
              <Badge key={i} variant="outline" className="text-[9px] font-mono">{v}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Concessionárias não importadas Tab ──
function ReportConc({ data }: { data: ImportReports["concessionarias"] }) {
  if (data.items.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-success/10 border border-success/20 text-[11px] text-success">
        <CheckCircle2 className="w-4 h-4" />
        Todas as concessionárias foram mapeadas com sucesso.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Estas concessionárias foram encontradas no arquivo mas não possuem correspondência no sistema:
      </p>
      <div className="space-y-1.5">
        {data.items.map((item, i) => (
          <div key={i} className="p-2.5 rounded-lg border bg-warning/5 border-warning/15 space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
              <span className="text-[11px] font-bold font-mono">{item.nomeArquivo}</span>
            </div>
            <p className="text-[10px] text-muted-foreground pl-5">{item.motivo}</p>
            <p className="text-[10px] text-primary pl-5">→ {item.acaoRecomendada}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Erros de coluna Tab ──
function ReportColunas({ data }: { data: ImportReports["errosColunas"] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (data.items.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-success/10 border border-success/20 text-[11px] text-success">
        <CheckCircle2 className="w-4 h-4" />
        Todas as colunas foram detectadas e mapeadas corretamente.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.items.map((item, i) => {
        const isOpen = expanded === item.colunaEsperada;
        const isMissing = !item.colunaEncontrada;

        return (
          <div key={i} className={cn(
            "rounded-lg border p-2.5 space-y-1 cursor-pointer transition-colors",
            isMissing ? "bg-destructive/5 border-destructive/15" : "bg-warning/5 border-warning/15",
          )} onClick={() => setExpanded(isOpen ? null : item.colunaEsperada)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isMissing ? <XCircle className="w-3.5 h-3.5 text-destructive" /> : <AlertTriangle className="w-3.5 h-3.5 text-warning" />}
                <span className="text-[11px] font-bold">{item.colunaEsperada}</span>
                {item.colunaEncontrada && (
                  <span className="text-[10px] text-muted-foreground">→ "{item.colunaEncontrada}"</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isMissing && (
                  <Badge variant="outline" className="text-[9px] font-mono">{item.taxaPreenchimento}%</Badge>
                )}
                {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground pl-5">{item.sugestao}</p>
            {isOpen && item.exemplosInvalidos.length > 0 && (
              <div className="pl-5 pt-1 space-y-0.5">
                {item.exemplosInvalidos.map((ex, j) => (
                  <p key={j} className="text-[9px] font-mono text-destructive/80">{ex}</p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sanidade Tab ──
function ReportSanidade({ data }: { data: ImportReports["sanidade"] }) {
  const hasIssues = data.teTusdZero > 0 || data.valoresSuspeitosMwh > 0 || data.camposVaziosCriticos > 0;

  if (!hasIssues) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-success/10 border border-success/20 text-[11px] text-success">
        <CheckCircle2 className="w-4 h-4" />
        Nenhuma anomalia detectada nos valores importados.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.teTusdZero > 0 && (
        <SanidadeSection
          icon={<XCircle className="w-3.5 h-3.5 text-destructive" />}
          title={`${data.teTusdZero} registro(s) com TE + TUSD = 0`}
          description="Valores zerados podem indicar linha de dado incompleto ou erro de parse."
          severity="destructive"
        >
          {data.detalhesTeTusdZero.map((d, i) => (
            <p key={i} className="text-[9px] font-mono text-muted-foreground">
              {d.agente} | {d.subgrupo} | {d.campo}
            </p>
          ))}
        </SanidadeSection>
      )}

      {data.valoresSuspeitosMwh > 0 && (
        <SanidadeSection
          icon={<AlertTriangle className="w-3.5 h-3.5 text-warning" />}
          title={`${data.valoresSuspeitosMwh} valor(es) suspeitos (possível MWh não convertido)`}
          description="Valores > R$ 1,00/kWh são incomuns e podem indicar que a unidade original é R$/MWh."
          severity="warning"
        >
          {data.detalhesSuspeitos.slice(0, 10).map((d, i) => (
            <p key={i} className="text-[9px] font-mono text-muted-foreground">
              {d.agente} | {d.subgrupo} | {d.campo}: R$ {d.valor.toFixed(4)}
            </p>
          ))}
        </SanidadeSection>
      )}

      {data.camposVaziosCriticos > 0 && (
        <SanidadeSection
          icon={<AlertTriangle className="w-3.5 h-3.5 text-warning" />}
          title={`${data.camposVaziosCriticos} linha(s) com campos críticos vazios`}
          description="Linhas onde campos obrigatórios estão faltando."
          severity="warning"
        />
      )}
    </div>
  );
}

// ── Helpers ──
function KpiCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg bg-muted/30 border p-2.5 text-center">
      <div className={cn("text-base font-bold font-mono", color)}>{value.toLocaleString("pt-BR")}</div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}:</span>
      <span className="truncate text-foreground">{value}</span>
    </>
  );
}

function SanidadeSection({
  icon, title, description, severity, children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  severity: "destructive" | "warning";
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-1",
      severity === "destructive" ? "bg-destructive/5 border-destructive/15" : "bg-warning/5 border-warning/15",
    )}>
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setOpen(!open)}>
        {icon}
        <span className="text-[11px] font-bold flex-1">{title}</span>
        {children && (open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
      </div>
      <p className="text-[10px] text-muted-foreground pl-5">{description}</p>
      {open && children && (
        <div className="pl-5 pt-1 space-y-0.5 max-h-32 overflow-y-auto">{children}</div>
      )}
    </div>
  );
}
