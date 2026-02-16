import { useState } from "react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  
  CheckCircle2,
  Unplug,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

/**
 * Button for individual consultants to connect/disconnect their Google Calendar.
 * Can be placed on the consultant portal or settings page.
 */
export function GoogleCalendarConnectButton() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Check if user already has a connected calendar — via secure RPC (no token columns exposed)
  const { data: calendarToken, isLoading } = useQuery({
    queryKey: ["my_google_calendar", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_calendar_token");
      if (error) throw error;
      return (data as any)?.[0] ?? null;
    },
  });

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth");

      if (error) throw error;
      
      // Handle structured backend errors
      if (data?.code === "CONFIG_MISSING" || data?.code === "CONFIG_INVALID") {
        throw new Error(data.error || "Credenciais OAuth inválidas ou ausentes.");
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("URL de autenticação não recebida");

      // Redirect to Google consent screen
      window.location.href = data.url;
    } catch (err: any) {
      const msg = err.message || "Não foi possível iniciar a conexão com o Google.";
      const isConfigError = msg.includes("CONFIG_") || msg.includes("Client ID") || msg.includes("Client Secret") || msg.includes("credenciais");
      toast({
        title: isConfigError ? "Erro de configuração" : "Erro ao conectar",
        description: msg,
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!calendarToken?.id) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("google_calendar_tokens")
        .update({ is_active: false })
        .eq("id", calendarToken.id);

      if (error) throw error;

      toast({ title: "Google Calendar desconectado" });
      queryClient.invalidateQueries({ queryKey: ["my_google_calendar"] });
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Spinner size="sm" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = calendarToken?.is_active;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Google Calendar
          {isConnected && (
            <Badge variant="outline" className="ml-2 bg-success/10 text-success border-success/20 gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3" />
              Conectado
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {isConnected
            ? `Conectado como ${calendarToken?.google_email || "conta Google"}`
            : "Conecte seu Google Calendar para sincronizar sua agenda"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="gap-1.5"
            >
              {disconnecting ? (
                <Spinner size="sm" />
              ) : (
                <Unplug className="h-3.5 w-3.5" />
              )}
              Desconectar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reconectar
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="gap-2"
          >
            {connecting ? (
              <Spinner size="sm" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            {connecting ? "Conectando..." : "Conectar Google Calendar"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default GoogleCalendarConnectButton;
