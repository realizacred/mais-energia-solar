import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

interface IntegrationResult {
  id: string;
  name: string;
  status: "online" | "offline" | "degraded" | "not_configured";
  latency_ms?: number;
  details?: string;
  last_event?: string;
  checked_at: string;
}

const INTEGRATION_META: Record<string, { icon: typeof MessageCircle; color: string; description: string }> = {
  whatsapp: {
    icon: MessageCircle,
    color: "text-green-500",
    description: "Evolution API — Envio e recebimento de mensagens",
  },
  solarmarket: {
    icon: Sun,
    color: "text-amber-500",
    description: "Marketplace solar — Sync de clientes e projetos",
  },
  openai: {
    icon: Brain,
    color: "text-violet-500",
    description: "IA — Sugestões comerciais e análise de leads",
  },
};

const STATUS_CONFIG = {
  online: { icon: CheckCircle2, label: "Online", variant: "default" as const, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  offline: { icon: XCircle, label: "Offline", variant: "destructive" as const, className: "bg-destructive/10 text-destructive border-destructive/20" },
  degraded: { icon: AlertTriangle, label: "Degradado", variant: "outline" as const, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  not_configured: { icon: CircleDashed, label: "Não configurado", variant: "secondary" as const, className: "bg-muted text-muted-foreground" },
};

export function IntegrationStatusPage() {
  const { toast } = useToast();
  const [results, setResults] = useState<IntegrationResult[]>([]);
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

      setHasChecked(true);
    } catch (err: any) {
      console.error("Health check error:", err);
      toast({
        title: "Erro no health check",
        description: err.message || "Falha ao verificar integrações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setCheckingId(null);
    }
  }, [toast]);

  const formatLatency = (ms?: number) => {
    if (!ms) return null;
    if (ms < 500) return <span className="text-emerald-600">{ms}ms</span>;
    if (ms < 2000) return <span className="text-amber-600">{ms}ms</span>;
    return <span className="text-destructive">{ms}ms</span>;
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

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
            Monitoramento em tempo real das APIs conectadas ao sistema
          </p>
        </div>
        <Button
          onClick={() => runHealthCheck("all")}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Verificando..." : "Verificar Tudo"}
        </Button>
      </div>

      {/* Summary badges */}
      {hasChecked && results.length > 0 && (
        <div className="flex items-center gap-3">
          {["online", "degraded", "offline", "not_configured"].map((status) => {
            const count = results.filter((r) => r.status === status).length;
            if (count === 0) return null;
            const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
            const Icon = cfg.icon;
            return (
              <Badge key={status} variant="outline" className={`gap-1.5 ${cfg.className}`}>
                <Icon className="h-3.5 w-3.5" />
                {count} {cfg.label}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Cards */}
      <div className="grid gap-4">
        {(["whatsapp", "solarmarket", "openai"] as const).map((id) => {
          const meta = INTEGRATION_META[id];
          const result = results.find((r) => r.id === id);
          const Icon = meta.icon;
          const isChecking = checkingId === id;
          const statusCfg = result ? STATUS_CONFIG[result.status] : null;
          const StatusIcon = statusCfg?.icon;

          return (
            <Card key={id} className="transition-all hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-xl bg-muted/50 ${meta.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{INTEGRATION_META[id]?.description?.split("—")[0]?.trim() || id}</h3>
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
                              <Zap className="h-3 w-3" />
                              Latência: {formatLatency(result.latency_ms)}
                            </span>
                          )}
                          {result.details && (
                            <span className="flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              {result.details}
                            </span>
                          )}
                          {result.last_event && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Último evento: {formatDate(result.last_event)}
                            </span>
                          )}
                        </div>
                      )}

                      {!result && !hasChecked && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Clique em "Verificar" para checar o status
                        </p>
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

      {/* OpenAI note */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Brain className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Sobre a chave da OpenAI</p>
              <p className="text-muted-foreground mt-1">
                A chave é armazenada como <strong>Supabase Secret</strong> (OPENAI_API_KEY) e acessível apenas pelas Edge Functions.
                Ela nunca é exposta ao frontend. Para substituí-la, acesse as configurações de Secrets do projeto no Supabase Dashboard.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default IntegrationStatusPage;
