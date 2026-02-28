import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionCard, StatCard, LoadingState } from "@/components/ui-kit";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TablePagination } from "@/components/ui-kit/TablePagination";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Play, AlertTriangle } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";

const BASE_PAYLOAD = {
  dry_run: true,
  filters: { status: "approved" },
  pipeline_id: "9b5cbcf3-a101-4950-b699-778e2e1219e6",
  stage_id: "bdad6238-90e1-4e12-b897-53ff61ece1b6",
  owner_id: "e0bd3d46-775e-45de-aabf-7fd70d52ef27",
  batch_size: 25,
};

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

interface ErrorDetails {
  name?: string;
  message?: string;
  status?: number;
  statusText?: string;
  body?: string;
}

export function MigracaoSmDryRun() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [onlyMarked, setOnlyMarked] = useState(true);

  const runDryRun = async () => {
    setLoading(true);
    setError(null);
    setErrorDetails(null);
    setResult(null);
    try {
      await supabase.auth.getUser();
      
      const payload = {
        ...BASE_PAYLOAD,
        filters: {
          ...BASE_PAYLOAD.filters,
          ...(onlyMarked ? { only_marked: true } : {}),
        },
      };
      const { data, error: fnError } = await supabase.functions.invoke("migrate-sm-proposals", {
        body: payload,
      });
      if (fnError) {
        const ctx = (fnError as any).context;
        console.error({ fnError, ctx });
        let bodyStr = "";
        try {
          if (ctx && typeof ctx.json === "function") {
            const cloned = ctx.clone();
            const json = await cloned.json();
            bodyStr = JSON.stringify(json, null, 2);
          } else if (ctx?.body) {
            bodyStr = typeof ctx.body === "string" ? ctx.body : JSON.stringify(ctx.body, null, 2);
          } else if (data) {
            bodyStr = typeof data === "object" ? JSON.stringify(data, null, 2) : String(data);
          }
        } catch { /* ignore */ }
        const details: ErrorDetails = {
          name: fnError.name,
          message: fnError.message,
          status: ctx?.status,
          statusText: ctx?.statusText,
          body: bodyStr || "—",
        };
        setErrorDetails(details);
        const userMsg = typeof data === "object" && data?.error ? data.error : fnError.message;
        setError(userMsg || "Erro desconhecido na edge function");
        return;
      }
      if (!data || typeof data !== "object" || !data.summary) {
        setError("Resposta inesperada da edge function (sem summary)");
        setErrorDetails({ body: JSON.stringify(data, null, 2) });
        return;
      }
      setResult(data as DryRunResult);
    } catch (err: any) {
      console.error("Catch geral dry-run:", err);
      const msg = err?.message ?? "Erro desconhecido";
      setError(msg.includes("Failed to fetch") || msg.includes("network") 
        ? "Timeout ou erro de rede. A função pode estar demorando muito. Tente reduzir o batch_size."
        : msg);
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
          <div className="flex items-center gap-3">
            <Toggle
              pressed={onlyMarked}
              onPressedChange={setOnlyMarked}
              size="sm"
              variant="outline"
              aria-label="Somente marcadas"
            >
              {onlyMarked ? "✓ Somente marcadas" : "Todas aprovadas"}
            </Toggle>
            <Button onClick={runDryRun} disabled={loading}>
              <Play className="h-4 w-4 mr-2" />
              Rodar Dry-Run
            </Button>
          </div>
        }
      />

      {loading && <LoadingState message="Executando dry-run..." />}

      {(error || errorDetails) && (
        <SectionCard variant="red" icon={AlertTriangle} title="Erro">
          {error && <p className="text-sm text-destructive mb-2">{error}</p>}
          {errorDetails && (
            <pre className="text-xs bg-muted/50 p-3 rounded overflow-auto max-h-60 whitespace-pre-wrap break-all">
{`Name: ${errorDetails.name ?? "—"}
Message: ${errorDetails.message ?? "—"}
Status: ${errorDetails.status ?? "—"} ${errorDetails.statusText ?? ""}
Body:
${errorDetails.body ?? "—"}`}
            </pre>
          )}
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
