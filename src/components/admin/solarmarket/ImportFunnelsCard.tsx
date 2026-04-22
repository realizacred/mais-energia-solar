/**
 * ImportFunnelsCard — Card de controle manual da importação de funis dos projetos SM.
 * Substitui o antigo cron job sm-import-project-funnels-job (controle pelo usuário).
 *
 * RB-04: queries em hook. RB-09: usa Button shadcn. RB-21: shadow-sm.
 */
import { useQuery } from "@tanstack/react-query";
import { Loader2, GitBranch, Ban, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useSolarmarketImportFunnels } from "@/hooks/useSolarmarketImportFunnels";

interface Props {
  tenantId: string | undefined;
}

export function ImportFunnelsCard({ tenantId }: Props) {
  const { progress, start, cancel } = useSolarmarketImportFunnels(tenantId);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["sm_projeto_funis_stats", tenantId],
    enabled: !!tenantId,
    staleTime: 1000 * 5,
    refetchInterval: progress.isRunning ? 2000 : false,
    queryFn: async () => {
      const [totalRes, processedRes, vinculosRes] = await Promise.all([
        supabase
          .from("sm_projetos_raw")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!),
        supabase.rpc("sm_count_distinct_projeto_funis" as never, { p_tenant_id: tenantId }).then(
          (r) => r,
          () => ({ data: null, error: null }),
        ),
        supabase
          .from("sm_projeto_funis_raw")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!),
      ]);

      // Fallback: contar distinct via select se a RPC não existir
      let processedCount = 0;
      if (processedRes && (processedRes as { data?: number | null }).data != null) {
        processedCount = Number((processedRes as { data: number }).data);
      } else {
        const { data } = await supabase
          .from("sm_projeto_funis_raw")
          .select("sm_project_id")
          .eq("tenant_id", tenantId!);
        const set = new Set<number>();
        (data || []).forEach((row: { sm_project_id: number | null }) => {
          if (row.sm_project_id != null) set.add(row.sm_project_id);
        });
        processedCount = set.size;
      }

      return {
        total: totalRes.count ?? 0,
        processed: processedCount,
        vinculos: vinculosRes.count ?? 0,
      };
    },
  });

  const total = stats?.total ?? 0;
  const processed = stats?.processed ?? 0;
  const vinculos = stats?.vinculos ?? 0;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
  const pendentes = Math.max(0, total - processed);
  const completed = total > 0 && processed >= total;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <GitBranch className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold text-foreground">
              Funis dos Projetos
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Busca em qual funil/etapa cada projeto está. Necessário antes de promover.
            </p>
          </div>
          {completed && (
            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
              Concluído
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Projetos no staging</p>
            <p className="text-xl font-bold text-foreground tabular-nums mt-1">{total.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Com funis importados</p>
            <p className="text-xl font-bold text-foreground tabular-nums mt-1">
              {processed.toLocaleString("pt-BR")}
              <span className="text-sm font-normal text-muted-foreground ml-1.5">({percent}%)</span>
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Pendentes</p>
            <p className="text-xl font-bold text-foreground tabular-nums mt-1">{pendentes.toLocaleString("pt-BR")}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso geral</span>
            <span className="font-mono">{processed}/{total} · {vinculos} vínculos</span>
          </div>
          <Progress value={percent} />
        </div>

        {progress.isRunning && (
          <div className="rounded-lg border border-info/30 bg-info/5 p-3 text-sm">
            <div className="flex items-center gap-2 text-info font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              Lote {progress.iteration} em execução
            </div>
            <p className="text-muted-foreground text-xs mt-1">{progress.lastMessage}</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Acumulado nesta sessão: +{progress.totalProcessed} projetos · +{progress.totalVinculos} vínculos
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!progress.isRunning ? (
            <Button
              onClick={start}
              disabled={!tenantId || isLoading || completed}
              variant="default"
            >
              <Play className="w-4 h-4" />
              {completed
                ? "Concluído"
                : processed > 0
                ? "Continuar importação"
                : "Iniciar importação"}
            </Button>
          ) : (
            <Button onClick={cancel} variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10">
              <Ban className="w-4 h-4" />
              Cancelar
            </Button>
          )}
        </div>

        {progress.errors.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">
              {progress.errors.length} {progress.errors.length === 1 ? "erro encontrado" : "erros encontrados"}
            </p>
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground max-h-32 overflow-y-auto">
              {progress.errors.slice(-5).map((e, i) => (
                <li key={i}>
                  Lote {e.iteration}: {e.error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
