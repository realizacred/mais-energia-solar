import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { useSolarmarketImport, type ImportScope } from "@/hooks/useSolarmarketImport";
import { useSolarmarketConfig } from "@/hooks/useSolarmarketConfig";
import { toast } from "@/hooks/use-toast";
import {
  Cloud, CheckCircle2, XCircle, Loader2, Download, Plug, Settings, AlertTriangle, Ban,
} from "lucide-react";

const formatBR = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";

function statusBadge(status: string) {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: "bg-muted text-muted-foreground border-border", label: "Pendente" },
    running: { cls: "bg-info/10 text-info border-info/20", label: "Em execução" },
    success: { cls: "bg-success/10 text-success border-success/20", label: "Sucesso" },
    partial: { cls: "bg-warning/10 text-warning border-warning/20", label: "Parcial" },
    error: { cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Erro" },
    cancelled: { cls: "bg-muted text-muted-foreground border-border", label: "Cancelado" },
  };
  const m = map[status] ?? map.pending;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

export default function ImportacaoSolarmarket() {
  const { jobs, isLoading, testConnection, importAll, cancelImport } = useSolarmarketImport();
  const { config, isConfigured, isLoading: loadingCfg } = useSolarmarketConfig();
  const [scope, setScope] = useState<ImportScope>({
    clientes: true,
    projetos: true,
    propostas: true,
    funis: true,
    custom_fields: true,
  });

  const runningJob = jobs.find((j) => {
    if (j.status !== "running") return false;
    // Considera "travado" se passou mais de 10 min sem finalizar
    const startedMs = new Date(j.started_at ?? j.created_at).getTime();
    return Date.now() - startedMs < 10 * 60 * 1000;
  });

  const handleTest = async () => {
    try {
      const res: any = await testConnection.mutateAsync();
      toast({
        title: "Conexão OK",
        description: res?.message || "Autenticado no SolarMarket.",
      });
    } catch (e: any) {
      toast({
        title: "Falha na conexão",
        description: e?.message || "Verifique a configuração.",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    try {
      await importAll.mutateAsync(scope);
      toast({ title: "Importação iniciada", description: "Acompanhe o progresso abaixo." });
    } catch (e: any) {
      toast({
        title: "Erro ao iniciar",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const toggle = (k: keyof ImportScope) =>
    setScope((s) => ({ ...s, [k]: !s[k] }));

  if (isLoading || loadingCfg) return <LoadingState message="Carregando importações..." />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Importação SolarMarket</h1>
            <p className="text-sm text-muted-foreground">
              Importação one-shot de Clientes, Projetos, Propostas, Funis e Campos Customizados.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/configuracoes/integracoes/solarmarket">
            <Settings className="w-4 h-4 mr-2" /> Configuração
          </Link>
        </Button>
      </div>

      {/* Bloqueio se não configurado */}
      {!isConfigured && (
        <Card className="border-l-[3px] border-l-warning bg-warning/5 shadow-sm">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <AlertTriangle className="w-6 h-6 text-warning shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                Integração SolarMarket não configurada
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {config && !config.is_active
                  ? "Configuração existe mas está desativada. Ative-a para liberar a importação."
                  : "Cadastre URL base e token da API antes de importar."}
              </p>
            </div>
            <Button asChild>
              <Link to="/admin/configuracoes/integracoes/solarmarket">
                <Settings className="w-4 h-4 mr-2" /> Ir para configuração
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Conexão */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Plug className="w-4 h-4 text-primary" />
            Conexão
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground flex-1 min-w-[200px]">
            URL: <code className="text-xs bg-muted px-1 py-0.5 rounded">{config?.base_url || "—"}</code>
          </p>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={!isConfigured || testConnection.isPending}
          >
            {testConnection.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            Testar conexão
          </Button>
        </CardContent>
      </Card>

      {/* Escopo + Disparo */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Escopo da importação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(
              [
                { k: "clientes", label: "Clientes" },
                { k: "projetos", label: "Projetos" },
                { k: "propostas", label: "Propostas" },
                { k: "funis", label: "Funis e Etapas" },
                { k: "custom_fields", label: "Campos Customizados" },
              ] as { k: keyof ImportScope; label: string }[]
            ).map(({ k, label }) => (
              <label
                key={k}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox checked={scope[k]} onCheckedChange={() => toggle(k)} />
                <span className="text-sm font-medium text-foreground">{label}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Importação idempotente via <code>external_source</code> + <code>external_id</code>.
              Throttle de 60 req/min com backoff em 429.
            </p>
            <Button
              onClick={handleImport}
              disabled={!isConfigured || importAll.isPending || !!runningJob}
            >
              {importAll.isPending || runningJob ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Importar tudo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progresso ao vivo */}
      {runningJob && (
        <Card className="border-l-[3px] border-l-info bg-card shadow-sm">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Importação em andamento
                </p>
                <p className="text-xs text-muted-foreground">
                  Etapa atual: {runningJob.current_step ?? "—"}
                </p>
              </div>
              <Loader2 className="w-5 h-5 animate-spin text-info" />
            </div>
            <Progress value={Number(runningJob.progress_pct ?? 0)} />
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma importação executada ainda.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Início</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                    <TableHead className="text-right">Projetos</TableHead>
                    <TableHead className="text-right">Propostas</TableHead>
                    <TableHead className="text-right">Erros</TableHead>
                    <TableHead>Fim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="text-xs">{formatBR(j.started_at ?? j.created_at)}</TableCell>
                      <TableCell>{statusBadge(j.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{j.current_step ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{j.total_clientes}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{j.total_projetos}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{j.total_propostas}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {j.total_errors > 0 ? (
                          <span className="text-destructive flex items-center justify-end gap-1">
                            <XCircle className="w-3 h-3" />
                            {j.total_errors}
                          </span>
                        ) : (
                          j.total_errors
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{formatBR(j.finished_at)}</TableCell>
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
