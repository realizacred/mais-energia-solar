import { useState, useMemo } from "react";
import { 
  CreditCard, 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Plus, 
  MoreHorizontal, 
  FileText, 
  User, 
  Calendar,
  Send,
  Eye,
  Edit2,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileSearch,
  UserPlus,
  Activity,
  Calculator,
  ExternalLink
} from "lucide-react";
import { 
  useAnaliseCredito, 
  useUpdateAnaliseCredito,
  useAnaliseCreditoHistorico,
  useAnaliseCreditoDocumentos,
  type AnaliseCredito 
} from "@/hooks/useAnaliseCredito";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/formatters";
import { formatDateTime } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreditAnalysisWizard } from "./CreditAnalysisWizard";
import { useCreditSimulations } from "@/hooks/useCreditDomain";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Tabelas: analise_credito, credit_analysis_events, analise_credito_documentos, profiles, deals, leads
 * Hooks: useAnaliseCredito, useAnaliseCreditoHistorico, useAnaliseCreditoDocumentos, useCreditSimulations, useUserRole
 * Substitui: nenhum (evolução do existente)
 */

export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; actionMsg: string }> = {
  rascunho: { 
    label: "Rascunho", 
    color: "bg-muted text-muted-foreground border-muted/20", 
    icon: Clock,
    actionMsg: "Solicitação em rascunho — clique em editar para submeter."
  },
  aguardando_analise: { 
    label: "Aguardando Análise", 
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20", 
    icon: History,
    actionMsg: "Aguardando análise do gerente financeiro."
  },
  aguardando_documentos: { 
    label: "Aguardando Documentos", 
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20", 
    icon: FileText,
    actionMsg: "Ação necessária: envie os documentos solicitados para prosseguir."
  },
  aprovado_interno: { 
    label: "Aprovado Interno", 
    color: "bg-green-500/10 text-green-600 border-green-500/20", 
    icon: CheckCircle2,
    actionMsg: "Aprovado internamente — aguardando simulação ou envio EOS."
  },
  enviada_ao_banco: { 
    label: "Enviada ao Banco", 
    color: "bg-primary/10 text-primary border-primary/20", 
    icon: Send,
    actionMsg: "Proposta em análise na financeira/banco."
  },
  aprovada: { 
    label: "Aprovada", 
    color: "bg-success/10 text-success border-success/20", 
    icon: CheckCircle2,
    actionMsg: "Crédito aprovado com sucesso!"
  },
  aprovado: { 
    label: "Aprovado", 
    color: "bg-success/10 text-success border-success/20", 
    icon: CheckCircle2,
    actionMsg: "Crédito aprovado com sucesso!"
  },
  reprovada: { 
    label: "Reprovada", 
    color: "bg-destructive/10 text-destructive border-destructive/20", 
    icon: XCircle,
    actionMsg: "Solicitação reprovada pelo gerente ou banco."
  },
  reprovado: { 
    label: "Reprovado", 
    color: "bg-destructive/10 text-destructive border-destructive/20", 
    icon: XCircle,
    actionMsg: "Solicitação reprovada pelo gerente ou banco."
  },
  cancelada: { 
    label: "Cancelada", 
    color: "bg-slate-500/10 text-slate-500 border-slate-500/20", 
    icon: XCircle,
    actionMsg: "Solicitação cancelada."
  },
};

export function ProjetoCreditoTab({ dealId, leadId, clienteId, clienteCpfCnpj, valorProposta }: Props) {
  const { user } = useAuth();
  const { isAdmin, roles } = useUserRole();
  const isGerente = roles.includes("gerente");
  const canManage = isAdmin || isGerente;
  
  const { data: analises, isLoading } = useAnaliseCredito(dealId, leadId);
  const { data: simulations } = useCreditSimulations(dealId || leadId);
  const updateMutation = useUpdateAnaliseCredito();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingAnalise, setEditingAnalise] = useState<AnaliseCredito | undefined>(undefined);
  const [expandedAnaliseId, setExpandedAnaliseId] = useState<string | null>(null);

  const handleNewAnalysis = () => {
    setEditingAnalise(undefined);
    setIsWizardOpen(true);
  };

  const handleEditAnalysis = (analise: AnaliseCredito) => {
    setEditingAnalise(analise);
    setIsWizardOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[100px] w-full" />
        <Skeleton className="h-[100px] w-full" />
      </div>
    );
  }

  const latestAnalise = analises?.[0];
  const previousAnalises = analises?.slice(1) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Solicitações de Crédito
          </h3>
          <p className="text-sm text-muted-foreground">
            Acompanhe o status das análises de crédito para este projeto.
          </p>
        </div>
        <div className="flex gap-2">
          {!latestAnalise || latestAnalise.status === 'reprovado' || latestAnalise.status === 'reprovada' ? (
            <Button onClick={handleNewAnalysis} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" /> Nova Solicitação
            </Button>
          ) : null}
        </div>
      </div>

      {latestAnalise ? (
        <div className="space-y-4">
          <Card className="border-l-4 border-l-primary shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", STATUS_CONFIG[latestAnalise.status]?.color)}>
                    {(() => {
                      const Icon = STATUS_CONFIG[latestAnalise.status]?.icon || Clock;
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      Análise Atual: <Badge variant="outline" className={cn("ml-1", STATUS_CONFIG[latestAnalise.status]?.color)}>
                        {STATUS_CONFIG[latestAnalise.status]?.label}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {STATUS_CONFIG[latestAnalise.status]?.actionMsg}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">{formatBRL(latestAnalise.valor_solicitado || 0)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                    {latestAnalise.banco || "Banco não definido"} • {latestAnalise.prazo_meses} meses
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" /> Data Solicitação
                  </p>
                  <p className="text-sm font-medium">{formatDateTime(latestAnalise.created_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                    <User className="h-3 w-3" /> Gerente Responsável
                  </p>
                  <p className="text-sm font-medium">Aguardando atribuição</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Tempo em fila
                  </p>
                  <p className="text-sm font-medium">
                    {formatDistanceToNow(new Date(latestAnalise.created_at), { locale: ptBR })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" /> Valor Aprovado
                  </p>
                  <p className={cn("text-sm font-bold", latestAnalise.valor_aprovado ? "text-success" : "text-muted-foreground")}>
                    {latestAnalise.valor_aprovado ? formatBRL(latestAnalise.valor_aprovado) : "—"}
                  </p>
                </div>
              </div>

              {latestAnalise.status === 'aguardando_documentos' && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
                  <h5 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                    <FileSearch className="h-4 w-4" /> Documentos Pendentes
                  </h5>
                  <p className="text-xs text-blue-700">O gerente financeiro solicitou os seguintes documentos para prosseguir:</p>
                  <AnaliseDocsList analiseId={latestAnalise.id} />
                </div>
              )}

              {latestAnalise.status === 'reprovado' && latestAnalise.observacoes && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                  <h5 className="text-sm font-bold text-red-800 flex items-center gap-2 mb-1">
                    <XCircle className="h-4 w-4" /> Motivo da Reprovação
                  </h5>
                  <p className="text-xs text-red-700 italic">"{latestAnalise.observacoes}"</p>
                </div>
              )}

              <Separator className="opacity-50" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Histórico Recente
                  </h5>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] uppercase font-bold"
                    onClick={() => setExpandedAnaliseId(expandedAnaliseId === latestAnalise.id ? null : latestAnalise.id)}
                  >
                    {expandedAnaliseId === latestAnalise.id ? "Recolher" : "Ver Histórico Completo"}
                  </Button>
                </div>
                <AnaliseTimeline analiseId={latestAnalise.id} limit={expandedAnaliseId === latestAnalise.id ? 20 : 3} />
              </div>

              {canManage && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="gap-2" onClick={async () => await updateMutation.mutateAsync({ id: latestAnalise.id, status: 'aprovado_interno' })}>
                    <CheckCircle2 className="h-4 w-4" /> Aprovar Internamente
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => handleEditAnalysis(latestAnalise)}>
                    <FileSearch className="h-4 w-4" /> Solicitar Documentos
                  </Button>
                  <Button size="sm" variant="destructive" className="gap-2" onClick={() => handleEditAnalysis(latestAnalise)}>
                    <XCircle className="h-4 w-4" /> Reprovar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {previousAnalises.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Solicitações Anteriores</h4>
              {previousAnalises.map(analise => (
                <Card key={analise.id} className="bg-muted/20 border-muted opacity-80 hover:opacity-100 transition-opacity">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={cn("text-[10px]", STATUS_CONFIG[analise.status]?.color)}>
                        {STATUS_CONFIG[analise.status]?.label}
                      </Badge>
                      <div className="text-xs font-medium">
                        {formatBRL(analise.valor_solicitado || 0)} em {formatDateTime(analise.created_at)}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditAnalysis(analise)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CreditCard className="w-8 h-8 text-primary" />
            </div>
            <h4 className="text-lg font-semibold">Nenhuma análise iniciada</h4>
            <p className="text-sm text-muted-foreground mt-2 max-w-[300px]">
              Solicite uma análise de crédito para transformar este projeto em um contrato financiado.
            </p>
            <div className="flex gap-2 mt-6">
              <Button onClick={handleNewAnalysis} className="gap-2">
                <Plus className="h-4 w-4" /> Solicitar Financiamento
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isWizardOpen && (
        <CreditAnalysisWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          dealId={dealId}
          leadId={leadId}
          clienteId={clienteId}
          initialData={editingAnalise}
          clienteCpfCnpj={clienteCpfCnpj}
          valorReferencia={valorProposta}
        />
      )}
    </div>
  );
}

function AnaliseDocsList({ analiseId }: { analiseId: string }) {
  const { data: docs } = useAnaliseCreditoDocumentos(analiseId);
  if (!docs || docs.length === 0) return <p className="text-xs text-muted-foreground italic">Nenhum documento pendente listado.</p>;
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {docs.map((doc: any) => (
        <div key={doc.id} className="flex items-center justify-between bg-white/50 p-2 rounded border border-blue-100">
          <span className="text-xs font-medium text-blue-900">{doc.document?.name || "Documento"}</span>
          <Badge variant="outline" className="text-[9px] uppercase bg-blue-100 text-blue-700">Pendente</Badge>
        </div>
      ))}
    </div>
  );
}

function AnaliseTimeline({ analiseId, limit = 5 }: { analiseId: string, limit?: number }) {
  const { data: events, isLoading } = useAnaliseCreditoHistorico(analiseId);

  if (isLoading) return <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>;
  if (!events || events.length === 0) return <p className="text-xs text-muted-foreground italic">Nenhum evento registrado.</p>;

  return (
    <div className="space-y-4">
      {events.slice(0, limit).map((event: any, i: number) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={cn("w-2.5 h-2.5 rounded-full border-2 border-primary", i === 0 ? "bg-primary" : "bg-background")} />
            {i < Math.min(events.length, limit) - 1 && <div className="w-0.5 h-full bg-border mt-1" />}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[9px] h-4 uppercase font-bold tracking-tighter">
                {event.event_type.replace('_', ' ')}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
            <p className="text-xs font-medium mt-1">{event.actor?.nome || 'Sistema'}</p>
            {event.status_novo && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Alterou status para <span className="font-bold text-foreground">{STATUS_CONFIG[event.status_novo]?.label || event.status_novo}</span>
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

      {isWizardOpen && (
        <CreditAnalysisWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          dealId={dealId}
          leadId={leadId}
          clienteId={clienteId}
          initialData={editingAnalise}
          clienteCpfCnpj={clienteCpfCnpj}
          valorReferencia={valorProposta}
        />
      )}
    </div>
  );
}
