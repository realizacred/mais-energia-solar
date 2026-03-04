/**
 * Push Notification Debug Panel — Ativar, testar e diagnosticar push.
 * SRP: UI only. Delegates to useWebPushSubscription hook.
 */
import { useState } from "react";
import { Bell, BellRing, CheckCircle2, XCircle, Loader2, Smartphone, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWebPushSubscription } from "@/hooks/useWebPushSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function PushDebugPanel() {
  const { user } = useAuth();
  const { isSupported, permission, isSubscribed, isLoading, isReady, subscribe, unsubscribe } =
    useWebPushSubscription();
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);

  const handleTestPush = async () => {
    setIsTesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada");

      const res = await supabase.functions.invoke("send-push-notification", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: "test" },
      });

      if (res.error) throw new Error(res.error.message);
      const result = res.data;

      if (result?.error) {
        toast({
          title: "Erro no teste",
          description: result.message || result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Push enviado! 🎉",
          description: `${result.sent || 0} notificação(ões) enviada(s). Verifique se chegou.`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Falha ao testar push",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!user || !isReady) return null;

  const permissionColor =
    permission === "granted" ? "text-success" :
    permission === "denied" ? "text-destructive" :
    "text-warning";

  const permissionLabel =
    permission === "granted" ? "Permitido" :
    permission === "denied" ? "Bloqueado" :
    permission === "default" ? "Não solicitado" :
    "Não suportado";

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bell className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Push Notifications</h4>
          <p className="text-[11px] text-muted-foreground">Diagnóstico e testes</p>
        </div>
      </div>

      {/* Status indicators */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Suporte:</span>
          {isSupported ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-success border-success/30">Sim</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-destructive border-destructive/30">Não</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Permissão:</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${permissionColor}`}>
            {permissionLabel}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {isSubscribed ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-muted-foreground">Inscrito:</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isSubscribed ? "text-success border-success/30" : "text-muted-foreground"}`}>
            {isSubscribed ? "Sim" : "Não"}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <BellRing className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Service Worker:</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isReady ? "text-success border-success/30" : "text-warning"}`}>
            {isReady ? "Pronto" : "Carregando"}
          </Badge>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        {!isSubscribed ? (
          <Button
            size="sm"
            onClick={subscribe}
            disabled={isLoading || !isSupported || permission === "denied"}
            className="h-8 text-xs gap-1.5"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
            Ativar Notificações
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={unsubscribe}
            disabled={isLoading}
            className="h-8 text-xs gap-1.5"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            Desativar
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={handleTestPush}
          disabled={isTesting || !isSubscribed}
          className="h-8 text-xs gap-1.5"
        >
          {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
          Testar Push
        </Button>
      </div>

      {permission === "denied" && (
        <p className="text-[11px] text-destructive">
          ⚠️ Permissão bloqueada. Ative nas configurações do navegador.
        </p>
      )}
    </div>
  );
}
