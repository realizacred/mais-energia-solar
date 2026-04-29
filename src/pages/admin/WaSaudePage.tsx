import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
// timezone: America/Sao_Paulo (via Intl)
import {
  Activity,
  Inbox,
  Send,
  Clock,
  AlertTriangle,
  Webhook,
  Users,
  Server,
  CheckCircle2,
  XCircle,
  CircleDot,
  Link2,
  Loader2,
} from "lucide-react";

import { PageHeader, StatCard, EmptyState } from "@/components/ui-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

import { useWaHealthMetrics } from "@/hooks/useWaHealthMetrics";
import { useWaHealthInstances } from "@/hooks/useWaHealthInstances";
import { useWaHealthOutbox } from "@/hooks/useWaHealthOutbox";
import { useWaHealthWebhooks } from "@/hooks/useWaHealthWebhooks";
import { useWaHealthOrphanConversations } from "@/hooks/useWaHealthOrphanConversations";
import {
  resolveWaConversation,
  resolveWaConversationsBatch,
  type ResolutionStatus,
} from "@/services/whatsapp/waConversationResolver";

const TZ = "America/Sao_Paulo";

const dtFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function fmt(date?: string | null) {
  if (!date) return "—";
  try {
    return dtFmt.format(new Date(date)).replace(",", "");
  } catch {
    return "—";
  }
}

function formatOffline(min: number | null) {
  if (min == null) return "Sem registro";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function offlineColor(min: number | null): "success" | "warning" | "destructive" {
  if (min == null) return "destructive";
  if (min < 120) return "success";
  if (min < 360) return "warning";
  return "destructive";
}

function KpiSkeleton() {
  return (
    <Card className="border-l-[3px] border-l-muted">
      <CardContent className="p-5">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-7 w-20" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function WaSaudePage() {
  const metrics = useWaHealthMetrics();
  const instances = useWaHealthInstances();
  const [outboxStatus, setOutboxStatus] = useState("all");
  const outbox = useWaHealthOutbox(outboxStatus);
  const webhooks = useWaHealthWebhooks();
  const orphans = useWaHealthOrphanConversations();
  const queryClient = useQueryClient();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);

  const STATUS_TOAST: Record<ResolutionStatus, (r: any) => void> = {
    resolved: () => toast.success("Conversa vinculada com sucesso"),
    ambiguous: (r) => toast.warning("Mais de um possível vínculo", { description: r.reason }),
    not_found: () => toast.info("Nenhum match encontrado"),
    already_resolved: () => toast.info("Conversa já vinculada"),
    error: (r) => toast.error("Erro ao processar", { description: r.reason }),
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["wa-health-orphan-conversations"] });
    queryClient.invalidateQueries({ queryKey: ["wa-health-metrics"] });
  };

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      const r = await resolveWaConversation(id);
      STATUS_TOAST[r.status]?.(r);
      invalidate();
    } finally {
      setResolvingId(null);
    }
  };

  const handleBatch = async () => {
    if (!orphans.data?.length) return;
    setBatchRunning(true);
    try {
      const ids = orphans.data.slice(0, 20).map((c) => c.id);
      const s = await resolveWaConversationsBatch(ids, 20);
      toast.success(`Lote processado: ${s.resolved} vinculadas`, {
        description: `${s.ambiguous} ambíguas · ${s.not_found} sem match · ${s.errors} erros · ${s.already_resolved} já vinculadas`,
      });
      invalidate();
    } finally {
      setBatchRunning(false);
    }
  };

  const m = metrics.data;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="Saúde do WhatsApp"
        description="Monitoramento operacional das instâncias, mensagens e filas"
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.isLoading || !m ? (
          Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              icon={Inbox}
              color="info"
              label="Mensagens (24h)"
              value={`${m.inbound_24h} / ${m.outbound_24h}`}
              subtitle="Recebidas / Enviadas"
            />
            <StatCard
              icon={Send}
              color="primary"
              label="Mensagens (7 dias)"
              value={`${m.inbound_7d} / ${m.outbound_7d}`}
              subtitle="Recebidas / Enviadas"
            />
            <StatCard
              icon={Clock}
              color={m.outbox_failed > 0 ? "destructive" : m.outbox_pending > 50 ? "warning" : "success"}
              label="Fila Outbox"
              value={`${m.outbox_pending} / ${m.outbox_failed}`}
              subtitle={`Pendentes / Falhas · ${m.outbox_sent} enviadas 24h`}
            />
            <StatCard
              icon={Webhook}
              color={m.webhooks_unprocessed > 0 ? "warning" : "success"}
              label="Webhooks"
              value={`${m.webhooks_total}`}
              subtitle={`${m.webhooks_unprocessed} não processados`}
            />
            <StatCard
              icon={Users}
              color={m.conversations_orphan > 0 ? "warning" : "success"}
              label="Conversas"
              value={`${m.conversations_total}`}
              subtitle={`${m.conversations_orphan} órfãs (sem lead/cliente)`}
            />
            <StatCard
              icon={Server}
              color={m.instances_inactive > 0 ? "destructive" : "success"}
              label="Instâncias"
              value={`${m.instances_connected} / ${m.instances_total}`}
              subtitle={`${m.instances_inactive} inativas (>6h)`}
            />
          </>
        )}
      </div>

      {/* Instâncias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4 text-primary" /> Instâncias WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {instances.isLoading ? (
            <TableSkeleton />
          ) : !instances.data?.length ? (
            <EmptyState
              icon={Server}
              title="Nenhuma instância configurada"
              description="Cadastre uma instância para começar a monitorar."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Último contato</TableHead>
                  <TableHead>Tempo offline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.data.map((i) => {
                  const color = offlineColor(i.offline_minutes);
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.nome}</TableCell>
                      <TableCell><StatusBadge status={i.status} size="sm" /></TableCell>
                      <TableCell className="text-muted-foreground">{i.phone_number ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{fmt(i.last_seen_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CircleDot
                            className={cn(
                              "h-3.5 w-3.5",
                              color === "success" && "text-success",
                              color === "warning" && "text-warning",
                              color === "destructive" && "text-destructive"
                            )}
                          />
                          <span className="text-sm">{formatOffline(i.offline_minutes)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Outbox */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-primary" /> Fila Outbox (últimos 50)
          </CardTitle>
          <Select value={outboxStatus} onValueChange={setOutboxStatus}>
            <SelectTrigger className="w-40 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="sending">Enviando</SelectItem>
              <SelectItem value="failed">Falhas</SelectItem>
              <SelectItem value="sent">Enviadas</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {outbox.isLoading ? (
            <TableSkeleton />
          ) : !outbox.data?.length ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nenhuma mensagem na fila"
              description="Não há mensagens correspondentes ao filtro selecionado."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Criada em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Tentativa</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outbox.data.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{fmt(o.created_at)}</TableCell>
                    <TableCell><StatusBadge status={o.status} size="sm" /></TableCell>
                    <TableCell className="font-mono text-xs">{o.remote_jid ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{o.retry_count ?? 0}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-xs truncate" title={o.error_message ?? ""}>
                      {o.error_message ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4 text-primary" /> Webhooks recentes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {webhooks.isLoading ? (
            <TableSkeleton />
          ) : !webhooks.data?.length ? (
            <EmptyState
              icon={Webhook}
              title="Nenhum webhook recente"
              description="Aguardando eventos da Evolution API."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recebido em</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Processado</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.data.map((w) => (
                  <TableRow key={w.id} className={!w.processed ? "bg-warning/5" : undefined}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{fmt(w.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{w.event_type}</TableCell>
                    <TableCell>
                      {w.processed ? (
                        <Badge className="bg-success/15 text-success border-success/20 hover:bg-success/15">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Sim
                        </Badge>
                      ) : (
                        <Badge className="bg-warning/15 text-warning border-warning/20 hover:bg-warning/15">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Não
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-xs truncate" title={w.error ?? ""}>
                      {w.error ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Conversas órfãs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" /> Conversas órfãs (sem lead/cliente)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {orphans.isLoading ? (
            <TableSkeleton />
          ) : !orphans.data?.length ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nenhuma conversa órfã"
              description="Todas as conversas estão vinculadas a um lead ou cliente."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>JID</TableHead>
                  <TableHead>Última mensagem</TableHead>
                  <TableHead>Qtd. mensagens</TableHead>
                  <TableHead>Última em</TableHead>
                  <TableHead>Criada em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphans.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.remote_jid}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate text-muted-foreground" title={c.last_message_preview ?? ""}>
                      {c.last_message_preview ?? "—"}
                    </TableCell>
                    <TableCell>{c.message_count}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{fmt(c.last_message_at)}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{fmt(c.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
