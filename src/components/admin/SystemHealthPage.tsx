import React, { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Wifi, WifiOff, AlertTriangle, Zap, Server, RefreshCw, MessageSquare, CheckCircle2, ExternalLink, ChevronDown, ChevronUp, HelpCircle, BookOpen, ShieldAlert } from "lucide-react";
import { useSystemHealth, type HealthRow } from "@/hooks/useSystemHealth";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const INTEGRATION_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  openai: "OpenAI",
  google_gemini: "Google Gemini",
  google_calendar: "Google Agenda",
  google_maps: "Google Maps",
  solarmarket: "SolarMarket",
  meta_facebook: "Meta Facebook",
  instagram: "Instagram",
  webhooks: "Webhooks",
  pagamentos: "Pagamentos (Asaas)",
  automacoes: "Automações",
  evolution_api: "Evolution API",
  supabase: "Supabase (Banco de Dados)",
  edge_functions: "Edge Functions",
  storage: "Storage (Arquivos)",
  email: "E-mail (SMTP)",
  cron_jobs: "Cron Jobs",
  monitoramento_solar: "Monitoramento Solar",
  aneel: "ANEEL (Sync)",
  tuya: "Tuya (Medidores IoT)",
};

/** Orientação por integração — exibida para ajudar o admin */
const INTEGRATION_GUIDANCE: Record<string, { description: string; whenDown: string; configPath?: string }> = {
  whatsapp: {
    description: "Envio e recebimento de mensagens via Evolution API.",
    whenDown: "Verifique a instância em Catálogo de Integrações > Instâncias WhatsApp. Reconecte o QR Code se necessário.",
    configPath: "/admin/catalogo-integracoes",
  },
  openai: {
    description: "IA para geração de textos, resumos e análises.",
    whenDown: "Verifique a chave API nas configurações de IA. Confirme se o saldo da conta OpenAI está ativo.",
    configPath: "/admin/ai-config",
  },
  google_gemini: {
    description: "IA alternativa do Google para geração de conteúdo.",
    whenDown: "Verifique a chave API do Gemini nas configurações de IA.",
    configPath: "/admin/ai-config",
  },
  google_calendar: {
    description: "Sincronização de compromissos com Google Agenda.",
    whenDown: "Reconecte a conta Google em Integrações. Verifique se o token OAuth não expirou.",
    configPath: "/admin/catalogo-integracoes",
  },
  google_maps: {
    description: "Geocodificação e mapas para endereços de clientes.",
    whenDown: "Verifique a chave API do Google Maps. Confirme se a API Geocoding está habilitada no console do Google.",
  },
  solarmarket: {
    description: "Importação de clientes e projetos do SolarMarket.",
    whenDown: "Verifique as credenciais de acesso ao SolarMarket nas configurações.",
    configPath: "/admin/catalogo-integracoes",
  },
  meta_facebook: {
    description: "Campanhas e leads do Meta/Facebook Ads.",
    whenDown: "Verifique o token de acesso em Config Meta/Facebook. Tokens expiram a cada 60 dias.",
    configPath: "/admin/catalogo-integracoes",
  },
  instagram: {
    description: "Integração com perfil e leads do Instagram.",
    whenDown: "Reconecte a conta Instagram via Meta Business. Verifique permissões do app.",
  },
  webhooks: {
    description: "Recebimento de eventos externos via webhook.",
    whenDown: "Verifique os endpoints configurados e se o serviço externo está enviando corretamente.",
    configPath: "/admin/catalogo-integracoes",
  },
  pagamentos: {
    description: "Gateway de pagamento Asaas (boleto, pix, cartão).",
    whenDown: "Verifique a chave API do Asaas e o webhook de retorno no painel Asaas.",
    configPath: "/admin/catalogo-integracoes",
  },
  automacoes: {
    description: "Automações de mensagens e follow-up.",
    whenDown: "Verifique se a instância WhatsApp está conectada e se as regras de automação estão ativas.",
    configPath: "/admin/catalogo-integracoes",
  },
  evolution_api: {
    description: "API de conexão WhatsApp (instâncias, QR Code, envio).",
    whenDown: "Verifique se o servidor Evolution API está online. Teste a URL base da API.",
    configPath: "/admin/catalogo-integracoes",
  },
  supabase: {
    description: "Banco de dados, autenticação e APIs do backend.",
    whenDown: "Verifique o status do projeto Supabase em app.supabase.com. Pode ser manutenção programada.",
  },
  edge_functions: {
    description: "Funções serverless para lógica de backend.",
    whenDown: "Verifique os logs das Edge Functions no painel Supabase. Redeploy pode ser necessário.",
  },
  storage: {
    description: "Armazenamento de arquivos, imagens e documentos.",
    whenDown: "Verifique as políticas de bucket e o espaço disponível no Storage do Supabase.",
  },
  email: {
    description: "Envio de e-mails transacionais e notificações.",
    whenDown: "Verifique as configurações SMTP e se o serviço de e-mail está ativo.",
  },
  cron_jobs: {
    description: "Tarefas agendadas (sincronização, limpeza, relatórios).",
    whenDown: "Acesse a página de Cron Jobs para verificar quais tarefas estão atrasadas.",
    configPath: "/admin/cron-jobs",
  },
  monitoramento_solar: {
    description: "Dados de geração solar dos provedores (Solarman, SolarEdge, etc).",
    whenDown: "Verifique as credenciais dos provedores em Integrações de Monitoramento.",
    configPath: "/admin/catalogo-integracoes",
  },
  aneel: {
    description: "Sincronização de dados regulatórios da ANEEL.",
    whenDown: "A API da ANEEL pode estar fora do ar. Verifique o último sync em Cron Jobs.",
    configPath: "/admin/cron-jobs",
  },
  tuya: {
    description: "Leitura de medidores IoT via plataforma Tuya.",
    whenDown: "Verifique as credenciais Tuya e se os dispositivos estão online no app Tuya Smart.",
  },
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  healthy: "success",
  degraded: "warning",
  down: "destructive",
  not_configured: "muted",
};

const STATUS_LABEL: Record<string, string> = {
  healthy: "Saudável",
  degraded: "Degradado",
  down: "Offline",
  not_configured: "Não configurado",
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{p.value}ms</span>
        </p>
      ))}
    </div>
  );
};

export default function SystemHealthPage() {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const {
    integrations, outboxStats, integrityAudit, integrityLoading,
    healthy, degraded, down, notConfigured,
    avgLatency, errorRate, overallStatus, isLoading,
  } = useSystemHealth();

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("integration-health-check", {
        body: { manual: true },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Verificação concluída");
      queryClient.invalidateQueries({ queryKey: ["system-health-integrations"] });
    },
    onError: () => toast.error("Erro ao verificar"),
  });

  // Latency chart data
  const latencyData = integrations
    .filter((i) => i.latency_ms != null)
    .map((i) => ({
      name: INTEGRATION_LABELS[i.integration_name] || i.integration_name,
      latência: i.latency_ms!,
    }))
    .sort((a, b) => b.latência - a.latência);

  // Incidents = degraded + down
  const incidents = integrations
    .filter((i) => i.status === "degraded" || i.status === "down")
    .concat(
      outboxStats.recentFailures.map((f) => ({
        id: f.id,
        integration_name: "wa_outbox",
        status: "failed",
        last_check_at: f.created_at,
        latency_ms: null,
        error_message: f.error_message,
        details: null,
        updated_at: f.created_at,
      }))
    );

  const overallIcon = overallStatus === "green" ? CheckCircle2 : overallStatus === "yellow" ? AlertTriangle : WifiOff;
  const overallLabel = overallStatus === "green" ? "Operacional" : overallStatus === "yellow" ? "Degradado" : "Crítico";
  const overallVariant = overallStatus === "green" ? "success" : overallStatus === "yellow" ? "warning" : "destructive";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        icon={Activity}
        title="Saúde do Sistema"
        description="Visão geral em tempo real de todas as integrações, filas e serviços"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] sm:min-h-0"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshMutation.isPending && "animate-spin")} />
            Verificar agora
          </Button>
        }
      />

      {/* KPI Cards — §27 */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: overallIcon, label: "Status Geral", value: overallLabel, variant: overallVariant },
            { icon: Wifi, label: "Conectadas", value: String(healthy), variant: "success" as const },
            { icon: AlertTriangle, label: "Degradadas", value: String(degraded), variant: degraded > 0 ? "warning" as const : "muted" as const },
            { icon: WifiOff, label: "Não Configuradas", value: String(notConfigured), variant: notConfigured > 0 ? "muted" as const : "success" as const },
            { icon: Zap, label: "Latência Média", value: avgLatency ? `${avgLatency}ms` : "—", variant: (avgLatency && avgLatency > 1000) ? "warning" as const : "success" as const },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} custom={i} initial="hidden" animate="visible" variants={cardVariants}>
              <Card className={cn(
                "border-l-[3px] bg-card shadow-sm hover:shadow-md transition-shadow",
                kpi.variant === "success" && "border-l-success",
                kpi.variant === "warning" && "border-l-warning",
                kpi.variant === "destructive" && "border-l-destructive",
                kpi.variant === "muted" && "border-l-border",
              )}>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    kpi.variant === "success" && "bg-success/10 text-success",
                    kpi.variant === "warning" && "bg-warning/10 text-warning",
                    kpi.variant === "destructive" && "bg-destructive/10 text-destructive",
                    kpi.variant === "muted" && "bg-muted text-muted-foreground",
                  )}>
                    <kpi.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{kpi.value}</p>
                    <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Row: Webhook queue + Latency chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Webhook Queue Stats */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">Fila WhatsApp (Outbox)</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Status da fila de envio de mensagens</p>
            </div>
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Pendentes na fila", value: outboxStats.pending, variant: outboxStats.pending > 50 ? "warning" : "muted" },
                  { label: "Falhas (24h)", value: outboxStats.failed, variant: outboxStats.failed > 0 ? "destructive" : "muted" },
                  { label: "Retries acumulados (24h)", value: outboxStats.totalRetries, variant: outboxStats.totalRetries > 10 ? "warning" : "muted" },
                  { label: "Enviadas com sucesso", value: outboxStats.sent, variant: "success" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <StatusBadge variant={item.variant as any} dot>{item.value}</StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Latency Chart — §5 */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">Latência por Integração</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Última verificação (ms)</p>
            </div>
            <Zap className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading || latencyData.length === 0 ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={latencyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Bar dataKey="latência" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Integrations Status Table — §4 */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">Integrações</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">Clique em uma integração para ver orientações de configuração e solução</p>
          </div>
          <Server className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-4 p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : (
            <div className="rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground w-[30px]" />
                    <TableHead className="font-semibold text-foreground">Integração</TableHead>
                    <TableHead className="font-semibold text-foreground">Descrição</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Latência</TableHead>
                    <TableHead className="font-semibold text-foreground">Último Check</TableHead>
                    <TableHead className="font-semibold text-foreground">Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations.map((row) => {
                    const guidance = INTEGRATION_GUIDANCE[row.integration_name];
                    const isExpanded = expandedRow === row.id;
                    const hasIssue = row.status === "degraded" || row.status === "down" || row.status === "not_configured";

                    return (
                      <React.Fragment key={row.id}>
                        <TableRow
                          className={cn(
                            "hover:bg-muted/30 transition-colors align-middle cursor-pointer",
                            hasIssue && "bg-destructive/5",
                          )}
                          onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                        >
                          <TableCell className="w-[30px] pr-0">
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            }
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {INTEGRATION_LABELS[row.integration_name] || row.integration_name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {guidance?.description || "—"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge variant={STATUS_VARIANT[row.status] || "muted"} dot>
                              {STATUS_LABEL[row.status] || row.status}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {row.latency_ms != null ? `${row.latency_ms}ms` : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.last_check_at
                              ? formatDistanceToNow(new Date(row.last_check_at), { addSuffix: true, locale: ptBR })
                              : "nunca"}
                          </TableCell>
                          <TableCell className="max-w-[250px]">
                            {row.error_message ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-destructive truncate block" title={row.error_message}>
                                    {row.error_message}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm">{row.error_message}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Expanded guidance row */}
                        {isExpanded && guidance && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={7} className="p-0">
                              <div className="px-6 py-4 space-y-3">
                                <div className="flex items-start gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <BookOpen className="w-4 h-4 text-info" />
                                  </div>
                                  <div className="space-y-2 flex-1">
                                    <p className="text-sm font-medium text-foreground">O que é</p>
                                    <p className="text-sm text-muted-foreground">{guidance.description}</p>
                                  </div>
                                </div>

                                {hasIssue && (
                                  <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center shrink-0 mt-0.5">
                                      <HelpCircle className="w-4 h-4 text-warning" />
                                    </div>
                                    <div className="space-y-2 flex-1">
                                      <p className="text-sm font-medium text-foreground">Como resolver</p>
                                      <p className="text-sm text-muted-foreground">{guidance.whenDown}</p>
                                    </div>
                                  </div>
                                )}

                                {guidance.configPath && (
                                  <div className="flex items-center gap-2 pt-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-2 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.location.href = guidance.configPath!;
                                      }}
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Ir para configuração
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Integrity Audit */}
      <Card className={cn(
        "bg-card border-border shadow-sm",
        (integrityAudit.duplicate_conversations > 0 || integrityAudit.technical_previews > 0) && "border-destructive/50",
      )}>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
              (integrityAudit.duplicate_conversations > 0 || integrityAudit.technical_previews > 0)
                ? "bg-destructive/10 text-destructive"
                : "bg-success/10 text-success",
            )}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-foreground">Integridade WhatsApp</CardTitle>
                {(integrityAudit.duplicate_conversations > 0 || integrityAudit.technical_previews > 0) && (
                  <Badge variant="destructive" className="text-xs">CRITICAL</Badge>
                )}
                {integrityAudit.duplicate_conversations === 0 && integrityAudit.technical_previews === 0 && integrityAudit.orphan_messages === 0 && !integrityLoading && (
                  <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">OK</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">Verificação de duplicatas, previews técnicos e mensagens órfãs</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {integrityLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                {
                  label: "Conversas duplicadas",
                  value: integrityAudit.duplicate_conversations,
                  variant: integrityAudit.duplicate_conversations > 0 ? "destructive" : "success",
                  hint: "Mesmo telefone + instância com remote_jid diferente",
                },
                {
                  label: "Previews técnicos residuais",
                  value: integrityAudit.technical_previews,
                  variant: integrityAudit.technical_previews > 0 ? "destructive" : "success",
                  hint: "Previews como [text], [contact], [image] não convertidos",
                },
                {
                  label: "Mensagens órfãs",
                  value: integrityAudit.orphan_messages,
                  variant: integrityAudit.orphan_messages > 0 ? "warning" : "success",
                  hint: "Mensagens sem conversa correspondente",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <span className="text-sm text-foreground">{item.label}</span>
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                  <StatusBadge variant={item.variant as any} dot>{item.value}</StatusBadge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incidents Table */}
      {incidents.length > 0 && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">Incidentes Recentes</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Integrações com problemas e falhas de envio (24h)</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent className="pt-4 p-0">
            <div className="rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Serviço</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-foreground">Quando</TableHead>
                    <TableHead className="font-semibold text-foreground">Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((inc) => (
                    <TableRow key={inc.id} className="hover:bg-muted/30 transition-colors align-middle">
                      <TableCell className="font-medium text-foreground">
                        {INTEGRATION_LABELS[inc.integration_name] || inc.integration_name}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={STATUS_VARIANT[inc.status] || "destructive"} dot>
                          {STATUS_LABEL[inc.status] || inc.status}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inc.last_check_at
                          ? formatDistanceToNow(new Date(inc.last_check_at), { addSuffix: true, locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        {inc.error_message ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-destructive truncate block" title={inc.error_message}>
                                {inc.error_message}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">{inc.error_message}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
