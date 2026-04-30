/**
 * ConexoesCredenciaisPage — Wrapper fino (DA-48 / RB-76).
 * Reaproveita: integration_connections via useIntegrationCredentialsPage.
 * SEGURANÇA: nunca exibe tokens/credentials, apenas status (Fase 8).
 */
import { Key, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useIntegrationCredentialsPage } from "@/hooks/integrations/connections/useIntegrationCredentialsPage";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  connected: "default",
  disconnected: "secondary",
  error: "destructive",
  maintenance: "outline",
};

function fmt(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default function ConexoesCredenciaisPage() {
  const { data: rows, isLoading, error } = useIntegrationCredentialsPage();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Key}
        title="Credenciais de Integração"
        description="Estado das conexões por provedor. Tokens e segredos nunca são exibidos."
        helpText="Apenas administradores podem ver esta página. Os valores das credenciais permanecem protegidos pelo backend."
      />

      <Card className="border-l-4 border-l-success">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success" />
            Tokens, API keys e refresh tokens não são exibidos por segurança.
          </div>
          {isLoading ? (
            <LoadingState message="Carregando credenciais..." />
          ) : error ? (
            <p className="text-sm text-destructive">Erro ao carregar credenciais.</p>
          ) : !rows?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma conexão registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Última sync</TableHead>
                    <TableHead className="hidden lg:table-cell">Criada em</TableHead>
                    <TableHead className="hidden lg:table-cell">Atualizada em</TableHead>
                    <TableHead className="hidden xl:table-cell">Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.provider_id}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[r.status] ?? "secondary"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {fmt(r.last_sync_at)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {fmt(r.created_at)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {fmt(r.updated_at)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-destructive max-w-xs truncate">
                        {r.sync_error || "—"}
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
