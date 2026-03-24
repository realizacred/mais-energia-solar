import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  MessageSquare, ExternalLink, User, Bot, Clock,
  Sparkles, AlertCircle,
} from "lucide-react";
import { formatDateTime } from "@/lib/dateUtils";

interface Props {
  customerId: string | null;
  customerPhone: string;
}

interface ConvSummary {
  id: string;
  cliente_nome: string | null;
  cliente_telefone: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  status: string;
}

type DerivedStatus = "aguardando_cliente" | "respondido" | "sem_resposta" | "resolvida";

function deriveStatus(conv: ConvSummary): DerivedStatus {
  if (conv.status === "resolved") return "resolvida";
  if (!conv.last_message_at) return "sem_resposta";
  if (conv.last_message_direction === "out") return "aguardando_cliente";
  return "respondido";
}

const STATUS_CFG: Record<DerivedStatus, { label: string; className: string }> = {
  aguardando_cliente: { label: "Aguardando cliente", className: "bg-warning/10 text-warning border-warning/20" },
  respondido: { label: "Respondido", className: "bg-info/10 text-info border-info/20" },
  sem_resposta: { label: "Sem resposta", className: "bg-muted text-muted-foreground border-border" },
  resolvida: { label: "Resolvida", className: "bg-success/10 text-success border-success/20" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export function ProjetoComunicacaoResumo({ customerId, customerPhone }: Props) {
  const navigate = useNavigate();
  const [conv, setConv] = useState<ConvSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!customerPhone && !customerId) { setLoading(false); return; }
      try {
        const digits = customerPhone.replace(/\D/g, "");
        if (digits.length >= 8) {
          const suffix = digits.slice(-8);
          const { data } = await supabase
            .from("wa_conversations")
            .select("id, cliente_nome, cliente_telefone, last_message_preview, last_message_at, last_message_direction, status")
            .or(`cliente_telefone.ilike.%${suffix}%,remote_jid.ilike.%${suffix}%`)
            .order("last_message_at", { ascending: false })
            .limit(1);
          const c = data?.[0] as ConvSummary | undefined;
          if (c) {
            setConv(c);
            // Try to load cached AI summary
            try {
              const { data: summaryData } = await supabase
                .from("wa_conversation_summaries" as any)
                .select("summary")
                .eq("conversation_id", c.id)
                .maybeSingle();
              const raw = (summaryData as any)?.summary;
              if (raw) {
                const s = typeof raw === "string" ? raw : raw?.resumo;
                if (s) setAiSummary(typeof s === "string" ? s : JSON.stringify(s));
              }
            } catch { /* ignore */ }
          }
        }
      } catch (err) { console.error("ComunicacaoResumo:", err); }
      finally { setLoading(false); }
    }
    load();
  }, [customerId, customerPhone]);

  const openFullInbox = () => {
    const digits = customerPhone.replace(/\D/g, "");
    navigate(`/admin/wa-inbox?search=${digits}`);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    );
  }

  if (!conv) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium text-sm">Nenhuma conversa encontrada</p>
          <p className="text-xs mt-1">
            {customerPhone ? `Nenhuma conversa com ${customerPhone}` : "Vincule um cliente com telefone ao projeto"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const status = deriveStatus(conv);
  const statusCfg = STATUS_CFG[status];
  const isIncoming = conv.last_message_direction === "in";

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Last message */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Última mensagem</p>
          <div className="rounded-lg bg-muted/40 border border-border/40 p-3">
            <p className="text-sm text-foreground line-clamp-2 leading-relaxed">
              {conv.last_message_preview || "(sem conteúdo)"}
            </p>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                {isIncoming ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                {isIncoming ? "Cliente" : "Sistema"}
              </span>
              <span>•</span>
              {conv.last_message_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeAgo(conv.last_message_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          <Badge variant="outline" className={cn("text-[10px] h-5 px-2 font-medium border", statusCfg.className)}>
            {statusCfg.label}
          </Badge>
        </div>

        {/* AI Summary (if cached) */}
        {aiSummary && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              Resumo IA
            </p>
            <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">
              {aiSummary}
            </p>
          </div>
        )}

        {/* Action */}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={openFullInbox}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir conversa completa
        </Button>
      </CardContent>
    </Card>
  );
}
