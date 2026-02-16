import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, RefreshCw, Wifi, WifiOff, AlertTriangle, Clock, Zap, Settings } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface HealthRow {
  id: string;
  integration_name: string;
  status: string;
  last_check_at: string;
  latency_ms: number | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Wifi; color: string }> = {
  healthy: { label: "Conectado", variant: "default", icon: Wifi, color: "text-success" },
  degraded: { label: "Degradado", variant: "secondary", icon: AlertTriangle, color: "text-warning" },
  down: { label: "Offline", variant: "destructive", icon: WifiOff, color: "text-destructive" },
  not_configured: { label: "Não configurado", variant: "outline", icon: Clock, color: "text-muted-foreground" },
  unknown: { label: "Desconhecido", variant: "outline", icon: Clock, color: "text-muted-foreground" },
};

const INTEGRATION_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  openai: "OpenAI",
  google_gemini: "Google Gemini",
  google_calendar: "Google Agenda",
  solarmarket: "SolarMarket",
  instagram: "Instagram",
  webhooks: "Webhooks",
  pagamentos: "Pagamentos (Asaas)",
  automacoes: "Automações",
  evolution_api: "Evolution API",
};

const CONFIG_ROUTES: Record<string, string> = {
  whatsapp: "/admin/wa-instances",
  openai: "/admin/openai-config",
  google_gemini: "/admin/gemini-config",
  google_calendar: "/admin/integracoes",
  solarmarket: "/admin/solarmarket-config",
  instagram: "/admin/instagram",
  webhooks: "/admin/webhooks",
  pagamentos: "/admin/payment-gateway",
  automacoes: "/admin/n8n",
  evolution_api: "/admin/evolution-api",
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
}

export default function IntegrationHealthPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: healthData = [], isLoading, isFetching } = useQuery({
    queryKey: ["integration-health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_health_cache")
        .select("*")
        .order("integration_name");
      if (error) throw error;
      return (data || []) as HealthRow[];
    },
    refetchInterval: 60_000,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("integration-health-check", {
        body: { manual: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Verificação concluída");
      queryClient.invalidateQueries({ queryKey: ["integration-health"] });
    },
    onError: () => toast.error("Erro ao verificar integrações"),
  });

  const healthy = healthData.filter((h) => h.status === "healthy").length;
  const degraded = healthData.filter((h) => h.status === "degraded").length;
  const down = healthData.filter((h) => h.status === "down").length;
  const notConfigured = healthData.filter((h) => h.status === "not_configured").length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="Saúde das integrações"
        description="Status em tempo real de todas as conexões externas"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending || isFetching}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", (refreshMutation.isPending || isFetching) && "animate-spin")} />
            Verificar agora
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <SummaryCard label="Conectadas" value={healthy} color="text-success" />
        <SummaryCard label="Degradadas" value={degraded} color="text-warning" />
        <SummaryCard label="Offline" value={down} color="text-destructive" />
        <SummaryCard label="Não configuradas" value={notConfigured} color="text-muted-foreground" />
      </div>

      {/* Integration list */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-xl animate-pulse">
              <CardContent className="p-5 h-24" />
            </Card>
          ))}
        </div>
      ) : healthData.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma integração monitorada ainda.</p>
            <p className="text-xs mt-1">O sistema verifica automaticamente a cada 5 minutos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {healthData.map((item) => (
            <IntegrationCard key={item.id} item={item} onConfigure={(route) => navigate(route)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("text-2xl font-bold", color)}>{value}</span>
      </CardContent>
    </Card>
  );
}

function IntegrationCard({ item, onConfigure }: { item: HealthRow; onConfigure?: (route: string) => void }) {
  const cfg = getStatusConfig(item.status);
  const StatusIcon = cfg.icon;
  const lastCheck = item.last_check_at
    ? formatDistanceToNow(new Date(item.last_check_at), { addSuffix: true, locale: ptBR })
    : "nunca";
  const configRoute = CONFIG_ROUTES[item.integration_name];

  return (
    <Card className="rounded-xl hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("p-2 rounded-lg bg-muted/50", cfg.color)}>
              <StatusIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{INTEGRATION_LABELS[item.integration_name] || item.integration_name}</p>
              <p className="text-xs text-muted-foreground">Último check: {lastCheck}</p>
            </div>
          </div>
          <Badge variant={cfg.variant} className="shrink-0">{cfg.label}</Badge>
        </div>

        {/* Latency + error */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {item.latency_ms != null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" /> {item.latency_ms}ms
                  </span>
                </TooltipTrigger>
                <TooltipContent>Latência da última verificação</TooltipContent>
              </Tooltip>
            )}
            {item.error_message && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-destructive truncate max-w-[200px]">{item.error_message}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{item.error_message}</TooltipContent>
              </Tooltip>
            )}
          </div>
          {configRoute && onConfigure && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => onConfigure(configRoute)}>
              <Settings className="h-3 w-3" />
              Configurar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
