/**
 * ProposalMessageHistory.tsx
 * 
 * Seção de histórico de mensagens enviadas da proposta.
 * Exibe timeline compacta com canal, destinatário, status e preview.
 */

import { MessageCircle, Mail, Copy, CheckCircle, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProposalMessageLogs, type ProposalMessageLog } from "@/hooks/useProposalMessageLogs";

interface Props {
  propostaId: string;
}

const CANAL_ICON: Record<string, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  email: Mail,
  copy: Copy,
};

const CANAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  copy: "Copiado",
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; Icon: typeof CheckCircle }> = {
  sent: { label: "Enviado", cls: "bg-success/10 text-success", Icon: CheckCircle },
  failed: { label: "Falhou", cls: "bg-destructive/10 text-destructive", Icon: XCircle },
  pending: { label: "Pendente", cls: "bg-warning/10 text-warning", Icon: Clock },
};

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProposalMessageHistory({ propostaId }: Props) {
  const { data: logs = [], isLoading } = useProposalMessageLogs(propostaId);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-3 text-center">
        Nenhuma mensagem enviada ainda
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {logs.map((log) => (
        <LogEntry key={log.id} log={log} />
      ))}
    </div>
  );
}

function LogEntry({ log }: { log: ProposalMessageLog }) {
  const CanalIcon = CANAL_ICON[log.canal] || Copy;
  const canalLabel = CANAL_LABEL[log.canal] || log.canal;
  const statusCfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.Icon;
  const tipoLabel = log.tipo_mensagem === "cliente" ? "Cliente" : "Consultor";
  const preview = log.conteudo?.slice(0, 80) + (log.conteudo?.length > 80 ? "…" : "");

  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <CanalIcon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-foreground">{canalLabel}</span>
          <span className="text-[10px] text-muted-foreground">→ {tipoLabel}</span>
          {log.destinatario_valor && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
              ({log.destinatario_valor})
            </span>
          )}
          <Badge className={`text-[9px] px-1.5 py-0 ml-auto ${statusCfg.cls}`}>
            <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
            {statusCfg.label}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{preview}</p>
        {log.erro && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-[10px] text-destructive mt-0.5 truncate cursor-help">
                ⚠ {log.erro}
              </p>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{log.erro}</TooltipContent>
          </Tooltip>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {log.sent_at ? formatDateBR(log.sent_at) : log.created_at ? formatDateBR(log.created_at) : "—"}
        </p>
      </div>
    </div>
  );
}
