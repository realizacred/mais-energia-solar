/**
 * Phase 4A — Timeline somente leitura de tentativas de follow-up.
 *
 * Eventos: queued, sent, failed (+ force, cooldown ativo).
 * Reaproveita useProposalFollowupHistory. Sem novos envios, sem mutations.
 *
 * Acessibilidade: dark-mode safe (semantic tokens), mobile-first.
 */
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldAlert,
  Sparkles,
  XCircle,
  RefreshCw,
  Inbox,
  Lock,
  Bot,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useProposalFollowupHistory,
  type FollowupAttemptRow,
} from "@/hooks/useProposalFollowupHistory";

interface Props {
  propostaId: string | null | undefined;
  enabled?: boolean;
}

type FilterKey = "todos" | "queued" | "sent" | "failed" | "forced";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "queued", label: "Em fila" },
  { key: "sent", label: "Enviados" },
  { key: "failed", label: "Falhas" },
  { key: "forced", label: "Forçados" },
];

const TZ = "America/Sao_Paulo";
const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

function statusVisual(status: string) {
  switch (status) {
    case "sent":
    case "delivered":
      return {
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        cls: "border-l-success bg-success/5 text-success-foreground",
        badge: "border-success/40 text-success-foreground bg-success/10",
        label: status === "delivered" ? "Entregue" : "Enviado",
      };
    case "failed":
      return {
        icon: <XCircle className="h-3.5 w-3.5" />,
        cls: "border-l-destructive bg-destructive/5 text-destructive",
        badge: "border-destructive/40 text-destructive bg-destructive/10",
        label: "Falhou",
      };
    case "queued":
      return {
        icon: <Clock className="h-3.5 w-3.5" />,
        cls: "border-l-warning bg-warning/5 text-warning-foreground",
        badge: "border-warning/40 text-warning-foreground bg-warning/10",
        label: "Em fila",
      };
    default:
      return {
        icon: <Inbox className="h-3.5 w-3.5" />,
        cls: "border-l-border bg-muted/30 text-foreground",
        badge: "border-border text-muted-foreground",
        label: status,
      };
  }
}

function isForced(a: FollowupAttemptRow): boolean {
  const m = a.metadata as Record<string, unknown> | null;
  return Boolean(m && (m as any).force);
}

function matchesFilter(a: FollowupAttemptRow, f: FilterKey): boolean {
  if (f === "todos") return true;
  if (f === "forced") return isForced(a);
  if (f === "sent") return a.delivery_status === "sent" || a.delivery_status === "delivered";
  return a.delivery_status === f;
}

export function FollowupHistoryTimeline({ propostaId, enabled = true }: Props) {
  const [filter, setFilter] = useState<FilterKey>("todos");
  const { data, isLoading, isError, error, refetch, isFetching } =
    useProposalFollowupHistory(propostaId, enabled);

  const attempts = data?.attempts ?? [];
  const filtered = useMemo(
    () => attempts.filter((a) => matchesFilter(a, filter)),
    [attempts, filter]
  );

  const lockActive = useMemo(() => {
    if (!data?.lock) return null;
    const until = new Date(data.lock.locked_until).getTime();
    return until > Date.now() ? data.lock : null;
  }, [data?.lock]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { todos: attempts.length, queued: 0, sent: 0, failed: 0, forced: 0 };
    attempts.forEach((a) => {
      if (a.delivery_status === "queued") c.queued++;
      if (a.delivery_status === "sent" || a.delivery_status === "delivered") c.sent++;
      if (a.delivery_status === "failed") c.failed++;
      if (isForced(a)) c.forced++;
    });
    return c;
  }, [attempts]);

  if (!propostaId) return null;

  return (
    <div className="space-y-3">
      {/* Lock banner */}
      {lockActive && (
        <div className="flex items-start gap-2 rounded-md border border-l-4 border-warning/40 border-l-warning bg-warning/5 p-2.5 text-xs">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning-foreground" />
          <div className="flex-1 min-w-0 text-warning-foreground">
            <div className="font-medium">Cooldown ativo até {fmtDateTime(lockActive.locked_until)}</div>
            {lockActive.reason && <div className="opacity-80 truncate">{lockActive.reason}</div>}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
            <span className="ml-1 opacity-70">{counts[f.key]}</span>
          </button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 ml-auto px-2 text-[11px]"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Falha ao carregar histórico
          </div>
          <div className="mt-1 opacity-80">{(error as Error)?.message ?? "Erro desconhecido"}</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-7 text-[11px]"
            onClick={() => refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-50" />
          {attempts.length === 0
            ? "Nenhuma tentativa de follow-up registrada ainda."
            : "Nenhuma tentativa para este filtro."}
        </div>
      ) : (
        <ScrollArea className="h-[360px] pr-3">
          <ol className="space-y-2">
            {filtered.map((a) => {
              const v = statusVisual(a.delivery_status);
              const forced = isForced(a);
              const meta = (a.metadata ?? {}) as Record<string, unknown>;
              const forceReason = (meta.force_reason as string) ?? null;
              const bypassed = (meta.bypassed_guardrails as string[]) ?? [];
              const consultor = a.consultor_id ? data?.profiles[a.consultor_id]?.nome : null;
              const approver = a.approved_by ? data?.profiles[a.approved_by]?.nome : null;

              return (
                <li
                  key={a.id}
                  className={`rounded-md border border-l-4 p-2.5 text-xs ${v.cls}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${v.badge}`}>
                      {v.icon}
                      {v.label}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      #{a.attempt_number}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {a.channel}
                    </Badge>
                    {a.mode && (
                      <Badge variant="outline" className="text-[10px]">
                        {a.mode}
                      </Badge>
                    )}
                    {a.ai_generated && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Bot className="h-3 w-3" /> IA
                      </Badge>
                    )}
                    {forced && (
                      <Badge
                        variant="outline"
                        className="text-[10px] gap-1 border-destructive/40 text-destructive bg-destructive/5"
                      >
                        <ShieldAlert className="h-3 w-3" /> Forçado
                      </Badge>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {fmtDateTime(a.created_at)}
                    </span>
                  </div>

                  <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {consultor && <span>Consultor: <span className="text-foreground">{consultor}</span></span>}
                    {a.sent_at && <span>Enviado: <span className="text-foreground">{fmtDateTime(a.sent_at)}</span></span>}
                    {approver && <span>Aprovado por: <span className="text-foreground">{approver}</span></span>}
                    {a.outcome && <span>Outcome: <span className="text-foreground">{a.outcome}</span></span>}
                  </div>

                  {a.delivery_error && (
                    <div className="mt-1.5 rounded border border-destructive/30 bg-destructive/5 p-1.5 text-[11px] text-destructive">
                      {a.delivery_error}
                    </div>
                  )}

                  {forceReason && (
                    <div className="mt-1.5 text-[11px]">
                      <span className="text-muted-foreground">Justificativa:</span>{" "}
                      <span className="text-foreground">{forceReason}</span>
                    </div>
                  )}

                  {bypassed.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Guardrails ignorados:</span>
                      {bypassed.map((g) => (
                        <Badge
                          key={g}
                          variant="outline"
                          className="text-[10px] border-destructive/40 text-destructive bg-destructive/5"
                        >
                          {g}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {a.message_text && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Ver mensagem
                      </summary>
                      <pre className="mt-1 whitespace-pre-wrap break-words rounded border border-border bg-background p-2 text-[11px] text-foreground font-sans">
                        {a.message_text}
                      </pre>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        </ScrollArea>
      )}
    </div>
  );
}
