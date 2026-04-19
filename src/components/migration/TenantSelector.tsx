/**
 * TenantSelector — Componente único de seleção de tenant para o Migration Center.
 *
 * Regras (RB-80):
 *   - Super-admin: dropdown com todos os tenants que possuem staging.
 *   - Usuário comum: apenas badge read-only do próprio tenant.
 *   - Mostra prévia de contagens (clients / projects / proposals) do tenant ativo.
 *   - Sinaliza "sem staging" quando o tenant ativo não tem dados a migrar.
 */
import { Building2, Database, AlertTriangle, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useIsSuperAdmin,
  useCurrentTenantId,
  useStagingCounts,
  useTenantsWithStaging,
} from "@/hooks/useMigrationTenant";

interface Props {
  value: string | null;
  onChange: (tenantId: string | null) => void;
}

export function TenantSelector({ value, onChange }: Props) {
  const { data: isSuper, isLoading: loadingRole } = useIsSuperAdmin();
  const { data: currentTenantId, isLoading: loadingTenant } = useCurrentTenantId();
  const { data: tenants, isLoading: loadingTenants } = useTenantsWithStaging(!!isSuper);
  const { data: counts, isLoading: loadingCounts } = useStagingCounts(value);

  // Resolve tenant inicial: se ainda não foi definido pelo pai, usar:
  //   - super_admin → primeiro tenant com staging
  //   - comum       → próprio tenant
  if (value === null) {
    if (loadingRole || loadingTenant) {
      return <Skeleton className="h-20 w-full" />;
    }
    if (isSuper) {
      const first = tenants?.[0]?.id ?? currentTenantId ?? null;
      if (first) {
        // defer: chama no próximo tick
        queueMicrotask(() => onChange(first));
      }
    } else if (currentTenantId) {
      queueMicrotask(() => onChange(currentTenantId));
    }
  }

  const activeTenantNome =
    tenants?.find((t) => t.id === value)?.nome ??
    (value && value === currentTenantId ? "Seu tenant" : "—");

  const noStaging = !!counts && counts.total === 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground">Tenant da migração</span>
        </div>

        {isSuper ? (
          loadingTenants ? (
            <Skeleton className="h-9 w-full sm:w-72" />
          ) : (
            <Select
              value={value ?? undefined}
              onValueChange={(v) => onChange(v)}
              disabled={!tenants || tenants.length === 0}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Selecione um tenant" />
              </SelectTrigger>
              <SelectContent>
                {(tenants ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center justify-between gap-3 w-full">
                      <span className="truncate">{t.nome}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {t.total_staging} reg.
                      </span>
                    </span>
                  </SelectItem>
                ))}
                {(!tenants || tenants.length === 0) && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhum tenant com staging
                  </div>
                )}
              </SelectContent>
            </Select>
          )
        ) : (
          <Badge variant="outline" className="font-mono text-[11px]">
            {activeTenantNome}
          </Badge>
        )}
      </div>

      {/* Prévia de contagens */}
      <div className="grid grid-cols-3 gap-2">
        <CountTile label="Clientes" value={counts?.clients} loading={loadingCounts} />
        <CountTile label="Projetos" value={counts?.projects} loading={loadingCounts} />
        <CountTile label="Propostas" value={counts?.proposals} loading={loadingCounts} />
      </div>

      {!loadingCounts && noStaging && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Este tenant não possui dados de staging do SolarMarket. A criação de novos jobs
            está bloqueada — sincronize o staging primeiro.
          </span>
        </div>
      )}

      {!isSuper && value && currentTenantId && value !== currentTenantId && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Tenant inválido para o seu usuário.</span>
        </div>
      )}
    </div>
  );
}

function CountTile({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Database className="h-3 w-3" />
        <span>{label}</span>
      </div>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" />
      ) : (
        <p className="text-lg font-semibold tabular-nums text-foreground leading-tight">
          {(value ?? 0).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}
