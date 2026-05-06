/**
 * SuperAdminTenantBillingTab — Aba Billing real no detalhe do tenant.
 * SSOT: subscriptions table via super_admin_change_subscription RPC.
 * Não usa tenants.plano. Sem mocks.
 */
import { useState } from "react";
import {
  CreditCard, AlertTriangle, CheckCircle2, XCircle, Clock, Pause, Play,
  RotateCw, ExternalLink, DollarSign, Webhook as WebhookIcon, History,
} from "lucide-react";
import { SectionCard, StatCard, StatusBadge, EmptyState, LoadingState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useTenantBilling, useBillingAction } from "@/hooks/super-admin/useSuperAdminBilling";
import { useBillingPlans } from "@/hooks/useBillingPlans";
import { formatDateTime, formatDate } from "@/lib/dateUtils";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted" | "info"> = {
  active: "success", trialing: "info", past_due: "warning",
  suspended: "warning", canceled: "destructive", expired: "destructive",
  paid: "success", pending: "info", overdue: "warning", failed: "destructive", refunded: "muted",
  received: "info", processed: "success", replayed: "info",
};

function fmtMoney(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
}

interface Props { tenantId: string; }

export function SuperAdminTenantBillingTab({ tenantId }: Props) {
  const { data, isLoading, error } = useTenantBilling(tenantId);
  const { data: plans = [] } = useBillingPlans();

  const [planDialog, setPlanDialog] = useState(false);
  const [trialDialog, setTrialDialog] = useState(false);
  const [reasonDialog, setReasonDialog] = useState<null | "suspend" | "reactivate" | "cancel">(null);

  const [planForm, setPlanForm] = useState({ plan_code: "", reason: "" });
  const [trialForm, setTrialForm] = useState({ days: 14, reason: "" });
  const [reason, setReason] = useState("");

  const changeSub = useBillingAction("change_subscription", "Plano atualizado", tenantId);
  const extendTrial = useBillingAction("extend_trial", "Trial estendido", tenantId);
  const suspend = useBillingAction("suspend_subscription", "Suspenso", tenantId);
  const reactivate = useBillingAction("reactivate_subscription", "Reativado", tenantId);
  const cancel = useBillingAction("cancel_subscription", "Cancelado", tenantId);
  const markPaid = useBillingAction("mark_payment_paid", "Pagamento registrado", tenantId);
  const retry = useBillingAction("retry_charge", "Cobrança reenviada", tenantId);
  const replay = useBillingAction("replay_webhook", "Webhook reprocessado", tenantId);

  if (isLoading) return <LoadingState message="Carregando billing..." />;
  if (error) return <EmptyState title="Erro" description={String((error as any).message)} />;
  if (!data) return null;

  const sub = data.subscription;
  const trialDaysLeft = sub?.trial_ends_at
    ? Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000)
    : null;
  const overdueCount = data.charges.filter((c) => c.status === "overdue" || c.status === "past_due").length;
  const failedHooks = data.webhook_events.filter((w) => w.status === "failed").length;

  const isActive = sub?.status === "active" || sub?.status === "trialing" || sub?.status === "past_due";

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={CreditCard}
          label="Plano"
          value={sub?.plan_name ?? "—"}
          color="primary"
        />
        <StatCard
          icon={sub?.status === "active" ? CheckCircle2 : sub?.status === "trialing" ? Clock : AlertTriangle}
          label="Status"
          value={sub?.status ?? "—"}
          color={sub?.status === "active" ? "success" : sub?.status === "trialing" ? "info" : "warning"}
        />
        <StatCard
          icon={DollarSign}
          label="MRR"
          value={fmtMoney(sub?.price_monthly)}
          color="success"
        />
        <StatCard
          icon={Clock}
          label={sub?.status === "trialing" ? "Trial restante" : "Próximo ciclo"}
          value={
            sub?.status === "trialing"
              ? (trialDaysLeft !== null ? `${trialDaysLeft}d` : "—")
              : (sub?.current_period_end ? formatDate(sub.current_period_end) : "—")
          }
          color={trialDaysLeft !== null && trialDaysLeft <= 3 ? "warning" : "info"}
        />
      </div>

      {/* Subscription card */}
      <SectionCard
        icon={CreditCard}
        title="Assinatura (SSOT)"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { setPlanForm({ plan_code: sub?.plan_code ?? "", reason: "" }); setPlanDialog(true); }}>
              Alterar plano
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setTrialForm({ days: 14, reason: "" }); setTrialDialog(true); }}>
              <Clock className="w-4 h-4 mr-1" /> Renovar trial
            </Button>
            {isActive ? (
              <Button size="sm" variant="outline" onClick={() => { setReason(""); setReasonDialog("suspend"); }}>
                <Pause className="w-4 h-4 mr-1" /> Suspender
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => { setReason(""); setReasonDialog("reactivate"); }}>
                <Play className="w-4 h-4 mr-1" /> Reativar
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={() => { setReason(""); setReasonDialog("cancel"); }}>
              <XCircle className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          </div>
        }
      >
        {!sub ? (
          <EmptyState title="Sem assinatura" description="Tenant não possui subscription registrada." />
        ) : (
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <Row label="Plano" value={`${sub.plan_name} (${sub.plan_code})`} />
            <Row label="Status">
              <StatusBadge variant={STATUS_VARIANT[sub.status] ?? "muted"} dot>{sub.status}</StatusBadge>
            </Row>
            <Row label="Trial até" value={sub.trial_ends_at ? formatDateTime(sub.trial_ends_at) : "—"} />
            <Row label="Período atual" value={`${formatDate(sub.current_period_start)} → ${formatDate(sub.current_period_end)}`} />
            <Row label="Cancela ao fim do período" value={sub.cancel_at_period_end ? "Sim" : "Não"} />
            <Row label="Cancelado em" value={sub.canceled_at ? formatDateTime(sub.canceled_at) : "—"} />
            <Row label="Asaas subscription" value={sub.external_id ?? "—"} />
            <Row label="Atualizado em" value={formatDateTime(sub.updated_at)} />
          </div>
        )}
      </SectionCard>

      {/* Cobranças */}
      <SectionCard icon={DollarSign} title={`Cobranças (${data.charges.length})`}>
        {data.charges.length === 0 ? (
          <EmptyState title="Sem cobranças" description="Nenhuma cobrança registrada para este tenant." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Asaas</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.charges.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{formatDate(c.due_date)}</TableCell>
                  <TableCell>{fmtMoney(c.valor)}</TableCell>
                  <TableCell><StatusBadge variant={STATUS_VARIANT[c.status] ?? "muted"} dot>{c.status}</StatusBadge></TableCell>
                  <TableCell className="font-mono text-xs">{c.asaas_charge_id ?? "—"}</TableCell>
                  <TableCell>{c.paid_at ? formatDateTime(c.paid_at) : "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {c.invoice_url && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={c.invoice_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                    {c.status !== "paid" && (
                      <>
                        <Button size="sm" variant="outline" disabled={markPaid.isPending}
                          onClick={() => markPaid.mutate({ charge_id: c.id })}>
                          Marcar pago
                        </Button>
                        <Button size="sm" variant="outline" disabled={retry.isPending}
                          onClick={() => retry.mutate({ charge_id: c.id })}>
                          <RotateCw className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {/* Webhooks */}
      <SectionCard
        icon={WebhookIcon}
        title={`Webhooks recentes (${data.webhook_events.length})`}
        actions={failedHooks > 0 ? <StatusBadge variant="destructive">{failedHooks} falhas</StatusBadge> : undefined}
      >
        {data.webhook_events.length === 0 ? (
          <EmptyState title="Sem eventos" description="Nenhum webhook recebido ainda." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recebido</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.webhook_events.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="text-xs">{formatDateTime(w.received_at)}</TableCell>
                  <TableCell>{w.provider}</TableCell>
                  <TableCell className="font-mono text-xs">{w.event_type ?? "—"}</TableCell>
                  <TableCell><StatusBadge variant={STATUS_VARIANT[w.status] ?? "muted"} dot>{w.status}</StatusBadge></TableCell>
                  <TableCell className="text-xs text-destructive max-w-xs truncate">{w.error_message ?? ""}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={replay.isPending}
                      onClick={() => replay.mutate({ webhook_event_id: w.id })}>
                      Replay
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {/* Timeline */}
      <SectionCard icon={History} title="Timeline de billing">
        {data.audit.length === 0 ? (
          <EmptyState title="Sem histórico" description="Nenhuma ação de billing executada." />
        ) : (
          <ol className="space-y-3">
            {data.audit.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.action}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
                  </div>
                  {a.details?.reason && (
                    <p className="text-xs text-muted-foreground">{a.details.reason}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      {/* Dialog: alterar plano */}
      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar plano</DialogTitle>
            <DialogDescription>Atualiza a subscription canônica e sincroniza o estado do tenant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Plano</Label>
              <Select value={planForm.plan_code} onValueChange={(v) => setPlanForm((f) => ({ ...f, plan_code: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {plans.filter((p: any) => p.is_active).map((p: any) => (
                    <SelectItem key={p.id} value={p.code}>{p.name} — {fmtMoney(p.price_monthly)}/mês</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo (audit)</Label>
              <Input value={planForm.reason} onChange={(e) => setPlanForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog(false)}>Cancelar</Button>
            <Button disabled={!planForm.plan_code || changeSub.isPending}
              onClick={() => changeSub.mutate(
                { plan_code: planForm.plan_code, status: "active", reason: planForm.reason },
                { onSuccess: () => setPlanDialog(false) }
              )}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: trial */}
      <Dialog open={trialDialog} onOpenChange={setTrialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estender trial</DialogTitle>
            <DialogDescription>Adiciona dias ao trial. Se já expirado, conta a partir de agora.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Dias adicionais</Label>
              <Input type="number" min={1} max={180} value={trialForm.days}
                onChange={(e) => setTrialForm((f) => ({ ...f, days: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input value={trialForm.reason} onChange={(e) => setTrialForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialDialog(false)}>Cancelar</Button>
            <Button disabled={extendTrial.isPending}
              onClick={() => extendTrial.mutate(
                { days: trialForm.days, reason: trialForm.reason },
                { onSuccess: () => setTrialDialog(false) }
              )}>
              Estender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: motivo (suspender/reativar/cancelar) */}
      <Dialog open={reasonDialog !== null} onOpenChange={(o) => !o && setReasonDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonDialog === "suspend" && "Suspender assinatura"}
              {reasonDialog === "reactivate" && "Reativar assinatura"}
              {reasonDialog === "cancel" && "Cancelar assinatura"}
            </DialogTitle>
            <DialogDescription>
              Ação registrada em audit log. Sincroniza tenants.status automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Motivo</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialog(null)}>Voltar</Button>
            <Button
              variant={reasonDialog === "cancel" ? "destructive" : "default"}
              onClick={() => {
                const action = reasonDialog === "suspend" ? suspend
                  : reasonDialog === "reactivate" ? reactivate : cancel;
                action.mutate({ reason }, { onSuccess: () => setReasonDialog(null) });
              }}
              disabled={suspend.isPending || reactivate.isPending || cancel.isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{children ?? value}</span>
    </div>
  );
}
