/**
 * ConexoesProvedoresPage — Wrapper fino (DA-48 / RB-76).
 * Reaproveita: integration_providers via useIntegrationProvidersPage.
 * Tabelas: integration_providers (read-only).
 */
import { Plug, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useIntegrationProvidersPage } from "@/hooks/integrations/connections/useIntegrationProvidersPage";

export default function ConexoesProvedoresPage() {
  const { data: providers, isLoading, error } = useIntegrationProvidersPage();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Plug}
        title="Provedores de Integração"
        description="Catálogo de provedores disponíveis para conexão (somente leitura)."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/catalogo-integracoes">
              Abrir catálogo completo <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      <Card className="border-l-4 border-l-primary">
        <CardContent className="pt-6">
          {isLoading ? (
            <LoadingState message="Carregando provedores..." />
          ) : error ? (
            <p className="text-sm text-destructive">Erro ao carregar provedores.</p>
          ) : !providers?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum provedor cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Descrição</TableHead>
                    <TableHead className="hidden md:table-cell">Atualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.label}</TableCell>
                      <TableCell className="text-muted-foreground">{p.category}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "available" ? "default" : "secondary"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs max-w-md truncate">
                        {p.description}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {new Date(p.updated_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
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
