import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Globe,
  Sparkles,
  Calendar,
  Shield,
  ArrowRight,
  PenTool,
  Satellite,
  Download,
  Loader2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui-kit/Spinner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SignatureTab } from "@/components/admin/documentos/SignatureTab";

// ── Types ──

type HealthStatus = "healthy" | "degraded" | "down" | "not_configured";

interface HealthRecord {
  integration_name: string;
  status: HealthStatus;
  latency_ms: number | null;
  error_message: string | null;
  details: Record<string, unknown>;
  last_check_at: string;
}

interface IntegrationMeta {
  icon: typeof MessageCircle;
  label: string;
  description: string;
  color: string;
  configurable: boolean;
  serviceKey?: string;
  placeholder?: string;
  helpText?: string;
}

const INTEGRATIONS: Record<string, IntegrationMeta> = {
  whatsapp: {
    icon: MessageCircle,
    label: "WhatsApp",
    description: "Evolution API — Envio e recebimento de mensagens",
    color: "text-success",
    configurable: false,
  },
  openai: {
    icon: Brain,
    label: "OpenAI",
    description: "Assistente de escrita e sugestões comerciais",
    color: "text-secondary",
    configurable: true,
    serviceKey: "openai",
    placeholder: "sk-...",
    helpText: "Chave da API OpenAI. Validada antes de salvar.",
  },
  google_gemini: {
    icon: Sparkles,
    label: "Google Gemini",
    description: "IA alternativa para assistente de escrita",
    color: "text-primary",
    configurable: true,
    serviceKey: "google_gemini",
    placeholder: "AIzaSy...",
    helpText: "Chave da API Google Gemini (AI Studio).",
  },
  google_calendar: {
    icon: Calendar,
    label: "Google Calendar",
    description: "Sincronização bidirecional de agenda",
    color: "text-info",
    configurable: false,
  },
};

const STATUS_CONFIG: Record<HealthStatus, { icon: typeof CheckCircle2; label: string; className: string; dotColor: string }> = {
  healthy: { icon: CheckCircle2, label: "Operacional", className: "bg-success/10 text-success border-success/20", dotColor: "bg-success" },
  degraded: { icon: AlertTriangle, label: "Degradado", className: "bg-warning/10 text-warning border-warning/20", dotColor: "bg-warning" },
  down: { icon: XCircle, label: "Offline", className: "bg-destructive/10 text-destructive border-destructive/20", dotColor: "bg-destructive" },
  not_configured: { icon: CircleDashed, label: "Não configurado", className: "bg-muted text-muted-foreground border-border", dotColor: "bg-muted-foreground/40" },
};

// ── Helpers ──

function timeAgo(iso?: string | null): string {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Agora";
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

function isStale(iso?: string | null): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > 15 * 60 * 1000; // 15 min
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
  currentStatus?: HealthStatus;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const isConfigured = currentStatus && currentStatus !== "not_configured";

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("save-integration-key", {
        body: { service_key: serviceKey, api_key: apiKey.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.details || data.error);
      toast({ title: "Chave salva", description: `API key de ${meta.label} validada e salva.` });
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
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
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
          {isConfigured ? "Alterar" : "Configurar"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
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

// ── App URL Config Card ──

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
    if (!trimmed.startsWith("https://")) return "HTTPS obrigatório.";
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname !== "/" && parsed.pathname !== "") return "Sem caminhos (/path).";
      if (parsed.search) return "Sem query strings.";
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
      toast({ title: "URL pública salva", description: "Links e metatags usarão este domínio." });
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
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          URL Pública
          {currentUrl && (
            <Badge variant="outline" className="ml-2 bg-success/10 text-success border-success/20 gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3" /> Configurado
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Domínio para links, QR codes e metatags.
          <span className="text-muted-foreground/80"> OAuth/callbacks usam URL de segurança fixa (secret).</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Spinner size="sm" />
        ) : editing ? (
          <div className="space-y-3">
            <Input
              placeholder="https://app.maisenergiasolar.com.br"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">HTTPS obrigatório. Apenas domínio, sem caminhos.</p>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !url.trim()} size="sm" className="gap-1.5">
                {saving ? <Spinner size="sm" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setUrl(""); }}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className={`text-sm ${currentUrl ? "font-mono text-foreground" : "text-muted-foreground italic"}`}>
              {currentUrl || `Usando domínio atual (${window.location.origin})`}
            </p>
            <Button variant="outline" size="sm" onClick={() => { setEditing(true); setUrl(currentUrl || ""); }} className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              {currentUrl ? "Alterar" : "Configurar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Integration Health Card ──

function IntegrationHealthCard({
  name,
  health,
  onRefreshed,
}: {
  name: string;
  health?: HealthRecord;
  onRefreshed: () => void;
}) {
  const meta = INTEGRATIONS[name];
  if (!meta) return null;

  const status = health?.status || "not_configured";
  const statusCfg = STATUS_CONFIG[status];
  const Icon = meta.icon;
  const StatusIcon = statusCfg.icon;
  const stale = isStale(health?.last_check_at);

  return (
    <Card className="border-border/60 transition-all hover:shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`p-2.5 rounded-xl bg-muted/50 shrink-0 ${meta.color}`}>
            <Icon className="h-5 w-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header row */}
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-semibold text-sm">{meta.label}</h3>
              <Badge variant="outline" className={`gap-1 text-xs ${statusCfg.className}`}>
                <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </Badge>
              {stale && health?.last_check_at && (
                <Badge variant="outline" className="gap-1 text-xs bg-warning/10 text-warning border-warning/20">
                  <Clock className="h-3 w-3" /> Dados antigos
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground">{meta.description}</p>

            {/* Metrics row */}
            {health && status !== "not_configured" && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {health.latency_ms != null && (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    <span className={
                      health.latency_ms < 500 ? "text-success font-medium" :
                      health.latency_ms < 2000 ? "text-warning font-medium" :
                      "text-destructive font-medium"
                    }>
                      {health.latency_ms}ms
                    </span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {timeAgo(health.last_check_at)}
                </span>
              </div>
            )}

            {/* Error message */}
            {health?.error_message && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/15">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive break-all">{health.error_message}</p>
              </div>
            )}

            {/* WhatsApp instance details */}
            {name === "whatsapp" && health?.details && (health.details as any).instances && (
              <div className="space-y-1.5 pt-1">
                {((health.details as any).instances as any[]).map((inst: any, i: number) => (
                  <div key={i} className={`flex items-center gap-2 text-xs p-1.5 rounded-md ${inst.ok ? "bg-success/5" : "bg-destructive/5"}`}>
                    <div className={`h-2 w-2 rounded-full shrink-0 ${inst.ok ? "bg-success" : "bg-destructive"}`} />
                    <span className="font-medium">{inst.name}</span>
                    {inst.phone && <span className="text-muted-foreground">{inst.phone}</span>}
                    {inst.state && <Badge variant="outline" className="text-[10px] h-4">{inst.state}</Badge>}
                    {inst.latency_ms != null && <span className="text-muted-foreground ml-auto">{inst.latency_ms}ms</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Google Calendar details */}
            {name === "google_calendar" && health?.details && (
              <div className="text-xs text-muted-foreground">
                {(health.details as any).connected_users != null && (
                  <span>{(health.details as any).connected_users} usuário(s) conectado(s)</span>
                )}
              </div>
            )}

            {/* API Key Config */}
            {meta.configurable && meta.serviceKey && (
              <InlineApiKeyConfig
                serviceKey={meta.serviceKey}
                meta={meta}
                currentStatus={status}
                onSaved={onRefreshed}
              />
            )}

            {/* Not configured CTA */}
            {status === "not_configured" && !meta.configurable && (
              <div className="flex items-center gap-2 mt-1 p-2.5 rounded-lg bg-muted/50 border border-border/50">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {name === "whatsapp" && "Configure instâncias em Admin > WhatsApp"}
                  
                  {name === "google_calendar" && "Configure credenciais em Admin > Google Calendar"}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Global Status Banner ──

function GlobalStatusBanner({ records }: { records: HealthRecord[] }) {
  const configured = records.filter((r) => r.status !== "not_configured");
  const healthy = configured.filter((r) => r.status === "healthy").length;
  const degraded = configured.filter((r) => r.status === "degraded").length;
  const down = configured.filter((r) => r.status === "down").length;
  const notConfigured = records.filter((r) => r.status === "not_configured").length;
  const total = configured.length;

  if (total === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border/60">
        <CircleDashed className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">Nenhuma integração configurada</p>
          <p className="text-xs text-muted-foreground/70">Configure suas integrações para começar a monitorar</p>
        </div>
      </div>
    );
  }

  const allHealthy = healthy === total && total > 0;
  const hasIssues = degraded > 0 || down > 0;

  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
      allHealthy
        ? "bg-success/5 border-success/20"
        : hasIssues
        ? "bg-warning/5 border-warning/20"
        : "bg-muted/50 border-border/60"
    }`}>
      <div className={`h-3 w-3 rounded-full shrink-0 ${
        allHealthy ? "bg-success animate-pulse" : hasIssues ? "bg-warning animate-pulse" : "bg-muted-foreground/40"
      }`} />
      <div className="flex-1">
        <p className={`text-sm font-semibold ${
          allHealthy ? "text-success" : hasIssues ? "text-warning" : "text-foreground"
        }`}>
          {allHealthy
            ? "Sistema operacional"
            : down > 0
            ? `${down} integração(ões) offline`
            : `${degraded} integração(ões) com atenção`}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {healthy > 0 && (
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> {healthy} ok</span>
          )}
          {degraded > 0 && (
            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-warning" /> {degraded} degradado</span>
          )}
          {down > 0 && (
            <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" /> {down} offline</span>
          )}
          {notConfigured > 0 && (
            <span className="flex items-center gap-1"><CircleDashed className="h-3 w-3" /> {notConfigured} não configurado</span>
          )}
        </div>
      </div>
      <Shield className={`h-5 w-5 shrink-0 ${allHealthy ? "text-success/40" : "text-muted-foreground/30"}`} />
    </div>
  );
}

// ── NASA API Key Field (optional, for future use) ──

function NasaApiKeyField() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("integration_configs")
      .select("api_key")
      .eq("service_key", "nasa_power_api_key")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.api_key) {
          setApiKey(data.api_key);
          setSaved(true);
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    // Check if row exists
    const { data: existing } = await supabase
      .from("integration_configs")
      .select("id")
      .eq("service_key", "nasa_power_api_key")
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("integration_configs")
        .update({ api_key: apiKey, is_active: true })
        .eq("service_key", "nasa_power_api_key"));
    } else {
      ({ error } = await supabase
        .from("integration_configs")
        .insert({ service_key: "nasa_power_api_key", api_key: apiKey, is_active: true } as any));
    }
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      setSaved(true);
      toast({ title: "API Key salva" });
    }
  };

  if (loading) return null;

  return (
    <div className="flex items-center gap-2">
      <Input
        type="password"
        placeholder="Opcional — deixe vazio se não necessária"
        value={apiKey}
        onChange={(e) => { setApiKey(e.target.value); setSaved(false); }}
        className="h-7 text-xs font-mono"
      />
      <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={handleSave} disabled={saved}>
        {saved ? "Salvo" : "Salvar"}
      </Button>
    </div>
  );
}

// ── NASA POWER Integration Card ──
function NasaPowerCard() {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; percent: number } | null>(null);

  const { data: nasaVersion, refetch: refetchNasa } = useQuery({
    queryKey: ["nasa-power-version"],
    staleTime: 15_000,
    refetchInterval: syncing ? 5_000 : 60_000,
    queryFn: async () => {
      const { data: ds } = await supabase
        .from("irradiance_datasets")
        .select("id")
        .eq("code", "NASA_POWER_GLOBAL")
        .single();
      if (!ds) return null;

      const { data: versions } = await supabase
        .from("irradiance_dataset_versions")
        .select("id, version_tag, status, row_count, metadata, created_at, updated_at")
        .eq("dataset_id", ds.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const version = versions?.[0] ?? null;

      if (version?.status === "processing") {
        const meta = version.metadata as Record<string, any> | null;
        const step = meta?.step_deg ?? 0.125;
        const bbox = { latMin: -33.5, latMax: 5.5, lonMin: -74.0, lonMax: -35.0 };
        const totalExpected = (Math.floor((bbox.latMax - bbox.latMin) / step) + 1) * (Math.floor((bbox.lonMax - bbox.lonMin) / step) + 1);
        const current = version.row_count ?? 0;
        setProgress({ current, total: totalExpected, percent: totalExpected > 0 ? Math.round((current / totalExpected) * 100) : 0 });
      } else {
        if (syncing && version?.status === "active") {
          setSyncing(false);
          toast({ title: "NASA POWER sincronizado!", description: `${version.row_count?.toLocaleString()} pontos importados.` });
        }
        setProgress(null);
      }
      return version;
    },
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("irradiance-fetch", {
        body: {
          dataset_code: "NASA_POWER_GLOBAL",
          version_tag: `v${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, "0")}`,
          step_deg: 0.125,
        },
      });
      if (error) throw error;

      if (data?.error === "VERSION_EXISTS") {
        toast({ title: "Versão já existe", description: data.message });
        setSyncing(false);
        return;
      }
      if (data?.error === "VERSION_PROCESSING") {
        toast({ title: "Importação em andamento", description: data.message });
        return;
      }
      toast({ title: "Sincronização iniciada!", description: "Dados sendo buscados da NASA POWER API em segundo plano." });
      refetchNasa();
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
      setSyncing(false);
    }
  };

  const isProcessing = nasaVersion?.status === "processing";
  const isActive = nasaVersion?.status === "active";
  const isFailed = nasaVersion?.status === "failed";

  useEffect(() => {
    if (isProcessing && !syncing) setSyncing(true);
  }, [isProcessing, syncing]);

  const statusLabel = isActive ? "Operacional" : isProcessing ? "Sincronizando..." : isFailed ? "Falhou" : "Não configurado";
  const statusClass = isActive
    ? "bg-success/10 text-success border-success/20"
    : isProcessing ? "bg-info/10 text-info border-info/20"
    : isFailed ? "bg-destructive/10 text-destructive border-destructive/20"
    : "bg-muted text-muted-foreground border-border";
  const SIcon = isActive ? CheckCircle2 : isProcessing ? Loader2 : isFailed ? XCircle : CircleDashed;

  return (
    <Card className="border-border/60 transition-all hover:shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-muted/50 shrink-0 text-primary">
            <Satellite className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-semibold text-sm">NASA POWER API</h3>
              <Badge variant="outline" className={`gap-1 text-xs ${statusClass}`}>
                <SIcon className={`h-3 w-3 ${isProcessing ? "animate-spin" : ""}`} />
                {statusLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Dados globais de irradiância solar (GHI, DHI). Resolução 0.125° (~14km). API pública — chave opcional.
            </p>

            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                ⚙️ Configuração avançada (API Key)
              </summary>
              <div className="mt-2 space-y-1.5">
                <p className="text-[11px] text-muted-foreground">
                  A NASA POWER API é pública e não exige chave. Caso futuramente seja necessária, insira aqui.
                </p>
                <NasaApiKeyField />
              </div>
            </details>

            {isActive && nasaVersion && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  {nasaVersion.row_count?.toLocaleString()} pontos
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {nasaVersion.version_tag}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {timeAgo(nasaVersion.updated_at ?? nasaVersion.created_at)}
                </span>
              </div>
            )}

            {isProcessing && progress && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progress.current.toLocaleString()} / {progress.total.toLocaleString()} pontos</span>
                  <span>{progress.percent}%</span>
                </div>
                <Progress value={progress.percent} className="h-2" />
                <p className="text-[10px] text-muted-foreground">
                  ⏳ Importação em segundo plano (~5-8h). Pode navegar normalmente.
                </p>
              </div>
            )}

            {isFailed && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/15">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">Última sincronização falhou. Clique para tentar novamente.</p>
              </div>
            )}

            <div className="pt-1">
              <Button size="sm" variant={isActive ? "outline" : "default"} onClick={handleSync} disabled={isProcessing} className="gap-2">
                {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {isProcessing ? "Sincronizando..." : isActive ? "Atualizar Dados" : "Sincronizar"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──

export function IntegrationStatusPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Read from cache table — no external API calls
  const { data: healthRecords = [], isLoading } = useQuery({
    queryKey: ["integration-health-cache"],
    staleTime: 30 * 1000, // 30s
    refetchInterval: 60 * 1000, // auto-refresh every 60s
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_health_cache")
        .select("integration_name, status, latency_ms, error_message, details, last_check_at")
        .order("integration_name");

      if (error) throw error;
      return (data || []) as HealthRecord[];
    },
  });

  // Auto-check on first load if no data — wait for auth session
  const hasData = healthRecords.length > 0;
  const [autoChecked, setAutoChecked] = useState(false);

  useEffect(() => {
    if (isLoading || hasData || autoChecked) return;

    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      setAutoChecked(true);
      handleRefresh();
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, hasData, autoChecked]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Use fetch directly to have full control over headers
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sessão não encontrada. Faça login novamente.");
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/integration-health-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey,
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }

      await queryClient.invalidateQueries({ queryKey: ["integration-health-cache"] });
    } catch (err: any) {
      console.error("Health check error:", err);
      toast({ title: "Erro no health check", description: err.message, variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, toast]);

  const getHealth = (name: string) => healthRecords.find((r) => r.integration_name === name);

  // Build display list — show all known integrations, even unchecked
  const integrationNames = Object.keys(INTEGRATIONS);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Saúde do Sistema
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento em tempo real das integrações
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Verificando..." : "Atualizar"}
        </Button>
      </div>

      {/* Global Status Banner */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" />
        </div>
      ) : (
        <>
          <GlobalStatusBanner records={integrationNames.map((n) => getHealth(n) || {
            integration_name: n,
            status: "not_configured" as HealthStatus,
            latency_ms: null,
            error_message: null,
            details: {},
            last_check_at: "",
          })} />

          {/* URL Config */}
          <AppUrlConfigCard />

          {/* Integration Cards */}
          <div className="grid gap-4">
            {integrationNames.map((name) => (
              <IntegrationHealthCard
                key={name}
                name={name}
                health={getHealth(name)}
                onRefreshed={handleRefresh}
              />
            ))}
          </div>

          {/* Dados Solares */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <Sun className="h-4 w-4" />
              Dados Solares
            </h3>
            <NasaPowerCard />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <PenTool className="h-4 w-4" />
              Assinatura Eletrônica
            </h3>
            <SignatureTab />
          </div>
        </>
      )}
    </div>
  );
}

export default IntegrationStatusPage;
