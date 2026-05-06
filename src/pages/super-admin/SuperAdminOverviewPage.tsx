/**
 * SuperAdminOverviewPage — Visão geral SaaS (KPIs globais).
 * Fase fundação: estrutura mínima com KPIs reais via RPC existente.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, CreditCard, AlertTriangle } from "lucide-react";
import { PageHeader, StatCard, LoadingState } from "@/components/ui-kit";

export default function SuperAdminOverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["super-admin-overview-kpis"],
    queryFn: async () => {
      const [tenantsRes, subsRes] = await Promise.all([
        supabase.from("tenants").select("id, status, deleted_at"),
        supabase.from("subscriptions").select("id, status"),
      ]);
      const tenants = (tenantsRes.data ?? []).filter((t: any) => !t.deleted_at);
      const subs = subsRes.data ?? [];
      return {
        total_tenants: tenants.length,
        active_tenants: tenants.filter((t: any) => t.status === "active").length,
        suspended_tenants: tenants.filter((t: any) => t.status === "suspended").length,
        trialing: subs.filter((s: any) => s.status === "trialing").length,
        active_subs: subs.filter((s: any) => s.status === "active").length,
        past_due: subs.filter((s: any) => s.status === "past_due").length,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        title="Visão Geral"
        description="KPIs globais da plataforma SaaS"
      />
      {isLoading || !data ? (
        <LoadingState message="Carregando KPIs..." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={Building2} label="Tenants" value={data.total_tenants} color="primary" />
          <StatCard icon={Building2} label="Ativos" value={data.active_tenants} color="success" />
          <StatCard icon={AlertTriangle} label="Suspensos" value={data.suspended_tenants} color="warning" />
          <StatCard icon={CreditCard} label="Em Trial" value={data.trialing} color="info" />
          <StatCard icon={CreditCard} label="Assinaturas Ativas" value={data.active_subs} color="success" />
          <StatCard icon={AlertTriangle} label="Em Atraso" value={data.past_due} color="destructive" />
        </div>
      )}
    </div>
  );
}
