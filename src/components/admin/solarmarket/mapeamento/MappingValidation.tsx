/**
 * MappingValidation — checklist global da configuração da migração SolarMarket.
 * Mostra o que falta para liberar o Step 3 e habilita o botão "Continuar".
 */
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, ArrowRight } from "lucide-react";
import type { SmFunilStagingRow } from "@/hooks/useSmFunisStaging";
import type { MigrationConfigRow } from "@/hooks/useMigrationConfig";
import type { SmEtapaRow } from "@/hooks/useSmEtapasFunil";
import type { SmConsultorMappingRow } from "@/hooks/useSmConsultorMapping";

interface Props {
  funis: SmFunilStagingRow[];
  config: MigrationConfigRow | null | undefined;
  etapasVendedores: SmEtapaRow[];
  consultorMappings: SmConsultorMappingRow[];
}

interface CheckItem {
  ok: boolean;
  label: string;
}

export function MappingValidation({
  funis,
  config,
  etapasVendedores,
  consultorMappings,
}: Props) {
  const navigate = useNavigate();

  const totalFunis = funis.length;
  const funisDefinidos = funis.filter((f) => f.papel !== null).length;
  const funisPipelineCompletos = funis
    .filter((f) => f.papel === "pipeline")
    .every((f) => !!f.pipelineId);

  const mapByEtapa = new Map<string, string | null>();
  for (const m of consultorMappings) mapByEtapa.set(m.sm_name, m.consultor_id);

  const totalEtapasV = etapasVendedores.length;
  const etapasVMapeadas = etapasVendedores.filter((e) =>
    mapByEtapa.get(e.smEtapaName),
  ).length;

  const items: CheckItem[] = [
    {
      ok: funisDefinidos === totalFunis && totalFunis > 0,
      label: `Papéis dos funis definidos: ${funisDefinidos}/${totalFunis}`,
    },
    {
      ok: funisPipelineCompletos,
      label: "Funis com papel 'pipeline' têm um pipeline vinculado",
    },
    {
      ok: !!config?.default_pipeline_id && !!config?.default_consultor_id,
      label: "Configurações padrão definidas (pipeline e consultor padrão)",
    },
    ...(totalEtapasV > 0
      ? [
          {
            ok: etapasVMapeadas === totalEtapasV,
            label: `Etapas do funil 'Vendedores': ${etapasVMapeadas}/${totalEtapasV} mapeadas`,
          },
        ]
      : []),
  ];

  const canContinue = items.every((i) => i.ok);

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Status dos mapeamentos
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            O Step 3 só é liberado quando todos os itens estiverem completos.
          </p>
        </div>

        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              {item.ok ? (
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
              ) : (
                <Clock className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              )}
              <span
                className={item.ok ? "text-foreground" : "text-muted-foreground"}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button
            disabled={!canContinue}
            onClick={() => navigate("/admin/migracao-solarmarket/migrar")}
          >
            Continuar para Step 3
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
