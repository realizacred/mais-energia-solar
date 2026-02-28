import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionCard, StatCard, LoadingState } from "@/components/ui-kit";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TablePagination } from "@/components/ui-kit/TablePagination";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Play, AlertTriangle } from "lucide-react";

const DRY_RUN_PAYLOAD = {
  dry_run: true,
  filters: { status: "approved" },
  pipeline_id: "9b5cbcf3-a101-4950-b699-778e2e1219e6",
  stage_id: "bdad6238-90e1-4e12-b897-53ff61ece1b6",
  owner_id: "e0bd3d46-775e-45de-aabf-7fd70d52ef27",
  batch_size: 25,
} as const;

type StatusVariant = "success" | "warning" | "destructive" | "info" | "muted";

const STATUS_VARIANT: Record<string, StatusVariant> = {
  WOULD_CREATE: "success",
  WOULD_LINK: "info",
  WOULD_SKIP: "muted",
  CONFLICT: "warning",
  ERROR: "destructive",
};

interface DryRunResult {
  summary: Record<string, number>;
  details: Array<{
    sm_proposal_id: string;
    sm_client_name: string;
    status: string;
    steps?: {
      cliente?: { status: string };
      deal?: { status: string };
      proposta_nativa?: { status: string };
    };
    error?: string;
  }>;
}

export function MigracaoSmDryRun() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const runDryRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("migrate-sm-proposals", {
        body: DRY_RUN_PAYLOAD,
      });
      if (fnError) throw fnError;
      setResult(data as DryRunResult);
    } catch (err: any) {
      setError(err?.message ?? "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const details = result?.details?.slice(0, 50) ?? [];
  const paged = details.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Migração SolarMarket → Canônico"
        description="Simulação (dry-run) — nenhum dado será gravado."
        actions={
          <Button onClick={runDryRun} disabled={loading}>
            <Play className="h-4 w-4 mr-2" />
            Rodar Dry-Run (approved)
          </Button>
        }
      />

      {loading && <LoadingState message="Executando dry-run..." />}

      {error && (
        <SectionCard variant="red" icon={AlertTriangle} title="Erro">
          <p className="text-sm text-destructive">{error}</p>
        </SectionCard>
      )}

      {result?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(result.summary).map(([key, count]) => (
            <StatCard
              key={key}
              icon={AlertTriangle}
              label={key}
              value={count}
              color={
                key === "WOULD_CREATE" ? "success"
                : key === "WOULD_LINK" ? "info"
                : key === "CONFLICT" ? "warning"
                : key === "ERROR" ? "destructive"
                : "muted"
              }
            />
          ))}
        </div>
      )}

      {details.length > 0 && (
        <SectionCard title={`Detalhes (${details.length} itens)`} variant="blue" noPadding>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SM Proposal ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cliente Step</TableHead>
                <TableHead>Deal Step</TableHead>
                <TableHead>Proposta Step</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((item, i) => (
                <TableRow key={item.sm_proposal_id ?? i}>
                  <TableCell className="font-mono text-xs">{item.sm_proposal_id}</TableCell>
                  <TableCell className="text-sm">{item.sm_client_name}</TableCell>
                  <TableCell>
                    <StatusBadge variant={STATUS_VARIANT[item.status] ?? "muted"} dot>
                      {item.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-xs">{item.steps?.cliente?.status ?? "—"}</TableCell>
                  <TableCell className="text-xs">{item.steps?.deal?.status ?? "—"}</TableCell>
                  <TableCell className="text-xs">{item.steps?.proposta_nativa?.status ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            totalItems={details.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </SectionCard>
      )}
    </div>
  );
}
