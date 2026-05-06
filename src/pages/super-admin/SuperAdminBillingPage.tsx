/**
 * SuperAdminBillingPage — Visão global de subscriptions (PR-2).
 * Lista subscriptions da plataforma com filtro de status. Sem mocks.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Filter } from "lucide-react";
import { PageHeader, StatCard, SectionCard, StatusBadge, EmptyState, LoadingState } from "@/components/ui-kit";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useGlobalSubscriptions } from "@/hooks/super-admin/useSuperAdminBilling";
import { formatDate } from "@/lib/dateUtils";

const STATUSES = ["active", "trialing", "past_due", "suspended", "canceled", "expired"];

const VARIANT: Record<string, any> = {
  active: "success", trialing: "info", past_due: "warning",
  suspended: "warning", canceled: "destructive", expired: "destructive",
  paid: "success", overdue: "warning", failed: "destructive", pending: "info",
};

function fmt(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
}

export default function SuperAdminBillingPage() {
  const [filter, setFilter] = useState<string>("");
  const navigate = useNavigate();
  const { data = [], isLoading, error } = useGlobalSubscriptions(filter || undefined);

  const kpis = useMemo(() => {
    const all = data;
    const active = all.filter((s: any) => s.status === "active");
    const trialing = all.filter((s: any) => s.status === "trialing");
    const overdue = all.filter((s: any) => ["past_due", "suspended"].includes(s.status));
    const mrr = active.reduce((acc: number, s: any) => acc + Number(s.price_monthly ?? 0), 0);
    return { total: all.length, active: active.length, trialing: trialing.length, overdue: overdue.length, mrr };
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader icon={CreditCard} title="Billing" description="Visão global das assinaturas da plataforma" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={CreditCard} label="Subscriptions" value={kpis.total} color="primary" />
        <StatCard icon={CreditCard} label="Ativas" value={kpis.active} color="success" />
        <StatCard icon={CreditCard} label="Trial" value={kpis.trialing} color="info" />
        <StatCard icon={CreditCard} label="Em atraso" value={kpis.overdue} color="warning" />
        <StatCard icon={CreditCard} label="MRR estimado" value={fmt(kpis.mrr)} color="success" />
      </div>

      <SectionCard
        icon={Filter}
        title="Subscriptions"
        actions={
          <Select value={filter || "all"} onValueChange={(v) => setFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      >
        {isLoading ? <LoadingState message="Carregando..." />
          : error ? <EmptyState icon={CreditCard} title="Erro" description={String((error as any).message)} />
          : data.length === 0 ? <EmptyState icon={CreditCard} title="Sem resultados" description="Nenhuma subscription encontrada." />
          : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead>Período fim</TableHead>
                  <TableHead>Última cobrança</TableHead>
                  <TableHead>Asaas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.tenant_name}</TableCell>
                    <TableCell>{s.plan_name}</TableCell>
                    <TableCell><StatusBadge variant={VARIANT[s.status] ?? "muted"} dot>{s.status}</StatusBadge></TableCell>
                    <TableCell>{fmt(s.price_monthly)}</TableCell>
                    <TableCell>{s.current_period_end ? formatDate(s.current_period_end) : "—"}</TableCell>
                    <TableCell>
                      {s.last_charge_status
                        ? <StatusBadge variant={VARIANT[s.last_charge_status] ?? "muted"}>{s.last_charge_status}</StatusBadge>
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.external_id ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline"
                        onClick={() => navigate(`/super-admin/tenants/${s.tenant_id}`)}>
                        Gerenciar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </SectionCard>
    </div>
  );
}
