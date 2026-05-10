import { useFollowUpQueue, FollowUpItem } from "@/hooks/useFollowUpQueue";
import { useUpdateAiContext } from "@/hooks/useUpdateAiContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Pause, Play, UserCheck, Eye, Loader2, AlertCircle } from "lucide-react";

interface FollowUpIAViewProps {
  onSelectConversation: (conversationId: string) => void;
}

export function FollowUpIAView({ onSelectConversation }: FollowUpIAViewProps) {
  const { data: queue = [], isLoading, isRefetching } = useFollowUpQueue();
  const { updateContext, isLoading: isUpdating } = useUpdateAiContext();

  const handleUpdateStatus = (item: FollowUpItem, newContext: FollowUpItem['ai_context'], motivo: string) => {
    updateContext({
      conversationId: item.conversation_id,
      novoContexto: newContext,
      motivo,
      origem: 'humano'
    });
  };

  const counters = {
    total: queue.length,
    needsAttention: queue.filter(i => i.ai_context === 'needs_human_review').length,
    active: queue.filter(i => i.ai_context === 'ai_active').length,
    paused: queue.filter(i => i.ai_context === 'ai_paused').length,
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground space-y-2">
        <MessageSquare className="w-12 h-12 opacity-20" />
        <p>Nenhum acompanhamento na fila no momento.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b">
        <div className="bg-card p-3 rounded-lg border shadow-sm">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Total na Fila</p>
          <p className="text-2xl font-bold">{counters.total}</p>
        </div>
        <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20 shadow-sm">
          <p className="text-xs text-destructive uppercase font-semibold">Precisa de Atenção</p>
          <p className="text-2xl font-bold text-destructive">{counters.needsAttention}</p>
        </div>
        <div className="bg-success/10 p-3 rounded-lg border border-success/20 shadow-sm">
          <p className="text-xs text-success uppercase font-semibold">IA Ativa</p>
          <p className="text-2xl font-bold text-success">{counters.active}</p>
        </div>
        <div className="bg-warning/10 p-3 rounded-lg border border-warning/20 shadow-sm">
          <p className="text-xs text-warning uppercase font-semibold">IA Pausada</p>
          <p className="text-2xl font-bold text-warning">{counters.paused}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isRefetching && (
          <div className="flex items-center justify-center text-xs text-muted-foreground animate-pulse">
            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
            Atualizando fila...
          </div>
        )}

        {queue.map((item) => (
          <Card key={item.id} className={`overflow-hidden transition-all border-l-4 ${
            item.ai_context === 'needs_human_review' ? 'border-l-destructive shadow-md' : 
            item.ai_context === 'ai_paused' ? 'border-l-warning' : 
            'border-l-success'
          }`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{item.cliente_nome || 'Cliente sem nome'}</CardTitle>
                    <StatusBadge status={item.ai_context} />
                  </div>
                  <p className="text-sm text-muted-foreground">{item.cliente_telefone}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Próxima Tentativa</p>
                  <p className="text-sm font-semibold">
                    {item.queue_item?.scheduled_at 
                      ? format(new Date(item.queue_item.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })
                      : 'Não agendado'}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted/30 p-2 rounded-md border text-xs">
                  <p className="font-semibold mb-1 opacity-70">Contexto Operacional</p>
                  <p><strong>Projeto:</strong> {item.projeto?.nome || '—'}</p>
                  <p><strong>Proposta:</strong> {item.proposta?.titulo || '—'}</p>
                  {item.queue_item?.motivo_followup && (
                    <p className="mt-1 text-primary"><strong>Gatilho:</strong> {item.queue_item.motivo_followup}</p>
                  )}
                </div>
                <div className="bg-muted/30 p-2 rounded-md border text-xs">
                  <p className="font-semibold mb-1 opacity-70">Última Mensagem Enviada</p>
                  <p className="italic">
                    {item.last_sent_message?.content 
                      ? `"${item.last_sent_message.content.substring(0, 80)}${item.last_sent_message.content.length > 80 ? '...' : ''}"`
                      : 'Nenhuma mensagem enviada recentemente.'}
                  </p>
                </div>
              </div>

              {item.ai_context === 'needs_human_review' && item.ai_context_reason && (
                <div className="flex items-start gap-2 p-3 bg-destructive/5 rounded-lg border border-destructive/10 text-destructive text-sm italic">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{item.ai_context_reason}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t justify-between">
                <div className="flex gap-2">
                  {/* Action Buttons based on state */}
                  {item.ai_context === 'human_active' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleUpdateStatus(item, 'ai_active', 'Devolvido para automação pelo usuário')}
                      disabled={isUpdating}
                    >
                      <Play className="w-4 h-4 mr-2" /> Devolver para IA
                    </Button>
                  )}

                  {(item.ai_context === 'ai_active' || item.ai_context === 'needs_human_review') && (
                    <Button 
                      size="sm" 
                      variant={item.ai_context === 'needs_human_review' ? 'destructive' : 'secondary'}
                      onClick={() => handleUpdateStatus(item, 'human_active', 'Assumido pelo humano para resposta direta')}
                      disabled={isUpdating}
                    >
                      <UserCheck className="w-4 h-4 mr-2" /> Assumir
                    </Button>
                  )}

                  {item.ai_context === 'ai_active' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleUpdateStatus(item, 'ai_paused', 'Pausado manualmente para verificação')}
                      disabled={isUpdating}
                    >
                      <Pause className="w-4 h-4 mr-2" /> Pausar IA
                    </Button>
                  )}

                  {item.ai_context === 'ai_paused' && (
                    <>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleUpdateStatus(item, 'human_active', 'Assumido pelo humano após pausa')}
                        disabled={isUpdating}
                      >
                        <UserCheck className="w-4 h-4 mr-2" /> Assumir
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleUpdateStatus(item, 'ai_active', 'Retomado para automação pelo usuário')}
                        disabled={isUpdating}
                      >
                        <Play className="w-4 h-4 mr-2" /> Retomar IA
                      </Button>
                    </>
                  )}
                </div>

                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="ml-auto"
                  onClick={() => onSelectConversation(item.conversation_id)}
                >
                  <Eye className="w-4 h-4 mr-2" /> Abrir conversa
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: FollowUpItem['ai_context'] }) {
  const configs: Record<string, { label: string, variant: "destructive" | "warning" | "success" | "secondary" | "default" }> = {
    needs_human_review: { label: "Atenção", variant: "destructive" },
    ai_paused: { label: "Pausada", variant: "warning" },
    ai_active: { label: "IA Ativa", variant: "success" },
    waiting_customer: { label: "Aguardando", variant: "secondary" },
    human_active: { label: "Em Atendimento", variant: "default" },
  };

  const config = configs[status] || { label: status, variant: "default" };

  return (
    <Badge variant={config.variant} className="font-medium">
      {config.label}
    </Badge>
  );
}
