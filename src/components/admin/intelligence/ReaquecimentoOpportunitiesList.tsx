import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useReaquecimentoOportunidades,
  useUpdateReaquecimentoStatus,
  useRunReaquecimentoManual,
} from "@/hooks/useReaquecimento";
import { getCurrentTenantId } from "@/lib/storagePaths";
import { formatBRL } from "@/lib/formatters";
import { toast } from "sonner";
import { Clock, Flame, Snowflake, Send, Trash2, FileText, Play, Loader2, Copy, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-warning/10 text-warning border-warning/20" },
  rascunho_criado: { label: "Rascunho", className: "bg-info/10 text-info border-info/20" },
  enviado: { label: "Enviado", className: "bg-success/10 text-success border-success/20" },
  convertido: { label: "Convertido", className: "bg-primary/10 text-primary border-primary/20" },
  descartado: { label: "Descartado", className: "bg-muted text-muted-foreground border-border" },
};

export function ReaquecimentoOpportunitiesList() {
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("pendente");
  const { data: oportunidades, isLoading } = useReaquecimentoOportunidades(
    statusFilter ? { status: statusFilter } : undefined
  );
  const updateStatus = useUpdateReaquecimentoStatus();
  const runManual = useRunReaquecimentoManual();

  const handleCopyMessage = (msg: string) => {
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada!");
  };

  const handleUpdateStatus = (id: string, status: string) => {
    updateStatus.mutate({ id, status }, {
      onSuccess: () => toast.success(`Status atualizado para "${STATUS_LABELS[status]?.label || status}"`),
      onError: () => toast.error("Erro ao atualizar status"),
    });
  };

  const handleRunManual = () => {
    if (!profile?.tenant_id) return;
    runManual.mutate(profile.tenant_id, {
      onSuccess: (data) => toast.success(`Análise concluída: ${JSON.stringify(data?.resultados?.[0]?.processados || 0)} leads processados`),
      onError: () => toast.error("Erro ao executar análise"),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Oportunidades de Reaquecimento</h2>
          <p className="text-sm text-muted-foreground">
            Leads inativos com potencial de conversão identificados automaticamente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="rascunho_criado">Rascunho</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="convertido">Convertido</SelectItem>
              <SelectItem value="descartado">Descartado</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunManual}
            disabled={runManual.isPending}
          >
            {runManual.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            Analisar agora
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!oportunidades || oportunidades.length === 0) && (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Snowflake className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma oportunidade encontrada</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Execute a análise manualmente ou aguarde o cron diário
            </p>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <div className="space-y-3">
        {oportunidades?.map((op, i) => {
          const statusCfg = STATUS_LABELS[op.status] || STATUS_LABELS.pendente;
          return (
            <motion.div
              key={op.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
            >
              <Card className="bg-card border-border hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Left: Lead info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{op.lead?.lead_code}</span>
                        <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
                          {statusCfg.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-info/10 text-info border-info/20">
                          <Clock className="w-3 h-3 mr-1" />
                          {op.meses_inativos} meses inativo
                        </Badge>
                        {op.urgencia_score >= 70 && (
                          <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                            <Flame className="w-3 h-3 mr-1" />
                            Urgência {op.urgencia_score}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-foreground truncate">{op.lead?.nome || "Lead"}</p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="block font-medium text-foreground">{formatBRL(op.valor_perdido_acumulado)}</span>
                          Valor perdido
                        </div>
                        <div>
                          <span className="block font-medium text-foreground">
                            {op.novo_valor_projeto ? formatBRL(op.novo_valor_projeto) : "—"}
                          </span>
                          Novo valor projeto
                        </div>
                        <div>
                          <span className="block font-medium text-foreground">
                            {op.economia_potencial_12m ? formatBRL(op.economia_potencial_12m) : "—"}
                          </span>
                          Economia 12m
                        </div>
                        <div>
                          <span className="block font-medium text-foreground">{op.temperamento_detectado}</span>
                          Temperamento
                        </div>
                      </div>
                    </div>

                    <Separator className="lg:hidden" />

                    {/* Right: Message + actions */}
                    <div className="lg:w-[320px] shrink-0 space-y-3">
                      <div className="bg-muted/30 border border-border rounded-lg p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Mensagem sugerida</p>
                        <p className="text-xs text-foreground leading-relaxed line-clamp-3">{op.mensagem_sugerida}</p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyMessage(op.mensagem_sugerida)}>
                                <Copy className="w-4 h-4 text-primary" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copiar mensagem</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {op.status === "pendente" && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(op.id, "rascunho_criado")}>
                              <FileText className="w-3.5 h-3.5 mr-1" /> Rascunho
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(op.id, "enviado")}>
                              <Send className="w-3.5 h-3.5 mr-1" /> Enviado
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-destructive text-destructive hover:bg-destructive/10"
                              onClick={() => handleUpdateStatus(op.id, "descartado")}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Descartar
                            </Button>
                          </>
                        )}
                        {op.status === "enviado" && (
                          <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(op.id, "convertido")}>
                            <MessageSquare className="w-3.5 h-3.5 mr-1" /> Convertido
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
