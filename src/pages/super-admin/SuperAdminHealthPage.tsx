/**
 * SuperAdminHealthPage — visão global de saúde por tenant.
 * Usa super_admin_global_health RPC. Sem mocks.
 */
import { Heart, AlertTriangle } from "lucide-react";
import { useGlobalHealth } from "@/hooks/super-admin/useSuperAdminEntitlements";
import { LoadingState, EmptyState, SectionCard } from "@/components/ui-kit";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

export default function SuperAdminHealthPage() {
  const { data = [], isLoading, error } = useGlobalHealth();

  if (isLoading) return <LoadingState message="Calculando saúde da plataforma..." />;
  if (error) {
    return <EmptyState icon={AlertTriangle} title="Erro" description={(error as Error).message} />;
  }

  const sorted = [...data].sort((a: any, b: any) => (a.health?.score ?? 0) - (b.health?.score ?? 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Heart className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Saúde da plataforma</h1>
      </div>

      <SectionCard title={`Tenants (${data.length})`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Lock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((t: any) => {
              const score = t.health?.score ?? 0;
              const variant: "default" | "secondary" | "destructive" =
                score >= 80 ? "default" : score >= 50 ? "secondary" : "destructive";
              const lockLevel = t.lock?.level ?? "none";
              return (
                <TableRow key={t.tenant_id}>
                  <TableCell>
                    <Link to={`/super-admin/tenants/${t.tenant_id}`} className="text-primary hover:underline">
                      {t.tenant_name ?? t.tenant_id}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={variant}>{score}/100</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={lockLevel === "none" ? "outline" : "destructive"}>{lockLevel}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.lock?.subscription_status ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={`/super-admin/tenants/${t.tenant_id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      abrir →
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {data.length === 0 && (
          <EmptyState icon={Heart} title="Sem tenants ativos" description="Nenhum tenant para avaliar." />
        )}
      </SectionCard>
    </div>
  );
}
