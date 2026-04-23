/**
 * Migração SolarMarket — Step 2 (Mapear).
 *
 * Subfase 2.1 — escolha do PAPEL de cada funil do SolarMarket.
 *  - Lista os funis vindos do staging (sm_funis_raw).
 *  - Para cada funil, o usuário escolhe um papel:
 *      • pipeline         → vira um pipeline nativo (mapeamento detalhado: 2.2)
 *      • vendedor_source  → cada etapa indica o consultor responsável (2.2)
 *      • tag              → vira etiqueta (futuro)
 *      • ignore           → não é migrado
 *  - O papel é gravado em sm_funil_pipeline_map.role.
 *
 * Subfase 2.2 (próxima): mapeamento detalhado etapa→consultor / etapa→stage.
 * Subfase 2.3 (depois):  validação global, pré-sugestões e botão Step 3.
 */
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Folder,
  Workflow,
  Users,
  Tag,
  Ban,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useTenantId } from "@/hooks/useTenantId";
import {
  useSmFunisStaging,
  useSaveFunilPapel,
  type FunilPapel,
} from "@/hooks/useSmFunisStaging";
import { toast } from "sonner";

const PAPEIS: { value: FunilPapel; label: string; descricao: string; icon: typeof Workflow }[] = [
  {
    value: "pipeline",
    label: "Vira pipeline no CRM",
    descricao: "As etapas serão convertidas em estágios de um pipeline nativo.",
    icon: Workflow,
  },
  {
    value: "vendedor_source",
    label: "Fonte de consultor",
    descricao: "Cada etapa indica o consultor responsável pelo projeto.",
    icon: Users,
  },
  {
    value: "tag",
    label: "Vira etiqueta/tag",
    descricao: "As etapas viram etiquetas aplicadas aos projetos.",
    icon: Tag,
  },
  {
    value: "ignore",
    label: "Ignorar",
    descricao: "Este funil não será migrado.",
    icon: Ban,
  },
];

export default function MigracaoStep2Mapear() {
  const { data: tenantId } = useTenantId();
  const { data: funis, isLoading } = useSmFunisStaging(tenantId ?? undefined);
  const saveMutation = useSaveFunilPapel();

  const handleChangePapel = async (smFunilName: string, papel: FunilPapel) => {
    if (!tenantId) return;
    try {
      await saveMutation.mutateAsync({
        tenantId,
        smFunilName,
        papel,
        // Subfase 2.1: para 'pipeline' ainda não escolhemos pipeline aqui
        // (será feito em 2.2). Mantemos pipeline_id atual se já existir.
        pipelineId: papel === "pipeline" ? null : null,
      });
      toast.success("Papel salvo");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar papel";
      toast.error(msg);
    }
  };

  const totalFunis = funis?.length ?? 0;
  const totalDefinidos = funis?.filter((f) => f.papel !== null).length ?? 0;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1100px]">
      {/* Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/admin/migracao-solarmarket">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para a importação
          </Link>
        </Button>
        <h1 className="text-xl font-bold text-foreground">
          Step 2 — Configurar mapeamentos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Defina como cada funil do SolarMarket deve ser tratado na migração para o seu CRM.
        </p>
      </div>

      {/* Card de introdução */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <Folder className="w-5 h-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Como você quer tratar cada funil do SolarMarket?
              </p>
              <p className="text-sm text-muted-foreground">
                Escolha o papel de cada funil abaixo. Nesta etapa só definimos o tipo —
                o mapeamento detalhado de etapas (para consultor ou stage) virá na próxima sub-etapa.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de funis */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Funis do SolarMarket
          </h2>
          {!isLoading && funis && (
            <Badge
              variant="outline"
              className={
                totalDefinidos === totalFunis
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-warning/10 text-warning border-warning/20"
              }
            >
              {totalDefinidos} de {totalFunis} definidos
            </Badge>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && funis && funis.length === 0 && (
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-5 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-warning" />
              <p className="text-sm text-muted-foreground">
                Nenhum funil encontrado no staging. Volte ao Step 1 e execute a importação.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading &&
          funis?.map((f) => (
            <Card
              key={f.smFunilId}
              className="bg-card border-border shadow-sm hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                      <Folder className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base font-semibold text-foreground truncate">
                        {f.nome}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {f.qtdEtapas} {f.qtdEtapas === 1 ? "etapa" : "etapas"} •{" "}
                        {f.qtdProjetosVinculados.toLocaleString("pt-BR")}{" "}
                        {f.qtdProjetosVinculados === 1 ? "projeto vinculado" : "projetos vinculados"}
                      </p>
                    </div>
                  </div>
                  {f.papel && (
                    <Badge
                      variant="outline"
                      className="bg-success/10 text-success border-success/20 shrink-0"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {PAPEIS.find((p) => p.value === f.papel)?.label ?? f.papel}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Label className="text-sm font-medium text-foreground mb-3 block">
                  Papel deste funil:
                </Label>
                <RadioGroup
                  value={f.papel ?? ""}
                  onValueChange={(v) => handleChangePapel(f.nome, v as FunilPapel)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  {PAPEIS.map((p) => {
                    const Icon = p.icon;
                    const id = `${f.smFunilId}-${p.value}`;
                    return (
                      <Label
                        key={p.value}
                        htmlFor={id}
                        className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 cursor-pointer hover:border-primary/40 hover:bg-muted/40 transition-colors data-[state=checked]:border-primary"
                      >
                        <RadioGroupItem value={p.value} id={id} className="mt-0.5" />
                        <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {p.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {p.descricao}
                          </p>
                        </div>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Footer informativo (Subfase 2.3 trará botão Continuar) */}
      <Card className="bg-muted/30 border-border shadow-sm">
        <CardContent className="p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-info shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Próximas sub-etapas
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Após definir o papel de todos os funis, você poderá mapear cada etapa para um
              consultor ou um stage do CRM. O botão para avançar ao Step 3 só será liberado
              quando todos os mapeamentos estiverem completos.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
