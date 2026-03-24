/**
 * SystemStatusCard — Top-level operational dashboard for UC settings.
 * Shows real status + quick actions for: Faturas, Alertas, Portal, Cobrança.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Mail,
  Bell,
  Share2,
  DollarSign,
  Settings,
  Play,
  UserPlus,
  Send,
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

interface Props {
  unitId: string;
  leituraAutomaticaEmail?: boolean;
  servicoCobrancaAtivo?: boolean;
  onNavigateToSection?: (section: string) => void;
  onAction?: (action: string) => void;
}

const STALE = 1000 * 60 * 5;

type StatusLevel = "ok" | "warning" | "error" | "inactive";

interface ModuleAction {
  label: string;
  icon: React.ReactNode;
  /** If starts with "action:", triggers onAction; otherwise scrolls to section */
  section: string;
}

interface ModuleStatus {
  label: string;
  status: StatusLevel;
  detail: string;
  icon: React.ReactNode;
  action?: ModuleAction;
}

function statusIcon(s: StatusLevel) {
  switch (s) {
    case "ok":
      return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4 text-warning shrink-0" />;
    case "error":
      return <XCircle className="w-4 h-4 text-destructive shrink-0" />;
    default:
      return <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />;
  }
}

function statusBadgeClass(s: StatusLevel) {
  switch (s) {
    case "ok":
      return "border-success/30 text-success bg-success/10";
    case "warning":
      return "border-warning/30 text-warning bg-warning/10";
    case "error":
      return "border-destructive/30 text-destructive bg-destructive/10";
    default:
      return "border-border text-muted-foreground";
  }
}

export function SystemStatusCard({ unitId, leituraAutomaticaEmail, servicoCobrancaAtivo, onNavigateToSection, onAction }: Props) {
  // Last invoice
  const { data: lastInvoice } = useQuery({
    queryKey: ["system_status_invoice", unitId],
    queryFn: async () => {
      const { data } = await supabase
        .from("unit_invoices")
        .select("id, status, source, created_at, reference_month, reference_year")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: STALE,
  });

  // Last processing log
  const { data: lastLog } = useQuery({
    queryKey: ["system_status_log", unitId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("invoice_processing_logs")
        .select("id, status, message, source, created_at")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { id: string; status: string; message: string | null; source: string | null; created_at: string } | null;
    },
    staleTime: STALE,
  });

  // Portal users
  const { data: portalUsers = [] } = useQuery({
    queryKey: ["system_status_portal", unitId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("client_portal_users")
        .select("id, is_active, last_login_at")
        .eq("unit_id", unitId)
        .eq("is_active", true);
      return (data ?? []) as { id: string; is_active: boolean; last_login_at: string | null }[];
    },
    staleTime: STALE,
  });

  // Portal tokens
  const { data: tokens = [] } = useQuery({
    queryKey: ["system_status_tokens", unitId],
    queryFn: async () => {
      const { data } = await supabase
        .from("uc_client_tokens")
        .select("id")
        .eq("unit_id", unitId)
        .eq("is_active", true);
      return data ?? [];
    },
    staleTime: STALE,
  });

  // Last energy alert
  const { data: lastAlert } = useQuery({
    queryKey: ["system_status_alert", unitId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("energy_alerts")
        .select("id, created_at, severity, status, resolved_at")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { id: string; created_at: string; severity: string; status: string; resolved_at: string | null } | null;
    },
    staleTime: STALE,
  });

  // Build module statuses
  const modules: ModuleStatus[] = [];

  // 1. Faturas
  const faturaStatus: StatusLevel = (() => {
    if (!leituraAutomaticaEmail && !lastInvoice) return "inactive";
    if (lastLog?.status === "error") return "error";
    if (lastInvoice?.status === "failed") return "error";
    if (leituraAutomaticaEmail && lastInvoice) return "ok";
    if (leituraAutomaticaEmail && !lastInvoice) return "warning";
    if (lastInvoice) return "ok";
    return "inactive";
  })();

  const faturaAction: ModuleAction | undefined = (() => {
    if (faturaStatus === "inactive") return { label: "Configurar", icon: <Settings className="w-3 h-3" />, section: "section-billing-settings" };
    if (faturaStatus === "warning") return { label: "Testar", icon: <Play className="w-3 h-3" />, section: "action:billing-test" };
    if (faturaStatus === "error") return { label: "Ver erro", icon: <AlertTriangle className="w-3 h-3" />, section: "section-billing-settings" };
    return undefined;
  })();

  modules.push({
    label: "Faturas",
    status: faturaStatus,
    detail: (() => {
      if (lastLog?.status === "error") return `Erro: ${lastLog.message || "falha no processamento"}`;
      if (lastInvoice) return `Última: ${formatDate(lastInvoice.created_at)}`;
      if (leituraAutomaticaEmail) return "Ativo — aguardando primeira fatura";
      return "Não configurado";
    })(),
    icon: <Mail className="w-3.5 h-3.5 text-primary" />,
    action: faturaAction,
  });

  // 2. Alertas
  const alertaStatus: StatusLevel = (() => {
    if (lastAlert && !lastAlert.resolved_at && lastAlert.severity === "critical") return "error";
    if (lastAlert && !lastAlert.resolved_at) return "warning";
    return "ok";
  })();

  modules.push({
    label: "Alertas",
    status: alertaStatus,
    detail: lastAlert
      ? lastAlert.resolved_at
        ? `Resolvido em ${formatDate(lastAlert.resolved_at)}`
        : `Ativo desde ${formatDate(lastAlert.created_at)}`
      : "Sem alertas — sistema normal",
    icon: <Bell className="w-3.5 h-3.5 text-primary" />,
    action: !lastAlert
      ? { label: "Configurar", icon: <Settings className="w-3 h-3" />, section: "section-billing-settings" }
      : undefined,
  });

  // 3. Portal
  const portalStatus: StatusLevel = (() => {
    if (portalUsers.length > 0 || tokens.length > 0) return "ok";
    return "inactive";
  })();

  const portalAction: ModuleAction | undefined = (() => {
    if (portalStatus === "inactive") return { label: "Criar acesso", icon: <UserPlus className="w-3 h-3" />, section: "section-portal" };
    const hasLogin = portalUsers.length > 0;
    const neverAccessed = hasLogin && !portalUsers[0]?.last_login_at;
    if (neverAccessed) return { label: "Enviar acesso", icon: <Send className="w-3 h-3" />, section: "action:portal-copy-link" };
    return undefined;
  })();

  modules.push({
    label: "Portal",
    status: portalStatus,
    detail: (() => {
      const parts: string[] = [];
      if (portalUsers.length > 0) {
        const loginUser = portalUsers[0];
        parts.push(loginUser.last_login_at ? `Último acesso: ${formatDate(loginUser.last_login_at)}` : "Login criado — nunca acessou");
      }
      if (tokens.length > 0) parts.push("Link público ativo");
      if (parts.length === 0) return "Sem acesso configurado";
      return parts.join(" · ");
    })(),
    icon: <Share2 className="w-3.5 h-3.5 text-primary" />,
    action: portalAction,
  });

  // 4. Cobrança
  modules.push({
    label: "Cobrança",
    status: servicoCobrancaAtivo ? "ok" : "inactive",
    detail: servicoCobrancaAtivo ? "Serviço ativo" : "Não configurado",
    icon: <DollarSign className="w-3.5 h-3.5 text-primary" />,
    action: !servicoCobrancaAtivo
      ? { label: "Configurar", icon: <Settings className="w-3 h-3" />, section: "section-billing-plan" }
      : undefined,
  });

  // Global status
  const globalStatus: StatusLevel = modules.some((m) => m.status === "error")
    ? "error"
    : modules.some((m) => m.status === "warning")
    ? "warning"
    : modules.every((m) => m.status === "ok")
    ? "ok"
    : "inactive";

  const globalLabel = (() => {
    switch (globalStatus) {
      case "ok": return "Tudo funcionando";
      case "warning": return "Atenção necessária";
      case "error": return "Problema detectado";
      default: return "Configuração pendente";
    }
  })();

  return (
    <Card className="border-l-[3px] border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Status do Sistema
            </CardTitle>
            <CardDescription className="mt-1">
              Visão geral do funcionamento de todos os módulos desta UC.
            </CardDescription>
          </div>
          <Badge variant="outline" className={`text-xs ${statusBadgeClass(globalStatus)}`}>
            {statusIcon(globalStatus)}
            <span className="ml-1">{globalLabel}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {modules.map((mod) => (
            <div
              key={mod.label}
              className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30 border border-border"
            >
              <div className="flex items-start gap-2.5">
                {statusIcon(mod.status)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {mod.icon}
                    <p className="text-xs font-semibold text-foreground">{mod.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {mod.detail}
                  </p>
                </div>
              </div>
              {mod.action && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs gap-1.5 mt-auto"
                  onClick={() => {
                    const sec = mod.action!.section;
                    if (sec.startsWith("action:") && onAction) {
                      onAction(sec.replace("action:", ""));
                    } else if (onNavigateToSection) {
                      onNavigateToSection(sec);
                    }
                  }}
                >
                  {mod.action.icon}
                  {mod.action.label}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
