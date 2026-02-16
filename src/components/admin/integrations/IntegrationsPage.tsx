import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar, CheckCircle2, XCircle, AlertTriangle, Clock, Plug, Unplug,
  RefreshCcw, TestTube, Shield, Mail, ExternalLink, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useGoogleCalendarIntegration, type IntegrationStatus } from "@/hooks/useGoogleCalendarIntegration";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ── Status helpers ──────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  connected: { label: "Conectado", color: "bg-primary/15 text-primary border-primary/30", icon: CheckCircle2 },
  disconnected: { label: "Não conectado", color: "bg-muted text-muted-foreground border-border", icon: Plug },
  error: { label: "Erro", color: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
  revoked: { label: "Revogado", color: "bg-accent/15 text-accent-foreground border-accent/30", icon: AlertTriangle },
  expired: { label: "Expirado", color: "bg-secondary text-secondary-foreground border-border", icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`gap-1.5 ${cfg.color}`}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </Badge>
  );
}

const ACTION_LABELS: Record<string, string> = {
  connect_started: "Conexão iniciada",
  connect_completed: "Conexão concluída",
  callback_received: "Callback recebido",
  test_success: "Teste OK",
  test_fail: "Teste falhou",
  disconnect: "Desconectado",
  reauthorize: "Reautorizado",
  token_refreshed: "Token renovado",
  token_revoked: "Token revogado",
  token_expired: "Token expirado",
};

// ── Main Page ───────────────────────────────────────────────

export function IntegrationsPage() {
  const {
    status, isLoading, auditEvents, calendars,
    connect, isConnecting,
    test, isTesting,
    selectCalendar,
    disconnect, isDisconnecting,
    refetch,
  } = useGoogleCalendarIntegration();

  const isConnected = status?.status === "connected";
  const isError = status?.status === "error" || status?.status === "expired" || status?.status === "revoked";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground">Gerencie as conexões com serviços externos</p>
      </div>

      {/* ── Google Calendar Card ───────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Google Agenda</CardTitle>
                <CardDescription>Integração com Google Calendar API</CardDescription>
              </div>
            </div>
            {!isLoading && <StatusBadge status={status?.status || "disconnected"} />}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* ── Connection Info ──────────────────────── */}
              {isConnected && (
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    Detalhes da Conexão
                  </h4>

                  <div className="grid gap-2 text-sm">
                    {status?.connected_account_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Conta:</span>
                        <span className="font-medium">{status.connected_account_email}</span>
                      </div>
                    )}

                    {status?.default_calendar_name && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Calendário:</span>
                        <span className="font-medium">{status.default_calendar_name}</span>
                      </div>
                    )}

                    {status?.last_test_at && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Último teste:</span>
                        <span className="font-medium">
                          {format(new Date(status.last_test_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                        {status.last_test_status === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    )}

                    {status?.scopes && status.scopes.length > 0 && (
                      <div className="pt-1">
                        <span className="text-muted-foreground text-xs">Escopos concedidos:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {status.scopes.map((s) => (
                            <Badge key={s} variant="secondary" className="text-[10px] font-mono">
                              {s.split("/").pop()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Error Info ──────────────────────────── */}
              {isError && status?.last_error_message && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <p className="font-medium text-destructive">Erro na integração</p>
                  <p className="text-muted-foreground mt-1">{status.last_error_message}</p>
                  {status.last_error_code && (
                    <Badge variant="outline" className="mt-2 text-[10px] font-mono">
                      {status.last_error_code}
                    </Badge>
                  )}
                </div>
              )}

              {/* ── Calendar Selection ──────────────────── */}
              {calendars.length > 0 && (
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <h4 className="text-sm font-semibold">Selecione o calendário padrão</h4>
                  <Select
                    defaultValue={status?.default_calendar_id || undefined}
                    onValueChange={(val) => {
                      const cal = calendars.find((c) => c.id === val);
                      if (cal) selectCalendar({ calendar_id: cal.id, calendar_name: cal.summary });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um calendário" />
                    </SelectTrigger>
                    <SelectContent>
                      {calendars.map((cal) => (
                        <SelectItem key={cal.id} value={cal.id}>
                          {cal.summary} {cal.primary && "(principal)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* ── Actions ────────────────────────────── */}
              <div className="flex flex-wrap gap-2">
                {!isConnected ? (
                  <Button onClick={() => connect()} disabled={isConnecting}>
                    {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                    Conectar com Google
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => test()} disabled={isTesting}>
                      {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
                      Testar Conexão
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => connect()}
                      disabled={isConnecting}
                    >
                      {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                      Reautorizar
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isDisconnecting}>
                          {isDisconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
                          Desconectar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Desconectar Google Agenda?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Os tokens serão revogados e removidos. Você poderá reconectar a qualquer momento.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => disconnect()}>
                            Desconectar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}

                {isError && (
                  <Button onClick={() => connect()} disabled={isConnecting}>
                    {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    Reconectar
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Audit Log ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Log de Auditoria</CardTitle>
          <CardDescription>Histórico de ações na integração Google Agenda</CardDescription>
        </CardHeader>
        <CardContent>
          {auditEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum evento registrado</p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {auditEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {evt.result === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <span>{ACTION_LABELS[evt.action] || evt.action}</span>
                      <Badge variant="outline" className="text-[10px]">{evt.actor_type}</Badge>
                    </div>
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      {format(new Date(evt.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default IntegrationsPage;
