import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, Smartphone, Trash2, Clock, Loader2, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useWebPushSubscription } from "@/hooks/useWebPushSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DiagnosticItem {
  label: string;
  status: "ok" | "warn" | "error" | "checking";
  detail: string;
}


interface Device {
  id: string;
  endpoint: string;
  user_agent: string | null;
  is_active: boolean;
  created_at: string;
  last_seen_at: string;
}

export function PushNotificationSettings() {
  const { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe } = useWebPushSubscription();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
  const [pushEnabled, setPushEnabled] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [runningDiag, setRunningDiag] = useState(false);

  // Load devices and preferences
  useEffect(() => {
    loadDevices();
    loadPreferences();
  }, []);

  // Auto-run diagnostics on mount
  useEffect(() => {
    runDiagnostics();
  }, [isSupported, permission, isSubscribed]);

  const runDiagnostics = useCallback(async () => {
    setRunningDiag(true);
    const results: DiagnosticItem[] = [];

    // 1. Browser support
    const notifSupported = "Notification" in window;
    const swSupported = "serviceWorker" in navigator;
    const pushSupported = "PushManager" in window;
    results.push({
      label: "Suporte do navegador",
      status: notifSupported && swSupported && pushSupported ? "ok" : "error",
      detail: !notifSupported
        ? "Notification API não disponível"
        : !swSupported
          ? "Service Worker não suportado"
          : !pushSupported
            ? "Push API não suportada"
            : "Notification + SW + Push OK",
    });

    // 2. Permission
    const perm = notifSupported ? Notification.permission : "unsupported";
    results.push({
      label: "Permissão do navegador",
      status: perm === "granted" ? "ok" : perm === "denied" ? "error" : "warn",
      detail:
        perm === "granted"
          ? "Permissão concedida ✓"
          : perm === "denied"
            ? "Bloqueado — ative nas configurações do navegador"
            : "Ainda não solicitada",
    });

    // 3. Service Worker
    let swOk = false;
    if (swSupported) {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        swOk = !!reg?.active;
        results.push({
          label: "Service Worker (push-sw.js)",
          status: swOk ? "ok" : "warn",
          detail: swOk
            ? `Ativo — scope: ${reg?.scope}`
            : "Não registrado ou inativo",
        });
      } catch {
        results.push({
          label: "Service Worker",
          status: "error",
          detail: "Erro ao verificar registro",
        });
      }
    }

    // 4. PushManager subscription
    let hasSubscription = false;
    if (swSupported && pushSupported) {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        if (reg) {
          const sub = await (reg as any).pushManager.getSubscription();
          hasSubscription = !!sub;
          results.push({
            label: "Inscrição Push (PushManager)",
            status: hasSubscription ? "ok" : "warn",
            detail: hasSubscription
              ? `Ativo — endpoint: ...${sub!.endpoint.slice(-30)}`
              : "Nenhuma inscrição ativa neste dispositivo",
          });
        }
      } catch {
        results.push({
          label: "Inscrição Push",
          status: "error",
          detail: "Erro ao verificar inscrição",
        });
      }
    }

    // 5. Backend registration
    try {
      const { data, error } = await supabase.functions.invoke("register-push-subscription", {
        body: { action: "list_devices" },
      });
      if (error) throw error;
      const activeDevices = (data?.devices || []).filter((d: any) => d.is_active);
      results.push({
        label: "Dispositivos no servidor",
        status: activeDevices.length > 0 ? "ok" : "warn",
        detail:
          activeDevices.length > 0
            ? `${activeDevices.length} dispositivo(s) registrado(s)`
            : "Nenhum dispositivo ativo no servidor",
      });
    } catch {
      results.push({
        label: "Dispositivos no servidor",
        status: "error",
        detail: "Erro ao consultar servidor",
      });
    }

    // 6. Global notification config
    try {
      const { data } = await supabase
        .from("notification_config" as any)
        .select("notify_new_lead, notify_new_orcamento, notify_wa_message")
        .maybeSingle();
      if (data) {
        const d = data as any;
        const allOn = d.notify_new_lead && d.notify_new_orcamento && d.notify_wa_message;
        results.push({
          label: "Config global da empresa",
          status: allOn ? "ok" : "warn",
          detail: allOn
            ? "Todos os tipos de notificação ativos"
            : `Lead: ${d.notify_new_lead ? "✓" : "✗"} | Orçamento: ${d.notify_new_orcamento ? "✓" : "✗"} | WhatsApp: ${d.notify_wa_message ? "✓" : "✗"}`,
        });
      } else {
        results.push({
          label: "Config global da empresa",
          status: "ok",
          detail: "Sem config explícita — padrão: tudo ativo",
        });
      }
    } catch {
      results.push({
        label: "Config global da empresa",
        status: "warn",
        detail: "Não foi possível verificar",
      });
    }

    setDiagnostics(results);
    setRunningDiag(false);
  }, []);

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const { data } = await supabase.functions.invoke("register-push-subscription", {
        body: { action: "list_devices" },
      });
      if (data?.devices) setDevices(data.devices);
    } catch (e) {
      console.error("Failed to load devices:", e);
    } finally {
      setLoadingDevices(false);
    }
  };

  const loadPreferences = async () => {
    const { data } = await supabase
      .from("push_preferences")
      .select("enabled, quiet_hours_start, quiet_hours_end")
      .maybeSingle();

    if (data) {
      setPushEnabled(data.enabled);
      setQuietStart(data.quiet_hours_start?.substring(0, 5) || "");
      setQuietEnd(data.quiet_hours_end?.substring(0, 5) || "");
    }
  };

  const savePreferences = async () => {
    setSavingPrefs(true);
    try {
      await supabase.functions.invoke("register-push-subscription", {
        body: {
          action: "update_preferences",
          enabled: pushEnabled,
          quiet_hours_start: quietStart ? `${quietStart}:00` : null,
          quiet_hours_end: quietEnd ? `${quietEnd}:00` : null,
        },
      });
      toast({ title: "Preferências salvas" });
    } catch (e) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSavingPrefs(false);
    }
  };

  const removeDevice = async (id: string) => {
    await supabase.functions.invoke("register-push-subscription", {
      body: { action: "remove_device", subscriptionId: id },
    });
    setDevices((prev) => prev.filter((d) => d.id !== id));
    toast({ title: "Dispositivo removido" });
  };

  const getDeviceName = (ua: string | null) => {
    if (!ua) return "Desconhecido";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Mac")) return "macOS";
    if (ua.includes("Linux")) return "Linux";
    return "Navegador";
  };

  return (
    <div className="space-y-6">
      {/* Diagnostic Health Check */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Diagnóstico Push
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={runDiagnostics}
              disabled={runningDiag}
            >
              {runningDiag ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Verificar
            </Button>
          </div>
          <CardDescription>
            Verifica cada camada do sistema de notificações push.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {diagnostics.length === 0 ? (
            <p className="text-sm text-muted-foreground">Executando verificação...</p>
          ) : (
            <div className="space-y-2">
              {diagnostics.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="mt-0.5">
                    {item.status === "ok" ? (
                      <div className="h-5 w-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                    ) : item.status === "error" ? (
                      <div className="h-5 w-5 rounded-full bg-destructive/15 flex items-center justify-center">
                        <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                      </div>
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-amber-500/15 flex items-center justify-center">
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground break-all">
                      {item.detail}
                    </p>
                  </div>
                  <Badge
                    variant={item.status === "ok" ? "default" : item.status === "error" ? "destructive" : "secondary"}
                    className="shrink-0 text-[10px]"
                  >
                    {item.status === "ok" ? "OK" : item.status === "error" ? "ERRO" : "ATENÇÃO"}
                  </Badge>
                </div>
              ))}
              {diagnostics.every((d) => d.status === "ok") && (
                <div className="mt-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    ✅ Tudo funcionando! Push notifications estão 100% operacionais.
                  </p>
                </div>
              )}
              {diagnostics.some((d) => d.status !== "ok") && (
                <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    ⚠️ Itens com atenção precisam ser resolvidos para garantir o recebimento.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enable / Disable Push */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações Push
          </CardTitle>
          <CardDescription>
            Receba alertas de novas mensagens no WhatsApp diretamente no seu dispositivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupported ? (
            <p className="text-sm text-muted-foreground">
              Seu navegador não suporta notificações push.
            </p>
          ) : permission === "denied" ? (
            <p className="text-sm text-destructive">
              Notificações bloqueadas. Ative nas configurações do navegador.
            </p>
          ) : (
            <div className="space-y-4">
              {!isSubscribed ? (
                <Button onClick={subscribe} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
                  Ativar Push neste dispositivo
                </Button>
              ) : (
                <div className="flex items-center gap-4">
                  <Badge variant="default">
                    <Bell className="h-3 w-3 mr-1" /> Ativo neste dispositivo
                  </Badge>
                  <Button variant="outline" size="sm" onClick={unsubscribe} disabled={isLoading}>
                    <BellOff className="h-4 w-4 mr-1" /> Desativar
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Preferências
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="push-enabled">Notificações habilitadas</Label>
            <Switch
              id="push-enabled"
              checked={pushEnabled}
              onCheckedChange={(v) => setPushEnabled(v)}
            />
          </div>

          <div className="space-y-2">
            <Label>Horário silencioso (não perturbe)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                className="w-32"
                placeholder="22:00"
              />
              <span className="text-muted-foreground">até</span>
              <Input
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                className="w-32"
                placeholder="08:00"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Nenhum push será enviado neste horário.
            </p>
          </div>

          <Button onClick={savePreferences} disabled={savingPrefs} size="sm">
            {savingPrefs ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar preferências
          </Button>
        </CardContent>
      </Card>

      {/* Devices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Dispositivos inscritos
          </CardTitle>
          <CardDescription>
            Gerencie os dispositivos que recebem notificações push.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDevices ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum dispositivo inscrito.
            </p>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {getDeviceName(device.user_agent)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Visto: {format(new Date(device.last_seen_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={device.is_active ? "default" : "secondary"}>
                      {device.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDevice(device.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" className="mt-3" onClick={loadDevices}>
            Atualizar lista
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
