import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw,
  MessageCircle,
  Sun,
  Brain,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CircleDashed,
  Activity,
  Clock,
  Zap,
  Eye,
  EyeOff,
  Save,
  KeyRound,
  Settings,
  Wifi,
  WifiOff,
  Users,
  Send,
  Inbox,
  Phone,
  Sparkles,
  Globe,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

// ── Types ──

interface IntegrationResult {
  id: string;
  name: string;
  status: "online" | "offline" | "degraded" | "not_configured";
  latency_ms?: number;
  details?: string;
  last_event?: string;
  checked_at: string;
}

interface InstanceHealth {
  instance_id: string;
  instance_name: string;
  phone_number: string | null;
  profile_name: string | null;
  ok: boolean;
  evolution_state: string | null;
  latency_ms: number | null;
  error_message: string | null;
  last_seen_at: string | null;
  last_webhook_at: string | null;
  last_send_ok_at: string | null;
  outbox_pending_count: number;
  consultores: { id: string; nome: string; codigo: string }[];
}

interface IntegrationMeta {
  icon: typeof MessageCircle;
  color: string;
  description: string;
  configurable: boolean;
  placeholder?: string;
  helpText?: string;
}

const INTEGRATION_META: Record<string, IntegrationMeta> = {
  solarmarket: {
    icon: Sun,
    color: "text-warning",
    description: "Marketplace solar — Sync de clientes e projetos",
    configurable: true,
    placeholder: "Token de acesso...",
    helpText: "Token fornecido pelo SolarMarket para integração.",
  },
  openai: {
    icon: Brain,
    color: "text-secondary",
    description: "OpenAI — Sugestões comerciais e assistente de escrita",
    configurable: true,
    placeholder: "sk-...",
    helpText: "Chave da API OpenAI. Validada antes de salvar.",
  },
  google_gemini: {
    icon: Sparkles,
    color: "text-primary",
    description: "Google Gemini — IA alternativa para assistente de escrita",
    configurable: true,
    placeholder: "AIzaSy...",
    helpText: "Chave da API Google Gemini (AI Studio). Validada antes de salvar.",
  },
};

const STATUS_CONFIG = {
  online: { icon: CheckCircle2, label: "Online", className: "bg-success/10 text-success border-success/20" },
  offline: { icon: XCircle, label: "Offline", className: "bg-destructive/10 text-destructive border-destructive/20" },
  degraded: { icon: AlertTriangle, label: "Degradado", className: "bg-warning/10 text-warning border-warning/20" },
  not_configured: { icon: CircleDashed, label: "Não configurado", className: "bg-muted text-muted-foreground" },
};

// ── Helpers ──

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(iso);
  }
}

function formatLatency(ms?: number | null) {
  if (ms == null) return null;
  if (ms < 500) return <span className="text-success font-medium">{ms}ms</span>;
  if (ms < 2000) return <span className="text-warning font-medium">{ms}ms</span>;
  return <span className="text-destructive font-medium">{ms}ms</span>;
}

function timeSince(iso?: string | null): { text: string; warning: boolean } {
  if (!iso) return { text: "Nunca", warning: true };
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 5) return { text: `${mins}min atrás`, warning: false };
  if (mins < 60) return { text: `${mins}min atrás`, warning: mins > 30 };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { text: `${hours}h atrás`, warning: hours > 6 };
  const days = Math.floor(hours / 24);
  return { text: `${days}d atrás`, warning: true };
}

// ── Inline API Key Config ──

function InlineApiKeyConfig({
  serviceKey,
  meta,
  currentStatus,
  onSaved,
}: {
  serviceKey: string;
  meta: IntegrationMeta;
  currentStatus?: IntegrationResult;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const isConfigured = currentStatus && currentStatus.status !== "not_configured";

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("save-integration-key", {
        body: { service_key: serviceKey, api_key: apiKey.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.details || data.error);
      toast({ title: "Chave salva", description: `API key de ${serviceKey} validada e salva.` });
      setApiKey("");
      setOpen(false);
      onSaved();
    } catch (err: any) {
      toast({ title: "Erro ao salvar chave", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {isConfigured ? "Chave configurada" : "Chave não configurada"}
        </span>
        {isConfigured && (
          <Badge variant="outline" className="gap-1 text-xs bg-success/10 text-success border-success/20 ml-1">
            <CheckCircle2 className="h-2.5 w-2.5" /> Ativa
          </Badge>
        )}
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="gap-1 ml-auto text-xs h-7">
          <Settings className="h-3 w-3" />
          {isConfigured ? "Alterar chave" : "Configurar"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
      <Label className="text-xs flex items-center gap-1.5">
        <KeyRound className="h-3 w-3" />
        {isConfigured ? "Substituir API Key" : "Configurar API Key"}
      </Label>
      <p className="text-xs text-muted-foreground">{meta.helpText}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showKey ? "text" : "password"}
            placeholder={meta.placeholder || "API key..."}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="pr-10 font-mono text-xs h-9"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button onClick={handleSave} disabled={saving || !apiKey.trim()} size="sm" className="gap-1 h-9">
          {saving ? <Spinner size="sm" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Validando..." : "Salvar"}
        </Button>
        <Button variant="ghost" size="sm" className="h-9" onClick={() => { setOpen(false); setApiKey(""); }}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ── WhatsApp Instance Health Card ──

function InstanceHealthCard({ health }: { health: InstanceHealth }) {
  const webhookAge = timeSince(health.last_webhook_at);
  const sendAge = timeSince(health.last_send_ok_at);

  return (
    <div className={`p-4 rounded-xl border-2 transition-all ${
      health.ok
        ? "border-success/30 bg-success/5"
        : "border-destructive/30 bg-destructive/5"
    }`}>
      {/* Instance header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          {health.ok ? (
            <Wifi className="h-5 w-5 text-success" />
          ) : (
            <WifiOff className="h-5 w-5 text-destructive" />
          )}
          <div>
            <h4 className="font-semibold text-sm">{health.instance_name}</h4>
            {health.phone_number && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> {health.phone_number}
              </p>
            )}
          </div>
        </div>
        <Badge
          variant="outline"
          className={`text-xs gap-1 ${
            health.ok
              ? "bg-success/10 text-success border-success/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          {health.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {health.evolution_state === "open" ? "Conectado" : health.evolution_state || "Offline"}
        </Badge>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Latência</p>
          <p className="text-sm font-medium">{health.latency_ms != null ? formatLatency(health.latency_ms) : "—"}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Inbox className="h-3 w-3" /> Último Webhook
          </p>
          <p className={`text-sm font-medium ${webhookAge.warning ? "text-destructive" : ""}`}>
            {webhookAge.text}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Send className="h-3 w-3" /> Último Envio
          </p>
          <p className={`text-sm font-medium ${sendAge.warning ? "text-warning" : ""}`}>
            {sendAge.text}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Outbox Pendente</p>
          <p className={`text-sm font-medium ${health.outbox_pending_count > 0 ? "text-warning" : ""}`}>
            {health.outbox_pending_count}
          </p>
        </div>
      </div>

      {/* Warnings */}
      {webhookAge.warning && health.last_webhook_at && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20 mb-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <p className="text-xs text-warning">
            Webhooks parados há mais de 30 minutos. Verifique a URL de webhook na Evolution API.
          </p>
        </div>
      )}

      {health.error_message && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 mb-3">
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive break-all">{health.error_message}</p>
        </div>
      )}

      {health.outbox_pending_count > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20 mb-3">
          <Clock className="h-4 w-4 text-warning shrink-0" />
          <p className="text-xs text-warning">
            {health.outbox_pending_count} mensagen(s) aguardando envio na fila.
          </p>
        </div>
      )}

      {/* Vendedores linked */}
      {health.consultores.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <Users className="h-3 w-3" /> Consultores vinculados
          </p>
          <div className="flex flex-wrap gap-1.5">
            {health.consultores.map((v) => (
              <Badge
                key={v.id}
                variant="outline"
                className={`text-[10px] gap-1 ${
                  !health.ok
                    ? "bg-destructive/10 text-destructive border-destructive/20"
                    : "bg-muted"
                }`}
              >
                {!health.ok && <AlertTriangle className="h-2.5 w-2.5" />}
                {v.nome} ({v.codigo})
              </Badge>
            ))}
          </div>
          {!health.ok && health.consultores.length > 0 && (
            <p className="text-[10px] text-destructive mt-1.5">
              ⚠ Estes consultores estão sem capacidade de envio/recebimento nesta instância.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── App URL Config Card (PUBLIC only — NOT for OAuth/callbacks) ──

function AppUrlConfigCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data: currentUrl, isLoading } = useQuery({
    queryKey: ["public_app_url"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_configs")
        .select("api_key")
        .eq("service_key", "public_app_url")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data?.api_key || "";
    },
  });

  const validateUrl = (input: string): string | null => {
    const trimmed = input.trim().replace(/\/+$/, "");
    if (!trimmed) return "URL é obrigatória.";
    if (!trimmed.startsWith("https://")) return "A URL deve começar com https://";
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname !== "/" && parsed.pathname !== "") return "A URL não deve conter caminhos (/path).";
      if (parsed.search) return "A URL não deve conter query strings (?param=value).";
      if (parsed.hash) return "A URL não deve conter fragmentos (#section).";
      if (!parsed.hostname.includes(".")) return "Domínio inválido.";
    } catch {
      return "URL inválida.";
    }
    return null;
  };

  const handleSave = async () => {
    const trimmed = url.trim().replace(/\/+$/, "");
    const validationError = validateUrl(trimmed);
    if (validationError) {
      toast({ title: "URL inválida", description: validationError, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("save-integration-key", {
        body: { service_key: "public_app_url", api_key: trimmed },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.details || data.error);
      toast({ title: "URL pública salva", description: "URL atualizada. Links e metatags usarão este domínio." });
      setEditing(false);
      setUrl("");
      queryClient.invalidateQueries({ queryKey: ["public_app_url"] });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          URL Pública do App
          {currentUrl && (
            <Badge variant="outline" className="ml-2 bg-success/10 text-success border-success/20 gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3" />
              Configurado
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Domínio usado em links compartilhados, QR codes, canonical e metatags.
          <strong className="text-foreground"> Não afeta OAuth/callbacks</strong> — esses usam URL de segurança fixa (secret).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Spinner size="sm" />
        ) : editing ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">URL pública (apenas domínio)</Label>
              <Input
                placeholder="https://app.maisenergiasolar.com.br"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                HTTPS obrigatório. Sem caminhos ou query strings. Usada para links e metatags apenas.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !url.trim()} size="sm" className="gap-1.5">
                {saving ? <Spinner size="sm" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setUrl(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              {currentUrl ? (
                <p className="text-sm font-mono text-foreground">{currentUrl}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Não configurado — usando domínio atual ({window.location.origin})
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditing(true); setUrl(currentUrl || ""); }}
              className="gap-1.5"
            >
              <Settings className="h-3.5 w-3.5" />
              {currentUrl ? "Alterar" : "Configurar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──

export function IntegrationStatusPage() {
  const { toast } = useToast();
  const [results, setResults] = useState<IntegrationResult[]>([]);
  const [instanceHealth, setInstanceHealth] = useState<InstanceHealth[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  const runHealthCheck = useCallback(async (integration: string = "all") => {
    if (integration === "all") {
      setLoading(true);
    } else {
      setCheckingId(integration);
    }

    try {
      const { data, error } = await supabase.functions.invoke("integration-health-check", {
        body: { integration },
      });

      if (error) throw error;

      if (data?.results) {
        if (integration === "all") {
          setResults(data.results);
        } else {
          setResults((prev) => {
            const filtered = prev.filter((r) => r.id !== integration);
            return [...filtered, ...data.results];
          });
        }
      }

      if (data?.instance_health) {
        setInstanceHealth(data.instance_health);
      }

      setHasChecked(true);
    } catch (err: any) {
      console.error("Health check error:", err);
      toast({ title: "Erro no health check", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setCheckingId(null);
    }
  }, [toast]);

  const whatsappResult = results.find((r) => r.id === "whatsapp");
  const otherResults = results.filter((r) => r.id !== "whatsapp");
  const offlineInstances = instanceHealth.filter((h) => !h.ok);
  const offlineVendedores = offlineInstances.flatMap((h) => h.consultores);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Status das Integrações
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento operacional e configuração das APIs conectadas
          </p>
        </div>
        <Button onClick={() => runHealthCheck("all")} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Verificando..." : "Verificar Tudo"}
        </Button>
      </div>

      {/* Summary badges */}
      {hasChecked && results.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {(["online", "degraded", "offline", "not_configured"] as const).map((status) => {
            const count = results.filter((r) => r.status === status).length;
            if (count === 0) return null;
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;
            return (
              <Badge key={status} variant="outline" className={`gap-1.5 ${cfg.className}`}>
                <Icon className="h-3.5 w-3.5" />
                {count} {cfg.label}
              </Badge>
            );
          })}
          {offlineVendedores.length > 0 && (
            <Badge variant="outline" className="gap-1.5 bg-destructive/10 text-destructive border-destructive/20">
              <Users className="h-3.5 w-3.5" />
              {offlineVendedores.length} consultor(es) impactado(s)
            </Badge>
          )}
        </div>
      )}

      {/* ── URL de Produção ── */}
      <AppUrlConfigCard />

      {/* ── WhatsApp — Per-Instance Health Panel ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-success" />
              WhatsApp (Evolution API)
              {whatsappResult && (
                <Badge variant="outline" className={`text-xs gap-1 ml-2 ${STATUS_CONFIG[whatsappResult.status].className}`}>
                  {(() => { const I = STATUS_CONFIG[whatsappResult.status].icon; return <I className="h-3 w-3" />; })()}
                  {STATUS_CONFIG[whatsappResult.status].label}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Saúde operacional por instância — envio, recebimento e consultores vinculados
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runHealthCheck("whatsapp")}
            disabled={checkingId === "whatsapp" || loading}
            className="gap-1.5 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checkingId === "whatsapp" ? "animate-spin" : ""}`} />
            {checkingId === "whatsapp" ? "Testando..." : "Testar"}
          </Button>
        </CardHeader>
        <CardContent>
          {!hasChecked ? (
            <p className="text-sm text-muted-foreground text-center py-8 italic">
              Clique em "Testar" ou "Verificar Tudo" para inspecionar as instâncias
            </p>
          ) : instanceHealth.length === 0 ? (
            <div className="text-center py-8">
              <WifiOff className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma instância configurada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {instanceHealth.map((health) => (
                <InstanceHealthCard key={health.instance_id} health={health} />
              ))}
            </div>
          )}

          {/* Global WhatsApp metrics */}
          {whatsappResult && (
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
              {whatsappResult.latency_ms != null && (
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Latência média: {formatLatency(whatsappResult.latency_ms)}
                </span>
              )}
              {whatsappResult.details && (
                <span className="flex items-center gap-1">
                  <Activity className="h-3 w-3" /> {whatsappResult.details}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Check: {formatDate(whatsappResult.checked_at)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Other integrations (SolarMarket, OpenAI) ── */}
      <div className="grid gap-4">
        {(["solarmarket", "openai", "google_gemini"] as const).map((id) => {
          const meta = INTEGRATION_META[id];
          const result = otherResults.find((r) => r.id === id);
          const Icon = meta.icon;
          const isChecking = checkingId === id;
          const statusCfg = result ? STATUS_CONFIG[result.status] : null;
          const StatusIcon = statusCfg?.icon;

          return (
            <Card key={id} className="transition-all hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-2.5 rounded-xl bg-muted/50 ${meta.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{meta.description.split("—")[0]?.trim()}</h3>
                        {statusCfg && StatusIcon && (
                          <Badge variant="outline" className={`gap-1 text-xs ${statusCfg.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusCfg.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{meta.description}</p>

                      {result && (
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {result.latency_ms != null && (
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" /> Latência: {formatLatency(result.latency_ms)}
                            </span>
                          )}
                          {result.details && (
                            <span className="flex items-center gap-1">
                              <Activity className="h-3 w-3" /> {result.details}
                            </span>
                          )}
                          {result.last_event && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Último evento: {formatDate(result.last_event)}
                            </span>
                          )}
                        </div>
                      )}

                      {!result && !hasChecked && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Clique em "Verificar" para checar o status
                        </p>
                      )}

                      {meta.configurable && (
                        <InlineApiKeyConfig
                          serviceKey={id}
                          meta={meta}
                          currentStatus={result}
                          onSaved={() => runHealthCheck(id)}
                        />
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runHealthCheck(id)}
                    disabled={isChecking || loading}
                    className="gap-1.5 shrink-0"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? "animate-spin" : ""}`} />
                    {isChecking ? "Testando..." : "Testar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default IntegrationStatusPage;
