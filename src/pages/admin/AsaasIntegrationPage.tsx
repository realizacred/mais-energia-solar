/**
 * AsaasIntegrationPage — Admin page for Asaas billing integration.
 * §26: PageHeader. §27: KPI cards. §16: queries in hooks.
 */
import { useState } from "react";
import {
  CreditCard, Eye, EyeOff, CheckCircle2, XCircle, Loader2, Shield,
  Zap, AlertTriangle, Copy, Webhook, Clock, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useAsaasConfig,
  useAsaasKeyConfigured,
  useAsaasWebhookEvents,
  useSaveAsaasConfig,
  useTestAsaasConnection,
} from "@/hooks/useAsaasIntegration";

const WEBHOOK_URL = `https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/billing-webhook`;

function formatDateBR(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default function AsaasIntegrationPage() {
  const { data: config, isLoading: loadingConfig } = useAsaasConfig();
  const { data: isKeyConfigured } = useAsaasKeyConfigured();
  const { data: events, isLoading: loadingEvents } = useAsaasWebhookEvents();
  const saveMutation = useSaveAsaasConfig();
  const testMutation = useTestAsaasConnection();

  const [formKey, setFormKey] = useState("");
  const [formEnv, setFormEnv] = useState<"sandbox" | "production">("sandbox");
  const [formActive, setFormActive] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize form from config once loaded
  if (config && !initialized) {
    setFormEnv((config.environment as "sandbox" | "production") || "sandbox");
    setFormActive(config.is_active);
    setInitialized(true);
  }

  const isConfigured = !!isKeyConfigured;
  const isConnected = config?.is_active && isConfigured;
  const lastEvent = events?.[0];
  const lastError = events?.find((e) => e.status === "error");
  const totalEvents = events?.length ?? 0;
  const webhookReceiving = !!lastEvent;

  const handleSave = async () => {
    if (!formKey.trim()) {
      toast({ title: "API Key obrigatória", variant: "destructive" });
      return;
    }
    try {
      await saveMutation.mutateAsync({
        api_key: formKey,
        environment: formEnv,
        is_active: formActive,
        existingId: config?.id ?? null,
      });
      toast({ title: "Configuração salva com sucesso ✅" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const handleTest = async () => {
    if (!formKey.trim()) {
      toast({ title: "Insira a API Key primeiro", variant: "destructive" });
      return;
    }
    try {
      const result = await testMutation.mutateAsync({ api_key: formKey, environment: formEnv });
      if (result.success) {
        toast({ title: `Conexão OK! Saldo: R$ ${result.balance?.toFixed(2) ?? "—"}` });
      } else {
        toast({ title: "Falha na conexão", description: result.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao testar", description: e.message, variant: "destructive" });
    }
  };

  const checklist = [
    { label: "API Key cadastrada", ok: isConfigured },
    { label: "Conexão validada", ok: testMutation.data?.success === true },
    { label: "Integração ativa", ok: !!config?.is_active },
    { label: "Webhook recebendo eventos", ok: webhookReceiving },
    { label: "Pronto para cobrança automática", ok: isConnected && webhookReceiving },
  ];

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        icon={CreditCard}
        title="Integração Asaas"
        description="Configure cobrança automática, webhook e status da integração"
      />

      {/* KPI Cards */}
      {loadingConfig ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Activity}
            label="Ambiente"
            value={config?.environment === "production" ? "Produção" : "Sandbox"}
            color={config?.environment === "production" ? "success" : "warning"}
          />
          <StatCard
            icon={Shield}
            label="API Configurada"
            value={isConfigured ? "Sim" : "Não"}
            color={isConfigured ? "success" : "destructive"}
          />
          <StatCard
            icon={Webhook}
            label="Webhook Ativo"
            value={webhookReceiving ? "Recebendo" : "Aguardando"}
            color={webhookReceiving ? "success" : "muted"}
          />
          <StatCard
            icon={Clock}
            label="Último Evento"
            value={lastEvent ? formatDateBR(lastEvent.received_at) : "Nenhum"}
            color={lastEvent ? "info" : "muted"}
          />
        </div>
      )}

      {/* Config Form */}
      <SectionCard icon={CreditCard} title="Configuração" description="Chave de API e ambiente" variant="blue">
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/30">
            <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-success" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Asaas</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Boleto + Pix + Cartão</p>
            </div>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Shield className="h-3 w-3" /> Seguro
            </Badge>
          </div>

          {/* Environment */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/60">
            <div>
              <Label className="text-sm font-medium">Ambiente</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formEnv === "sandbox" ? "Modo de testes — sem cobranças reais" : "Modo produção — cobranças reais"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-medium", formEnv === "sandbox" ? "text-warning" : "text-muted-foreground")}>Sandbox</span>
              <Switch checked={formEnv === "production"} onCheckedChange={(c) => setFormEnv(c ? "production" : "sandbox")} />
              <span className={cn("text-xs font-medium", formEnv === "production" ? "text-success" : "text-muted-foreground")}>Produção</span>
            </div>
          </div>

          {formEnv === "production" && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <p className="text-xs text-warning">Atenção: Cobranças reais serão geradas neste modo.</p>
            </div>
          )}

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="asaas-key" className="text-sm font-medium">API Key</Label>
            <div className="relative">
              <Input
                id="asaas-key"
                type={showKey ? "text" : "password"}
                placeholder="$aact_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                className="pr-10 font-mono text-xs"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? "Ocultar" : "Mostrar"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Encontre em:{" "}
              <a href="https://www.asaas.com/customerApiKeys/index" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                Asaas → Minha Conta → Integrações → API Keys
              </a>
            </p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Ativar integração</Label>
              <p className="text-xs text-muted-foreground">Habilita a emissão de cobranças via Asaas</p>
            </div>
            <Switch checked={formActive} onCheckedChange={setFormActive} />
          </div>

          {/* Test result */}
          {testMutation.data && (
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg border",
              testMutation.data.success ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"
            )}>
              {testMutation.data.success ? <CheckCircle2 className="h-5 w-5 text-success shrink-0" /> : <XCircle className="h-5 w-5 text-destructive shrink-0" />}
              <div>
                <p className="text-sm font-medium text-foreground">{testMutation.data.success ? "Conexão OK" : "Falha na conexão"}</p>
                {testMutation.data.success && testMutation.data.balance !== undefined && (
                  <p className="text-xs text-muted-foreground">Saldo: R$ {testMutation.data.balance?.toFixed(2)}</p>
                )}
                {testMutation.data.error && <p className="text-xs text-destructive">{testMutation.data.error}</p>}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar Configuração
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testMutation.isPending || !formKey} className="gap-1.5">
              {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Testar Conexão
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Webhook Config */}
      <SectionCard icon={Webhook} title="Webhook de Retorno" description="Configure no painel do Asaas para receber notificações" variant="orange">
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
            <Webhook className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <p className="text-xs text-info">
              Configure no Asaas com a URL abaixo. Ative os eventos: <strong>Pagamento Recebido</strong>, <strong>Pagamento Vencido</strong>, <strong>Pagamento Excluído</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">URL do Webhook</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={WEBHOOK_URL} className="font-mono text-xs bg-muted/50" />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(WEBHOOK_URL);
                  toast({ title: "URL copiada! 📋" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Acesse: Asaas → Minha Conta → Integrações → Webhooks → Criar novo</p>
          </div>

          {lastEvent && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Último evento recebido: {formatDateBR(lastEvent.received_at)}
            </div>
          )}
          {lastError && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              Último erro: {lastError.error_message ?? "Desconhecido"} — {formatDateBR(lastError.received_at)}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Operational Checklist */}
      <SectionCard icon={CheckCircle2} title="Checklist Operacional" description="Pré-requisitos para cobrança automática" variant="green">
        <div className="space-y-2">
          {checklist.map((item) => (
            <div key={item.label} className="flex items-center gap-3 p-2 rounded-lg">
              {item.ok ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              )}
              <span className={cn("text-sm", item.ok ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Webhook Events Log */}
      <SectionCard icon={Activity} title="Últimos Eventos Webhook" description="Histórico de notificações recebidas do Asaas" variant="neutral">
        {loadingEvents ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : !events?.length ? (
          <div className="text-center py-8">
            <Webhook className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum evento recebido ainda</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Configure o webhook no painel do Asaas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recebido em</TableHead>
                <TableHead>Processado em</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="font-mono text-xs">{ev.provider_event_id?.slice(0, 20)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      ev.status === "processed" && "border-success/40 text-success",
                      ev.status === "error" && "border-destructive/40 text-destructive",
                      ev.status === "pending" && "border-warning/40 text-warning",
                    )}>
                      {ev.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateBR(ev.received_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateBR(ev.processed_at)}</TableCell>
                  <TableCell className="text-xs text-destructive max-w-[200px] truncate">{ev.error_message || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
