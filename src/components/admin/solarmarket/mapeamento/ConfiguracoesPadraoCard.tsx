/**
 * ConfiguracoesPadraoCard — define o pipeline padrão e o consultor padrão
 * (fallbacks) usados durante a migração SolarMarket.
 *
 * Governança:
 *  - RB-04: queries vivem em hooks
 *  - RB-58: mutation já confirma com .select()
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings } from "lucide-react";
import { useConsultoresAtivos } from "@/hooks/useConsultoresAtivos";
import { usePipelinesCrm } from "@/hooks/usePipelinesCrm";
import {
  useMigrationConfig,
  useSaveMigrationConfig,
} from "@/hooks/useMigrationConfig";
import { toast } from "sonner";

interface Props {
  tenantId: string;
}

export function ConfiguracoesPadraoCard({ tenantId }: Props) {
  const { data: pipelines, isLoading: loadingPipes } = usePipelinesCrm(tenantId);
  const { data: consultores, isLoading: loadingCons } = useConsultoresAtivos();
  const { data: config, isLoading: loadingConf } = useMigrationConfig(tenantId);
  const saveMutation = useSaveMigrationConfig();

  const handlePipelineChange = async (id: string) => {
    try {
      await saveMutation.mutateAsync({ tenantId, defaultPipelineId: id });
      toast.success("Pipeline padrão salvo");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(msg);
    }
  };

  const handleConsultorChange = async (id: string) => {
    try {
      await saveMutation.mutateAsync({ tenantId, defaultConsultorId: id });
      toast.success("Consultor padrão salvo");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(msg);
    }
  };

  const loading = loadingPipes || loadingCons || loadingConf;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Configurações padrão
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Regras aplicadas automaticamente quando um projeto não tem informação suficiente.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        )}

        {!loading && (
          <>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                Pipeline para todos os projetos migrados
              </Label>
              <Select
                value={config?.default_pipeline_id ?? ""}
                onValueChange={handlePipelineChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um pipeline..." />
                </SelectTrigger>
                <SelectContent>
                  {(pipelines ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.qtd_stages > 0 ? ` (${p.qtd_stages} etapas)` : " (sem etapas)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                Consultor padrão (quando o projeto não tem vínculo claro)
              </Label>
              <Select
                value={config?.default_consultor_id ?? ""}
                onValueChange={handleConsultorChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um consultor..." />
                </SelectTrigger>
                <SelectContent>
                  {(consultores ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
