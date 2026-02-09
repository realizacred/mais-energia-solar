import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Clock, AlertTriangle, UserX, Pause } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";

const CENARIO_ICONS = {
  cliente_sem_resposta: { icon: UserX, color: "text-warning" },
  equipe_sem_resposta: { icon: AlertTriangle, color: "text-destructive" },
  conversa_parada: { icon: Pause, color: "text-muted-foreground" },
};

export function WaFollowupWidget() {
  const navigate = useNavigate();

  const { data: pendingFollowups = [] } = useQuery({
    queryKey: ["wa-followup-pending-widget"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_followup_queue")
        .select(`
          id, status, scheduled_at, tentativa, conversation_id, assigned_to,
          rule:wa_followup_rules(nome, cenario, prioridade)
        `)
        .eq("status", "pendente")
        .order("scheduled_at", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Also get conversations info for display
  const conversationIds = pendingFollowups.map((f) => f.conversation_id).filter(Boolean);
  const { data: conversations = [] } = useQuery({
    queryKey: ["wa-followup-convs", conversationIds],
    queryFn: async () => {
      if (conversationIds.length === 0) return [];
      const { data } = await supabase
        .from("wa_conversations")
        .select("id, cliente_nome, cliente_telefone")
        .in("id", conversationIds);
      return data || [];
    },
    enabled: conversationIds.length > 0,
    staleTime: 60 * 1000,
  });

  const convsMap = Object.fromEntries(conversations.map((c) => [c.id, c]));

  if (pendingFollowups.length === 0) return null;

  const urgentCount = pendingFollowups.filter(
    (f) => (f.rule as any)?.prioridade === "urgente" || (f.rule as any)?.prioridade === "alta"
  ).length;

  return (
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
          onClick={() => navigate("/admin/followup-wa")}
          className="text-xs text-primary hover:underline"
        >
          Ver regras →
        </button>
      </div>

      <div className="space-y-1.5">
        {pendingFollowups.slice(0, 5).map((item) => {
          const rule = item.rule as any;
          const cenario = CENARIO_ICONS[(rule?.cenario as keyof typeof CENARIO_ICONS)] || CENARIO_ICONS.cliente_sem_resposta;
          const CenarioIcon = cenario.icon;
          const conv = convsMap[item.conversation_id];
          const isOverdue = new Date(item.scheduled_at) < new Date();

          return (
            <div
              key={item.id}
              className={`flex items-center gap-2.5 p-2 rounded-lg text-xs ${
                isOverdue ? "bg-destructive/5 border border-destructive/10" : "bg-background/50"
              }`}
            >
              <CenarioIcon className={`h-3.5 w-3.5 shrink-0 ${cenario.color}`} />
              <span className="truncate flex-1 font-medium">
                {conv?.cliente_nome || conv?.cliente_telefone || "Conversa"}
              </span>
              <span className="text-muted-foreground shrink-0">
                {rule?.nome}
              </span>
              {isOverdue && (
                <Tooltip>
                  <TooltipTrigger>
                    <Clock className="h-3 w-3 text-destructive" />
                  </TooltipTrigger>
                  <TooltipContent>Atrasado</TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        })}
        {pendingFollowups.length > 5 && (
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            +{pendingFollowups.length - 5} outros follow-ups pendentes
          </p>
        )}
      </div>
    </div>
  );
}
