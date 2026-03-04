import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, XCircle, Plug, Unplug, RefreshCcw, Loader2, Users, Clock, Mail, ExternalLink,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useGoogleContactsIntegration } from "@/hooks/useGoogleContactsIntegration";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  connected: { label: "Conectado", color: "bg-primary/15 text-primary border-primary/30", icon: CheckCircle2 },
  disconnected: { label: "Não conectado", color: "bg-muted text-muted-foreground border-border", icon: Plug },
  error: { label: "Erro", color: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
};

const ACTION_LABELS: Record<string, string> = {
  oauth_connect_start: "Conexão iniciada",
  oauth_connect: "Conectado",
  pull_sync: "Importação de contatos",
  push_upsert: "Envio para Google",
  disconnect: "Desconectado",
  token_refresh: "Token renovado",
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`gap-1.5 ${cfg.color}`}>
      <Icon className="h-3.5 w-3.5" /> {cfg.label}
    </Badge>
  );
}

export function GoogleContactsCard() {
  const {
    status, isLoading, isConnected, settings, events,
    connect, isConnecting,
    disconnect, isDisconnecting,
    pullSync, isSyncing,
    updateSettings, isUpdatingSettings,
  } = useGoogleContactsIntegration();

  const lastSync = settings?.last_sync_at;
  const pushOnSave = !!settings?.push_on_save;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Google Contatos</CardTitle>
              <CardDescription>Sincronização bidirecional via People API</CardDescription>
            </div>
          </div>
          {!isLoading && <StatusBadge status={status?.status || "disconnected"} />}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Connection details */}
            {isConnected && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                {status?.connected_account_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Conta:</span>
                    <span className="font-medium">{status.connected_account_email}</span>
                  </div>
                )}
                {lastSync && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Último sync:</span>
                    <span className="font-medium">
                      {format(new Date(lastSync), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                )}

                {/* Push toggle */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <Label htmlFor="push-toggle" className="text-sm cursor-pointer">
                    Criar/Atualizar no Google ao salvar contatos
                  </Label>
                  <Switch
                    id="push-toggle"
                    checked={pushOnSave}
                    disabled={isUpdatingSettings}
                    onCheckedChange={(val) => updateSettings({ push_on_save: val })}
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {status?.status === "error" && status?.last_error_message && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <p className="font-medium text-destructive">Erro na integração</p>
                <p className="text-muted-foreground mt-1">{status.last_error_message}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {!isConnected ? (
                <Button onClick={() => connect()} disabled={isConnecting}>
                  {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                  Conectar com Google
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => pullSync()} disabled={isSyncing}>
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    Sincronizar agora
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={isDisconnecting}>
                        {isDisconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
                        Desconectar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Desconectar Google Contatos?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Os tokens serão revogados. A sincronização será interrompida. Você pode reconectar a qualquer momento.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => disconnect()}>Desconectar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>

            {/* Events log */}
            {events.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Histórico</h4>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-1.5">
                    {events.map((evt: any) => (
                      <div key={evt.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                        <div className="flex items-center gap-2">
                          {evt.status === "success" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          )}
                          <span className="text-xs">{ACTION_LABELS[evt.action] || evt.action}</span>
                          {evt.items_processed > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {evt.items_processed} contatos
                            </Badge>
                          )}
                        </div>
                        <span className="text-muted-foreground text-[10px] whitespace-nowrap">
                          {format(new Date(evt.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
