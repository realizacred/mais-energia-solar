import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui-kit/Spinner";
import {
  Calendar,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Clock,
  Settings,
} from "lucide-react";
import { GoogleCalendarConnectButton } from "./GoogleCalendarConnectButton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_LABELS: Record<string, string> = {
  call: "Ligação",
  meeting: "Reunião",
  followup: "Follow-up",
  visit: "Visita",
  other: "Outro",
};

export function AgendaConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load config
  const { data: config, isLoading } = useQuery({
    queryKey: ["agenda_config_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_config" as any)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as {
        id: string;
        agenda_enabled: boolean;
        google_sync_enabled: boolean;
        google_sync_mode: string;
        google_sync_types: string[];
        google_default_calendar_id: string;
        updated_at: string;
      } | null;
    },
  });

  // Load sync logs
  const { data: syncLogs = [] } = useQuery({
    queryKey: ["agenda_sync_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_sync_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const upsertConfig = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (config?.id) {
        const { error } = await supabase
          .from("agenda_config" as any)
          .update(updates)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("agenda_config" as any)
          .insert(updates);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda_config"] });
      queryClient.invalidateQueries({ queryKey: ["agenda_config_admin"] });
      toast({ title: "Configuração salva ✅" });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    upsertConfig.mutate({ [key]: value });
  };

  const handleSyncMode = (mode: string) => {
    upsertConfig.mutate({ google_sync_mode: mode });
  };

  const handleSyncTypes = (type: string, enabled: boolean) => {
    const current = config?.google_sync_types || ["call", "meeting"];
    const updated = enabled
      ? [...new Set([...current, type])]
      : current.filter((t: string) => t !== type);
    upsertConfig.mutate({ google_sync_types: updated });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="md" />
      </div>
    );
  }

  const agendaEnabled = config?.agenda_enabled ?? true;
  const googleSyncEnabled = config?.google_sync_enabled ?? false;
  const syncTypes = config?.google_sync_types || ["call", "meeting"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          Agenda & Compromissos
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a agenda interna e a sincronização com Google Calendar
        </p>
      </div>

      {/* Toggle: Agenda interna */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Agenda Interna
          </CardTitle>
          <CardDescription>
            Permite agendar compromissos diretamente nas conversas do WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="agenda-toggle" className="text-sm">
              Ativar agenda interna
            </Label>
            <Switch
              id="agenda-toggle"
              checked={agendaEnabled}
              onCheckedChange={(v) => handleToggle("agenda_enabled", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Google Calendar Sync */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Sincronização Google Calendar
            {googleSyncEnabled ? (
              <Badge variant="outline" className="ml-2 bg-success/10 text-success border-success/20 gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3" />
                Ativo
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-2 text-muted-foreground gap-1 text-xs">
                <XCircle className="h-3 w-3" />
                Desativado
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Sincronize compromissos com Google Calendar dos consultores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label htmlFor="google-toggle" className="text-sm">
              Ativar sincronização
            </Label>
            <Switch
              id="google-toggle"
              checked={googleSyncEnabled}
              onCheckedChange={(v) => handleToggle("google_sync_enabled", v)}
            />
          </div>

          {googleSyncEnabled && (
            <>
              <Separator />

              {/* Sync mode */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Modo de sincronização</Label>
                <Select
                  value={config?.google_sync_mode || "create_only"}
                  onValueChange={handleSyncMode}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create_only">Apenas criar no Google</SelectItem>
                    <SelectItem value="bidirectional">Bidirecional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sync types */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Sincronizar tipos</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TYPE_LABELS).map(([type, label]) => (
                    <div key={type} className="flex items-center gap-2">
                      <Switch
                        id={`sync-type-${type}`}
                        checked={syncTypes.includes(type)}
                        onCheckedChange={(v) => handleSyncTypes(type, v)}
                        className="scale-90"
                      />
                      <Label htmlFor={`sync-type-${type}`} className="text-xs">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Connect button */}
              <GoogleCalendarConnectButton />
            </>
          )}
        </CardContent>
      </Card>

      {/* Sync Logs */}
      {googleSyncEnabled && syncLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Últimos Eventos de Sync
              <Badge variant="secondary" className="text-xs ml-1">
                {syncLogs.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {syncLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-xs p-2 rounded-lg border bg-muted/20"
                >
                  <div className="flex items-center gap-2">
                    {log.status === "success" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span className="font-medium capitalize">{log.action}</span>
                    {log.error_message && (
                      <span className="text-destructive truncate max-w-[200px]">
                        {log.error_message}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0">
                    {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AgendaConfigPage;
