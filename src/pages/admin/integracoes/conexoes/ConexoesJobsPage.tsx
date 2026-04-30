/**
 * ConexoesJobsPage — Wrapper fino (DA-48 / RB-76).
 * Reaproveita: integration_jobs + integration_sync_runs (read-only).
 */
import { Workflow } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useIntegrationJobsPage } from "@/hooks/integrations/connections/useIntegrationJobsPage";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  success: "default",
  running: "outline",
  pending: "secondary",
  error: "destructive",
  failed: "destructive",
  cancelled: "secondary",
};

function fmt(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default function ConexoesJobsPage() {
  const { data: jobs, isLoading, error } = useIntegrationJobsPage();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Workflow}
        title="Jobs de Integração"
        description="Execuções de sincronização e jobs por provedor (somente leitura)."
      />

      <Card className="border-l-4 border-l-info">
        <CardContent className="pt-6">
          {isLoading ? (
            <LoadingState message="Carregando jobs..." />
          ) : error ? (
            <p className="text-sm text-destructive">Erro ao carregar jobs.</p>
          ) : !jobs?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum job registrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Origem</TableHead>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Iniciado</TableHead>
                    <TableHead className="hidden md:table-cell">Finalizado</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Itens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow key={`${j.source}-${j.id}`}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{j.source}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{j.provider}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{j.job_type}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[j.status] ?? "secondary"}>{j.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {fmt(j.started_at)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {fmt(j.finished_at)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-xs">
                        {j.items_processed ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
