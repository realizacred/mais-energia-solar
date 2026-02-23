import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const FUNCTION_NAME = "google-calendar-integration";

async function callIntegration(action: string, method = "POST", body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Não autenticado");

  const url = `${(supabase as any).supabaseUrl}/functions/v1/${FUNCTION_NAME}?action=${action}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: (supabase as any).supabaseKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export interface IntegrationStatus {
  id?: string;
  status: string;
  provider?: string;
  connected_account_email?: string | null;
  default_calendar_id?: string | null;
  default_calendar_name?: string | null;
  scopes?: string[];
  last_test_at?: string | null;
  last_test_status?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  oauth_client_id?: string | null;
  has_credentials?: boolean;
}

export interface CalendarItem {
  id: string;
  summary: string;
  primary: boolean;
}

export interface AuditEvent {
  id: string;
  action: string;
  result: string;
  actor_type: string;
  created_at: string;
  metadata_json: Record<string, unknown>;
}

export interface OAuthConfig {
  client_id: string;
  client_secret: string; // masked from backend ("••••••••••" when set)
}

export function useGoogleCalendarIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);

  // Single init query replaces 3 separate calls
  const initQuery = useQuery<{ status: IntegrationStatus; config: OAuthConfig; events: AuditEvent[] }>({
    queryKey: ["integration", "google_calendar", "init"],
    queryFn: () => callIntegration("init", "POST"),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["integration", "google_calendar"] });
  }, [queryClient]);

  const saveConfigMutation = useMutation({
    mutationFn: (config: { client_id: string; client_secret: string }) =>
      callIntegration("save-config", "POST", config),
    onSuccess: () => {
      toast({ title: "Credenciais salvas ✅", description: "Client ID e Secret configurados com sucesso" });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const connectMutation = useMutation({
    mutationFn: () => callIntegration("connect", "POST", { origin: window.location.origin }),
    onSuccess: (data) => {
      if (data.auth_url) {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(
          data.auth_url,
          "google-oauth",
          `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no`
        );
        // Poll for popup close to refresh status
        if (popup) {
          const timer = setInterval(() => {
            if (popup.closed) {
              clearInterval(timer);
              invalidate();
            }
          }, 1000);
        }
      }
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => callIntegration("test"),
    onSuccess: (data) => {
      if (data.success) {
        setCalendars(data.calendars || []);
        toast({ title: "Conexão OK ✅", description: `${data.calendars?.length || 0} calendário(s) encontrado(s)` });
      } else {
        toast({ title: "Teste falhou", description: data.error, variant: "destructive" });
      }
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Erro no teste", description: err.message, variant: "destructive" });
    },
  });

  const selectCalendarMutation = useMutation({
    mutationFn: (cal: { calendar_id: string; calendar_name: string }) =>
      callIntegration("select-calendar", "POST", cal),
    onSuccess: () => {
      toast({ title: "Calendário selecionado ✅" });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => callIntegration("disconnect"),
    onSuccess: () => {
      setCalendars([]);
      toast({ title: "Desconectado", description: "Integração removida com sucesso" });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao desconectar", description: err.message, variant: "destructive" });
    },
  });

  return {
    status: initQuery.data?.status,
    isLoading: initQuery.isLoading,
    config: initQuery.data?.config,
    isLoadingConfig: initQuery.isLoading,
    auditEvents: initQuery.data?.events || [],
    calendars,
    saveConfig: saveConfigMutation.mutate,
    isSavingConfig: saveConfigMutation.isPending,
    connect: connectMutation.mutate,
    isConnecting: connectMutation.isPending,
    test: testMutation.mutate,
    isTesting: testMutation.isPending,
    selectCalendar: selectCalendarMutation.mutate,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
    refetch: invalidate,
  };
}
