import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Clock, AlertTriangle, UserX, Pause, ExternalLink, Info, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CENARIO_ICONS = {
  cliente_sem_resposta: { icon: UserX, color: "text-warning", label: "Cliente sem resposta" },
  equipe_sem_resposta: { icon: AlertTriangle, color: "text-destructive", label: "Equipe sem resposta" },
  conversa_parada: { icon: Pause, color: "text-muted-foreground", label: "Conversa parada" },
};

const PRIORIDADE_COLORS: Record<string, string> = {
  urgente: "bg-destructive/20 text-destructive",
  alta: "bg-warning/20 text-warning",
  media: "bg-primary/20 text-primary",
  baixa: "bg-muted text-muted-foreground",
};

type FollowupItem = {
  id: string;
  status: string;
  scheduled_at: string;
  tentativa: number;
  conversation_id: string;
  assigned_to: string | null;
  created_at?: string;
  rule: any;
};

type ConvInfo = {
  id: string;
  cliente_nome: string | null;
  cliente_telefone: string | null;
};

interface WaFollowupWidgetProps {
  onOpenConversation?: (conversationId: string) => void;
  vendorUserId?: string | null;
}

export function WaFollowupWidget({ onOpenConversation, vendorUserId }: WaFollowupWidgetProps) {
  const [detailItem, setDetailItem] = useState<FollowupItem | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [allFilter, setAllFilter] = useState("pendente");

  const { data: allFollowups = [] } = useQuery({
    queryKey: ["wa-followup-widget", vendorUserId],
    queryFn: async () => {
      let query = supabase
        .from("wa_followup_queue")
        .select(`
          id, status, scheduled_at, tentativa, conversation_id, assigned_to, created_at,
          rule:wa_followup_rules(nome, cenario, prioridade, prazo_minutos)
        `)
        .order("scheduled_at", { ascending: true })
        .limit(100);

      if (vendorUserId) {
        query = query.eq("assigned_to", vendorUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FollowupItem[];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Single source of truth — derive pending from the same array
  const pendingFollowups = allFollowups.filter((f) => f.status === "pendente");
  const filteredAll = allFollowups.filter((f) => allFilter === "all" || f.status === allFilter);

  // Conversation info for display
  const conversationIds = [...new Set(allFollowups.map((f) => f.conversation_id).filter(Boolean))];
  const { data: conversations = [] } = useQuery({
    queryKey: ["wa-followup-convs", conversationIds],
    queryFn: async () => {
      if (conversationIds.length === 0) return [];
      const { data } = await supabase
        .from("wa_conversations")
        .select("id, cliente_nome, cliente_telefone")
        .in("id", conversationIds);
      return (data || []) as ConvInfo[];
    },
    enabled: conversationIds.length > 0,
    staleTime: 60 * 1000,
  });

  // Vendedores for name resolution
  const { data: vendedores = [] } = useQuery({
    queryKey: ["wa-followup-vendedores"],
    queryFn: async () => {
      const { data } = await supabase.from("vendedores").select("id, nome, user_id").eq("ativo", true);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const convsMap = Object.fromEntries(conversations.map((c) => [c.id, c]));

  if (pendingFollowups.length === 0) return null;

  const urgentCount = pendingFollowups.filter(
    (f) => f.rule?.prioridade === "urgente" || f.rule?.prioridade === "alta"
  ).length;

  const handleItemClick = (item: FollowupItem) => {
    if (onOpenConversation && item.conversation_id) {
      onOpenConversation(item.conversation_id);
    }
  };

  const resolveVendedorName = (assignedTo: string | null) => {
    if (!assignedTo) return "Não atribuído";
    const v = vendedores.find((v) => v.user_id === assignedTo);
    return v?.nome || "Desconhecido";
  };

  const getSlaInfo = (scheduledAt: string) => {
    const scheduled = new Date(scheduledAt);
    const now = new Date();
    const isOverdue = scheduled < now;
    const distance = formatDistanceToNow(scheduled, { locale: ptBR, addSuffix: false });
    return {
      isOverdue,
      label: isOverdue ? `Atrasado há ${distance}` : `Vence em ${distance}`,
    };
  };

  const renderItem = (item: FollowupItem, compact = true) => {
    const rule = item.rule;
    const cenario = CENARIO_ICONS[(rule?.cenario as keyof typeof CENARIO_ICONS)] || CENARIO_ICONS.cliente_sem_resposta;
    const CenarioIcon = cenario.icon;
    const conv = convsMap[item.conversation_id];
    const sla = getSlaInfo(item.scheduled_at);
    const prioridadeClass = PRIORIDADE_COLORS[rule?.prioridade] || PRIORIDADE_COLORS.media;

    return (
      <div
        key={item.id}
        className={`flex items-center gap-2.5 p-2 rounded-lg text-xs group transition-colors cursor-pointer hover:bg-muted/60 ${
          sla.isOverdue ? "bg-destructive/5 border border-destructive/10" : "bg-background/50"
        }`}
        onClick={() => handleItemClick(item)}
      >
        <CenarioIcon className={`h-3.5 w-3.5 shrink-0 ${cenario.color}`} />
        <span className="truncate flex-1 font-medium">
          {conv?.cliente_nome || conv?.cliente_telefone || "Conversa"}
        </span>
        {compact && (
          <span className="text-muted-foreground shrink-0 hidden sm:inline">
            {rule?.nome}
          </span>
        )}
        {sla.isOverdue && (
          <Tooltip>
            <TooltipTrigger>
              <Clock className="h-3 w-3 text-destructive" />
            </TooltipTrigger>
            <TooltipContent>{sla.label}</TooltipContent>
          </Tooltip>
        )}
        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailItem(item);
                }}
                className="p-1 rounded hover:bg-muted"
              >
                <Info className="h-3 w-3 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Ver detalhes</TooltipContent>
          </Tooltip>
          {onOpenConversation && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleItemClick(item);
                  }}
                  className="p-1 rounded hover:bg-muted"
                >
                  <ExternalLink className="h-3 w-3 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Abrir conversa</TooltipContent>
            </Tooltip>
          )}
        </div>
        {!compact && (
          <Badge className={`text-[9px] px-1.5 py-0 ${prioridadeClass}`}>
            {rule?.prioridade || "media"}
          </Badge>
        )}
        <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
      </div>
    );
  };

  return (
    <>
      <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Follow-ups Pendentes</h3>
            <Badge className="bg-warning/20 text-warning text-[10px] px-1.5 py-0">
              {pendingFollowups.length}
            </Badge>
            {urgentCount > 0 && (
              <Badge className="bg-destructive/20 text-destructive text-[10px] px-1.5 py-0">
                {urgentCount} urgente{urgentCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-primary hover:underline"
          >
            Ver todos →
          </button>
        </div>

        <div className="space-y-1.5">
          {pendingFollowups.slice(0, 5).map((item) => renderItem(item))}
          {pendingFollowups.length > 5 && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-[10px] text-primary hover:underline text-center pt-1"
            >
              +{pendingFollowups.length - 5} outros follow-ups pendentes
            </button>
          )}
        </div>
      </div>

      {/* Detail Drawer */}
      <Sheet open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Detalhes do Follow-up
            </SheetTitle>
          </SheetHeader>
          {detailItem && (() => {
            const rule = detailItem.rule;
            const conv = convsMap[detailItem.conversation_id];
            const sla = getSlaInfo(detailItem.scheduled_at);
            const cenario = CENARIO_ICONS[(rule?.cenario as keyof typeof CENARIO_ICONS)] || CENARIO_ICONS.cliente_sem_resposta;
            const prioridadeClass = PRIORIDADE_COLORS[rule?.prioridade] || PRIORIDADE_COLORS.media;

            return (
              <div className="mt-6 space-y-4">
                {/* Client */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                  <p className="text-sm font-medium">{conv?.cliente_nome || conv?.cliente_telefone || "—"}</p>
                </div>
                <Separator />

                {/* Rule */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Regra</p>
                  <p className="text-sm font-medium">{rule?.nome || "—"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] gap-1">
                      {cenario.label}
                    </Badge>
                    <Badge className={`text-[10px] ${prioridadeClass}`}>
                      {rule?.prioridade || "media"}
                    </Badge>
                  </div>
                  {rule?.prazo_minutos && (
                    <p className="text-xs text-muted-foreground mt-1">Prazo: {rule.prazo_minutos} min</p>
                  )}
                </div>
                <Separator />

                {/* SLA */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">SLA</p>
                  <p className={`text-sm font-semibold ${sla.isOverdue ? "text-destructive" : "text-success"}`}>
                    {sla.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Agendado: {format(new Date(detailItem.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Separator />

                {/* Status & Metadata */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <Badge variant="outline" className="text-[10px]">{detailItem.status}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Tentativa</p>
                    <p className="text-sm">{detailItem.tentativa || 1}ª</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Responsável</p>
                    <p className="text-sm">{resolveVendedorName(detailItem.assigned_to)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Criado em</p>
                    <p className="text-sm">
                      {detailItem.created_at
                        ? format(new Date(detailItem.created_at), "dd/MM HH:mm", { locale: ptBR })
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* Action */}
                {onOpenConversation && detailItem.conversation_id && (
                  <>
                    <Separator />
                    <Button
                      className="w-full"
                      onClick={() => {
                        onOpenConversation(detailItem.conversation_id);
                        setDetailItem(null);
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir conversa
                    </Button>
                  </>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Full list Drawer */}
      <Sheet open={showAll} onOpenChange={setShowAll}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Todos os Follow-ups
              <Badge className="bg-warning/20 text-warning text-[10px] px-1.5 py-0 ml-1">
                {allFollowups.length}
              </Badge>
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Select value={allFilter} onValueChange={setAllFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="enviado">Enviados</SelectItem>
                <SelectItem value="respondido">Respondidos</SelectItem>
              </SelectContent>
            </Select>
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-1">
                {filteredAll.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum follow-up neste filtro.</p>
                ) : (
                  filteredAll.map((item) => renderItem(item, false))
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
