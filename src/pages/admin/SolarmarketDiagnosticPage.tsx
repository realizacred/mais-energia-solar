/**
 * SolarmarketDiagnosticPage — diagnóstico de mapeamento de funis/etapas SM
 * para os pipelines nativos. Permite criar pipelines faltantes em 1 clique.
 *
 * Governança: RB-01 (cores semânticas), RB-04, RB-06 (LoadingState).
 */
import { useMemo } from "react";
import { Stethoscope, CheckCircle2, AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  useSolarmarketDiagnostic,
  useCreateMissingPipelines,
} from "@/hooks/useSolarmarketDiagnostic";

export default function SolarmarketDiagnosticPage() {
  const { data, isLoading, error, refetch, isFetching } = useSolarmarketDiagnostic();
  const createMissing = useCreateMissingPipelines();

  const missingPipelineNames = useMemo(
    () => (data?.pipelineMatches ?? []).filter((m) => !m.matched).map((m) => m.smFunil),
    [data?.pipelineMatches]
  );

  const handleCreateMissing = async () => {
    if (!missingPipelineNames.length) return;
    try {
      const created = await createMissing.mutateAsync(missingPipelineNames);
      toast({
        title: "Pipelines criados",
        description: `${created.length} pipeline(s) criado(s) com stages padrão.`,
      });
    } catch (e) {
      toast({
        title: "Erro ao criar pipelines",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) return <LoadingState message="Analisando mapeamento..." context="general" />;

  if (error) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-6">
          <p className="text-sm text-destructive">
            Erro ao carregar diagnóstico: {(error as Error).message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const d = data!;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Stethoscope}
        title="Diagnóstico SolarMarket"
        description="Verifica o mapeamento entre funis/etapas importados e os pipelines nativos."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={isFetching ? "animate-spin" : ""} />
              Atualizar
            </Button>
            {missingPipelineNames.length > 0 && (
              <Button
                size="sm"
                onClick={handleCreateMissing}
                disabled={createMissing.isPending}
              >
                <Plus />
                Criar {missingPipelineNames.length} pipeline(s) faltante(s)
              </Button>
            )}
          </>
        }
      />

      {/* Status geral */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Funis SM" value={d.smFunis.length} />
        <KpiCard label="Pipelines nativos" value={d.pipelines.length} />
        <KpiCard
          label="Pipeline Comercial"
          value={d.comercialPipeline ? "OK" : "Ausente"}
          tone={d.comercialPipeline ? "success" : "destructive"}
        />
        <KpiCard
          label="Stages Comercial"
          value={d.comercialPipeline?.stages.length ?? 0}
        />
      </div>

      {/* Mapeamento de funil → pipeline */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Funil SM → Pipeline Nativo</CardTitle>
        </CardHeader>
        <CardContent>
          {d.pipelineMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum funil encontrado em <code>sm_propostas_raw</code>. Importe propostas primeiro.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funil SM</TableHead>
                    <TableHead>Propostas</TableHead>
                    <TableHead>Pipeline Nativo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.pipelineMatches.map((m) => (
                    <TableRow key={m.smFunil}>
                      <TableCell className="font-medium text-foreground">{m.smFunil}</TableCell>
                      <TableCell className="text-muted-foreground">{m.totalPropostas}</TableCell>
                      <TableCell className="text-foreground">
                        {m.nativePipeline?.name ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {m.matched ? (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Match
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1">
                            <AlertTriangle className="h-3 w-3" /> Sem match
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mapeamento de etapas */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Etapas SM → Stages Nativos</CardTitle>
        </CardHeader>
        <CardContent>
          {d.stageMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma etapa para mapear.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funil SM</TableHead>
                    <TableHead>Etapa SM</TableHead>
                    <TableHead>Stage Nativo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.stageMatches.map((m, idx) => (
                    <TableRow key={`${m.smFunil}-${m.smEtapa}-${idx}`}>
                      <TableCell className="text-muted-foreground">{m.smFunil}</TableCell>
                      <TableCell className="font-medium text-foreground">{m.smEtapa}</TableCell>
                      <TableCell className="text-foreground">
                        {m.nativeStage ? (
                          <span>
                            {m.nativeStage.name}{" "}
                            <code className="text-xs text-muted-foreground">
                              ({m.nativeStage.id.slice(0, 8)})
                            </code>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {m.matched ? (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Match
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1">
                            <AlertTriangle className="h-3 w-3" /> Sem match
                          </Badge>
                        )}
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

function KpiCard({
  label,
  value,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const toneCls: Record<string, string> = {
    primary: "border-l-primary bg-primary/5",
    success: "border-l-success bg-success/5",
    warning: "border-l-warning bg-warning/5",
    destructive: "border-l-destructive bg-destructive/5",
  };
  return (
    <Card className={`border-l-[3px] ${toneCls[tone]} bg-card shadow-sm`}>
      <CardContent className="p-5">
        <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
