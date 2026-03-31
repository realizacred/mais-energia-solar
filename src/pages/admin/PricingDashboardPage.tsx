/**
 * PricingDashboardPage — A/B pricing test metrics.
 * §26 header, §27 KPI cards, §4 table, §12 skeleton.
 */
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { DollarSign, Eye, MousePointer, TrendingUp, FlaskConical } from "lucide-react";
import { usePricingDashboard, type VariantMetrics } from "@/hooks/usePricingDashboard";
import { formatIntegerBR } from "@/lib/formatters";
import { usePriceVariantsAdmin, useTogglePriceVariant } from "@/hooks/usePriceVariantsAdmin";
import { useBillingPlans } from "@/hooks/useBillingPlans";

export default function PricingDashboardPage() {
  const { data: metrics = [], isLoading } = usePricingDashboard();
  const { data: variants = [] } = usePriceVariantsAdmin();
  const { data: plans = [] } = useBillingPlans();
  const toggleVariant = useTogglePriceVariant();

  const totalViews = metrics.reduce((s, m) => s + m.views, 0);
  const totalClicks = metrics.reduce((s, m) => s + m.clicks, 0);
  const totalUpgrades = metrics.reduce((s, m) => s + m.upgrades, 0);
  const conversionRate = totalViews > 0 ? ((totalUpgrades / totalViews) * 100).toFixed(1) : "0";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={FlaskConical} title="Otimização de Preços" description="Carregando..." />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </Card>
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FlaskConical}
        title="Otimização de Preços"
        description="Teste variantes de preço e acompanhe conversão por plano"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Eye} label="Views" value={formatIntegerBR(totalViews)} color="primary" />
        <KpiCard icon={MousePointer} label="Clicks" value={formatIntegerBR(totalClicks)} color="warning" />
        <KpiCard icon={TrendingUp} label="Upgrades" value={formatIntegerBR(totalUpgrades)} color="success" />
        <KpiCard icon={DollarSign} label="Conversão" value={`${conversionRate}%`} color="primary" />
      </div>

      {/* Variants Table */}
      {metrics.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Nenhuma variante de preço"
          description="Crie variantes para iniciar testes A/B de precificação."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Plano</TableHead>
                <TableHead className="font-semibold text-foreground">Variante</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Preço</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Weight</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Views</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Clicks</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Upgrades</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Conversão</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Tenants</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m) => (
                <TableRow key={m.variant_id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium text-foreground">{m.plan_name}</TableCell>
                  <TableCell className="text-foreground">{m.variant_name}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-foreground">
                    R$ {m.price_monthly.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{m.weight}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{m.views}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{m.clicks}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{m.upgrades}</TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    {m.conversion_rate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{m.tenants_assigned}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={m.is_active
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-muted text-muted-foreground"
                      }
                    >
                      {m.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleVariant.mutate({ id: m.variant_id, is_active: !m.is_active })}
                      disabled={toggleVariant.isPending}
                    >
                      {m.is_active ? "Pausar" : "Ativar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: "primary" | "success" | "warning" | "destructive";
}) {
  return (
    <Card className={`border-l-[3px] border-l-${color} bg-card shadow-sm hover:shadow-md transition-shadow`}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${color}/10 text-${color} shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{value}</p>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
