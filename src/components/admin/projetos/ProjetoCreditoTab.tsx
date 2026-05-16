import { useState } from "react";
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
  Edit2
} from "lucide-react";
import { 
  useAnaliseCredito, 
  useUpdateAnaliseCredito, 
  type AnaliseCredito 
} from "@/hooks/useAnaliseCredito";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

interface Props {
  dealId?: string | null;
  leadId?: string | null;
  clienteId?: string | null;
  clienteCpfCnpj?: string | null;
  valorProposta?: number | null;
}

export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  rascunho: { label: "Rascunho", color: "bg-muted text-muted-foreground border-muted/20", icon: Clock },
  pendente_documentos: { label: "Pendente Docs", color: "bg-warning/10 text-warning border-warning/20", icon: FileText },
  pronto_para_envio: { label: "Pronto p/ Envio", color: "bg-info/10 text-info border-info/20", icon: CheckCircle2 },
  enviada_ao_banco: { label: "Enviada ao Banco", color: "bg-primary/10 text-primary border-primary/20", icon: Send },
  em_analise: { label: "Em Análise", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: History },
  aprovado: { label: "Aprovado", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  aprovado_com_condicoes: { label: "Aprovado c/ Condições", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: CheckCircle2 },
  reprovado: { label: "Reprovado", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  cancelado: { label: "Cancelado", color: "bg-slate-500/10 text-slate-500 border-slate-500/20", icon: XCircle },
  pendente: { label: "Pendente", color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
};

export function ProjetoCreditoTab({ dealId, leadId, clienteId, clienteCpfCnpj, valorProposta }: Props) {
  const { isAdmin, roles } = useUserRole();
  const isGerente = roles.includes("gerente");
  const canManage = isAdmin || isGerente;
  
  const { data: analises, isLoading } = useAnaliseCredito(dealId, leadId);
  const updateMutation = useUpdateAnaliseCredito();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingAnalise, setEditingAnalise] = useState<AnaliseCredito | undefined>(undefined);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Análise de Crédito
          </h3>
          <p className="text-sm text-muted-foreground">
            Gerencie as solicitações de financiamento e crédito para este projeto.
          </p>
        </div>
        <Button onClick={handleNewAnalysis} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" /> Nova Análise
        </Button>
      </div>

      {latestAnalise && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase">Status Atual</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={cn("px-2 py-0.5", STATUS_CONFIG[latestAnalise.status]?.color)}>
                  {STATUS_CONFIG[latestAnalise.status]?.label}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase">Valor Solicitado</p>
              <p className="text-xl font-bold mt-1">{formatBRL(latestAnalise.valor_solicitado || 0)}</p>
            </CardContent>
          </Card>
          <Card className={cn("border-l-4 shadow-sm", latestAnalise.valor_aprovado ? "border-l-success" : "border-l-muted")}>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase">Valor Aprovado</p>
              <p className="text-xl font-bold mt-1">
                {latestAnalise.valor_aprovado ? formatBRL(latestAnalise.valor_aprovado) : "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {analises && analises.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">Histórico de Solicitações</h4>
          </div>
          <div className="grid gap-3">
            {analises.map((analise) => {
              const config = STATUS_CONFIG[analise.status] || STATUS_CONFIG.rascunho;
              const Icon = config.icon;
              
              return (
                <Card key={analise.id} className="group hover:border-primary/30 transition-colors shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    <div className={cn("w-1 sm:w-1.5", config.color.split(' ')[0])} />
                    <CardContent className="p-4 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-inner", config.color)}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-base">{analise.banco || "Banco não definido"}</span>
                              <Badge variant="outline" className={cn("text-[10px] uppercase font-bold tracking-wider", config.color)}>
                                {config.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <User className="h-3 w-3" />
                                {analise.cpf_cnpj || "Sem CPF/CNPJ"}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                {formatDateTime(analise.created_at)}
                              </div>
                              {analise.protocolo_banco && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted rounded-full">
                                  <span className="font-semibold text-[10px]">PROT:</span> {analise.protocolo_banco}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="hidden sm:flex flex-col items-end text-right">
                            <span className="text-xs text-muted-foreground font-medium uppercase">Solicitado</span>
                            <span className="text-sm font-bold">{formatBRL(analise.valor_solicitado || 0)}</span>
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleEditAnalysis(analise)}>
                                <Eye className="mr-2 h-4 w-4" /> Detalhes / Editar
                              </DropdownMenuItem>
                              {canManage && (
                                <>
                                  <DropdownMenuItem onClick={() => handleEditAnalysis(analise)}>
                                    <Edit2 className="mr-2 h-4 w-4" /> Editar / Gerenciar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-success"
                                    onClick={async () => {
                                      await updateMutation.mutateAsync({ id: analise.id, status: 'aprovado' });
                                    }}
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar (Direto)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={async () => {
                                      await updateMutation.mutateAsync({ id: analise.id, status: 'reprovado' });
                                    }}
                                  >
                                    <XCircle className="mr-2 h-4 w-4" /> Reprovar (Direto)
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      
                      {analise.observacoes && (
                        <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground border-l-2 border-muted italic">
                          "{analise.observacoes}"
                        </div>
                      )}
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CreditCard className="w-8 h-8 text-primary" />
            </div>
            <h4 className="text-lg font-semibold">Sem análises registradas</h4>
            <p className="text-sm text-muted-foreground mt-2 max-w-[300px]">
              Este projeto ainda não possui nenhuma solicitação de crédito. Inicie uma agora para acelerar o fechamento.
            </p>
            <Button onClick={handleNewAnalysis} className="mt-6 gap-2">
              <Plus className="h-4 w-4" /> Nova Análise de Crédito
            </Button>
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
