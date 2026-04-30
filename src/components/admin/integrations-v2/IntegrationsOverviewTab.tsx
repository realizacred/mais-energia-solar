/**
 * IntegrationsOverviewTab — Visão Geral das Integrações (Fase 1)
 *
 * Agrega status operacional por domínio (WhatsApp, SolarMarket, IA, Conexões)
 * usando APENAS tabelas existentes. Não cria nova fonte de verdade.
 *
 * RB-69: respeita arquitetura existente; não duplica páginas.
 * AGENTS.md §16: bg-card, border-l semântico, sem cores hardcoded.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import {
  MessageCircle,
  Cloud,
  Brain,
  Plug,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface DomainStat {
  total: number;
  ok: number;
  pending: number;
  error: number;
  lastActivity?: string | null;
}

interface OverviewData {
  whatsapp: DomainStat;
  solarmarket: DomainStat;
  ia: DomainStat;
  conexoes: DomainStat;
}

async function loadOverview(tenantId: string): Promise<OverviewData> {
  // WhatsApp: wa_instances
  const waInstances = await supabase
    .from("wa_instances")
    .select("id, status, updated_at")
    .eq("tenant_id", tenantId);

  const waList = waInstances.data ?? [];
  const waOk = waList.filter((i: any) => i.status === "connected" || i.status === "open").length;
  const waError = waList.filter((i: any) => ["disconnected", "close", "error"].includes(i.status)).length;
  const waLast = waList.reduce(
    (acc: string | null, i: any) => (i.updated_at && (!acc || i.updated_at > acc) ? i.updated_at : acc),
    null
  );

  // SolarMarket: solarmarket_promotion_jobs (último)
  const smJobs = await supabase
    .from("solarmarket_promotion_jobs")
    .select("id, status, created_at, last_step_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);

  const smList = smJobs.data ?? [];
  const smRunning = smList.filter((j: any) => j.status === "running").length;
  const smError = smList.filter((j: any) => j.status === "failed" || j.status === "error").length;
  const smOk = smList.filter((j: any) => j.status === "completed" || j.status === "done").length;
  const smLast = smList[0]?.last_step_at ?? smList[0]?.created_at ?? null;

  // IA: ai_features_config
  const aiFeatures = await supabase
    .from("ai_features_config")
    .select("feature_key, enabled, updated_at")
    .eq("tenant_id", tenantId);

  const aiList = aiFeatures.data ?? [];
  const aiOk = aiList.filter((f: any) => f.enabled).length;
  const aiLast = aiList.reduce(
    (acc: string | null, f: any) => (f.updated_at && (!acc || f.updated_at > acc) ? f.updated_at : acc),
    null
  );

  // Conexões: integration_connections
  const conns = await supabase
    .from("integration_connections")
    .select("id, status, updated_at")
    .eq("tenant_id", tenantId);

  const cList = conns.data ?? [];
  const cOk = cList.filter((c: any) => c.status === "connected" || c.status === "active").length;
  const cError = cList.filter((c: any) => c.status === "error" || c.status === "failed").length;
  const cPending = cList.filter((c: any) => c.status === "pending" || c.status === "syncing").length;
  const cLast = cList.reduce(
    (acc: string | null, c: any) => (c.updated_at && (!acc || c.updated_at > acc) ? c.updated_at : acc),
    null
  );

  return {
    whatsapp: { total: waList.length, ok: waOk, pending: 0, error: waError, lastActivity: waLast },
    solarmarket: { total: smList.length, ok: smOk, pending: smRunning, error: smError, lastActivity: smLast },
    ia: { total: aiList.length, ok: aiOk, pending: 0, error: 0, lastActivity: aiLast },
    conexoes: { total: cList.length, ok: cOk, pending: cPending, error: cError, lastActivity: cLast },
  };
}

function formatDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return "—";
  }
}

interface DomainCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  borderClass: string;
  iconColor: string;
  stat: DomainStat;
  onOpen: () => void;
}

function DomainCard({ title, description, icon: Icon, borderClass, iconColor, stat, onOpen }: DomainCardProps) {
  const hasError = stat.error > 0;
  const hasPending = stat.pending > 0;

  return (
    <Card className={`p-5 bg-card border-border shadow-sm border-l-4 ${borderClass} hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`p-2 rounded-md bg-muted ${iconColor} shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        {hasError ? (
          <Badge variant="destructive" className="shrink-0">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {stat.error}
          </Badge>
        ) : stat.ok > 0 ? (
          <Badge variant="secondary" className="shrink-0 bg-success/10 text-success border-success/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            OK
          </Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="text-center">
          <p className="text-xl font-bold text-foreground">{stat.total}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-success">{stat.ok}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ativos</p>
        </div>
        <div className="text-center">
          <p className={`text-xl font-bold ${hasError ? "text-destructive" : hasPending ? "text-warning" : "text-muted-foreground"}`}>
            {stat.error || stat.pending || 0}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {hasError ? "Erros" : "Pendentes"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <span className="text-xs text-muted-foreground truncate">
          Última: {formatDate(stat.lastActivity)}
        </span>
        <Button size="sm" variant="ghost" onClick={onOpen} className="shrink-0 -mr-2">
          Abrir <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </Card>
  );
}

export default function IntegrationsOverviewTab() {
  const navigate = useNavigate();
  const { data: tenantId } = useTenantId();

  const { data, isLoading } = useQuery({
    queryKey: ["integrations-overview", tenantId],
    queryFn: () => loadOverview(tenantId!),
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return <LoadingState message="Carregando visão geral das integrações…" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Visão Geral</h2>
        <p className="text-sm text-muted-foreground">
          Controle operacional das conexões, automações e sincronizações do sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DomainCard
          title="WhatsApp"
          description="Instâncias, IA e atendimento"
          icon={MessageCircle}
          borderClass="border-l-success"
          iconColor="text-success"
          stat={data.whatsapp}
          onOpen={() => navigate("/admin/whatsapp/saude")}
        />
        <DomainCard
          title="SolarMarket"
          description="Migração e sincronização de dados"
          icon={Cloud}
          borderClass="border-l-primary"
          iconColor="text-primary"
          stat={data.solarmarket}
          onOpen={() => navigate("/admin/migracao-solarmarket")}
        />
        <DomainCard
          title="IA"
          description="Provedores, features e scoring"
          icon={Brain}
          borderClass="border-l-info"
          iconColor="text-info"
          stat={data.ia}
          onOpen={() => navigate("/admin/ai-config")}
        />
        <DomainCard
          title="Conexões"
          description="Provedores e credenciais"
          icon={Plug}
          borderClass="border-l-warning"
          iconColor="text-warning"
          stat={data.conexoes}
          onOpen={() => navigate("/admin/catalogo-integracoes?tab=catalogo")}
        />
      </div>
    </div>
  );
}
