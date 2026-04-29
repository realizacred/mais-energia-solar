/**
 * AutomationHistoryPanel — Histórico unificado de execuções de automação.
 * Mostra logs recentes de pipeline + WhatsApp e expõe botão "Executar agora"
 * para disparar manualmente os processadores (debug/teste).
 * §RB-06 LoadingState • §RB UI tokens semânticos
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Play, RefreshCw, CheckCircle2, XCircle, Clock, MessageCircle, Kanban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type LogRow = {
  id: string;
  created_at: string;
  status: string | null;
  source: "pipeline" | "whatsapp";
  title: string;
  detail?: string | null;
  error?: string | null;
};

const StatusBadge = ({ status }: { status: string | null }) => {
  const s = (status || "").toLowerCase();
  if (s === "sucesso" || s === "success" || s === "sent" || s === "enviado") {
    return (
      <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Sucesso
      </Badge>
    );
  }
  if (s === "erro" || s === "error" || s === "failed" || s === "falha") {
    return (
      <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10">
        <XCircle className="h-3 w-3 mr-1" /> Erro
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
      <Clock className="h-3 w-3 mr-1" /> {status || "—"}
    </Badge>
  );
};

export function AutomationHistoryPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState<null | "pipeline" | "whatsapp">(null);

  const { data, isLoading } = useQuery({
    queryKey: ["automation-history"],
    queryFn: async (): Promise<LogRow[]> => {
      const [pipelineRes, waRes] = await Promise.all([
        supabase
          .from("pipeline_automation_logs")
          .select("id, created_at, status, acao_executada, erro_mensagem, detalhes")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("whatsapp_automation_logs")
          .select("id, created_at, status, telefone, mensagem_enviada, erro_detalhes")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const pipeline: LogRow[] = (pipelineRes.data || []).map((r: any) => ({
        id: r.id,
        created_at: r.created_at,
        status: r.status,
        source: "pipeline",
        title: r.acao_executada || "Ação de funil",
        detail: r.detalhes ? JSON.stringify(r.detalhes).slice(0, 140) : null,
        error: r.erro_mensagem,
      }));
      const wa: LogRow[] = (waRes.data || []).map((r: any) => ({
        id: r.id,
        created_at: r.created_at,
        status: r.status,
        source: "whatsapp",
        title: `WhatsApp → ${r.telefone || "—"}`,
        detail: r.mensagem_enviada ? r.mensagem_enviada.slice(0, 140) : null,
        error: r.erro_detalhes,
      }));

      return [...pipeline, ...wa].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 80);
    },
    staleTime: 15_000,
  });

  const runNow = async (which: "pipeline" | "whatsapp") => {
    setRunning(which);
    try {
      const fn = which === "pipeline" ? "pipeline-automations" : "process-whatsapp-automations";
      const { error } = await supabase.functions.invoke(fn, { body: { source: "manual" } });
      if (error) throw error;
      toast({
        title: "Execução disparada",
        description: `Processador "${which}" executado. Atualizando histórico...`,
      });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["automation-history"] }), 1500);
    } catch (err: any) {
      toast({
        title: "Falha ao executar",
        description: err?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-l-4 border-l-primary">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground">Executar agora</h3>
            <p className="text-xs text-muted-foreground">
              Dispara manualmente os processadores (útil para testes e debug).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => runNow("pipeline")}
              disabled={running !== null}
            >
              {running === "pipeline" ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Funil
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runNow("whatsapp")}
              disabled={running !== null}
            >
              {running === "whatsapp" ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              WhatsApp
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["automation-history"] })}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="font-semibold text-foreground text-sm">Últimas execuções</h3>
          <p className="text-xs text-muted-foreground">
            Histórico unificado de automações de funil e WhatsApp (últimas 80).
          </p>
        </div>

        {isLoading ? (
          <LoadingState message="Carregando histórico..." />
        ) : !data || data.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma execução registrada ainda.
          </div>
        ) : (
          <ul className="divide-y">
            {data.map((log) => (
              <li key={`${log.source}-${log.id}`} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`mt-0.5 h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
                        log.source === "whatsapp"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {log.source === "whatsapp" ? (
                        <MessageCircle className="h-4 w-4" />
                      ) : (
                        <Kanban className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">{log.title}</div>
                      {log.detail && (
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {log.detail}
                        </div>
                      )}
                      {log.error && (
                        <div className="text-xs text-destructive line-clamp-2 mt-0.5">
                          ⚠ {log.error}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={log.status} />
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
