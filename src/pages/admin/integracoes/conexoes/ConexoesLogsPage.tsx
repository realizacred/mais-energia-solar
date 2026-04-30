/**
 * ConexoesLogsPage — Wrapper fino (DA-48 / RB-76).
 * Reaproveita: integration_events + integration_sync_logs (read-only).
 */
import { FileSearch } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useIntegrationLogsPage } from "@/hooks/integrations/connections/useIntegrationLogsPage";

const levelVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  success: "default",
  warning: "outline",
  error: "destructive",
  failed: "destructive",
};

function fmt(ts: string) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default function ConexoesLogsPage() {
  const { data: logs, isLoading, error } = useIntegrationLogsPage();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileSearch}
        title="Logs de Integração"
        description="Eventos e logs de sincronização por provedor (somente leitura)."
      />

      <Card className="border-l-4 border-l-warning">
        <CardContent className="pt-6">
          {isLoading ? (
            <LoadingState message="Carregando logs..." />
          ) : error ? (
            <p className="text-sm text-destructive">Erro ao carregar logs.</p>
          ) : !logs?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum log registrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[170px]">Quando</TableHead>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Mensagem</TableHead>
                    <TableHead className="hidden lg:table-cell w-[110px]">Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground">{fmt(l.created_at)}</TableCell>
                      <TableCell className="font-medium">{l.provider}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.event_type}</TableCell>
                      <TableCell>
                        <Badge variant={levelVariant[l.status] ?? "secondary"}>{l.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-md truncate">
                        {l.message || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className="text-xs">{l.source}</Badge>
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
