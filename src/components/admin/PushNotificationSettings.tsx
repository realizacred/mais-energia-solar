import { useState, useEffect } from "react";
import { Bell, BellOff, Smartphone, Trash2, Clock, Loader2 } from "lucide-react";
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

  // Load devices and preferences
  useEffect(() => {
    loadDevices();
    loadPreferences();
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
