import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FN = "google-contacts-integration";
const QK = ["google-contacts-status"];

async function invoke(action: string, body?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FN}?action=${action}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export function useGoogleContactsIntegration() {
  const qc = useQueryClient();

  const statusQuery = useQuery({
    queryKey: QK,
    queryFn: () => invoke("status"),
    staleTime: 30_000,
  });

  const eventsQuery = useQuery({
    queryKey: ["google-contacts-events"],
    queryFn: () => invoke("events").then(r => r.events || []),
    staleTime: 60_000,
  });

  const connect = useMutation({
    mutationFn: () => invoke("connect", { origin: window.location.origin }),
    onSuccess: (data) => {
      if (data.auth_url) {
        // Store state for callback
        sessionStorage.setItem("gc_oauth_redirect_uri", `${window.location.origin}/oauth/google-contacts/callback`);
        window.open(data.auth_url, "google-contacts-oauth", "width=600,height=700,popup=yes");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const callbackProxy = useMutation({
    mutationFn: (params: { code: string; state: string }) =>
      invoke("callback-proxy", {
        code: params.code,
        state: params.state,
        redirect_uri: sessionStorage.getItem("gc_oauth_redirect_uri") || `${window.location.origin}/oauth/google-contacts/callback`,
      }),
    onSuccess: () => {
      toast.success("Google Contatos conectado!");
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["google-contacts-events"] });
      sessionStorage.removeItem("gc_oauth_redirect_uri");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: () => invoke("disconnect"),
    onSuccess: () => {
      toast.success("Google Contatos desconectado");
      qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pullSync = useMutation({
    mutationFn: () => invoke("pull-sync"),
    onSuccess: (data) => {
      toast.success(`Sincronização concluída: ${data.stats?.processed || 0} contatos processados`);
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["google-contacts-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pushUpsert = useMutation({
    mutationFn: (contactId: string) => invoke("push-upsert", { contact_id: contactId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-contacts-events"] });
    },
    onError: (e: Error) => toast.error(`Erro ao enviar para Google: ${e.message}`),
  });

  const updateSettings = useMutation({
    mutationFn: (settings: { push_on_save: boolean }) => invoke("update-settings", settings),
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = statusQuery.data;
  const isConnected = status?.status === "connected";
  const settings = status?.settings || status?.metadata || {};

  return {
    status,
    isLoading: statusQuery.isLoading,
    isConnected,
    settings,
    events: eventsQuery.data || [],

    connect: connect.mutate,
    isConnecting: connect.isPending,

    callbackProxy: callbackProxy.mutate,

    disconnect: disconnect.mutate,
    isDisconnecting: disconnect.isPending,

    pullSync: pullSync.mutate,
    isSyncing: pullSync.isPending,

    pushUpsert: pushUpsert.mutate,
    isPushing: pushUpsert.isPending,

    updateSettings: updateSettings.mutate,
    isUpdatingSettings: updateSettings.isPending,

    refetch: statusQuery.refetch,
  };
}
