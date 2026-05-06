import { Download } from "lucide-react";
import { ResetActionCard } from "@/components/admin/dev/ResetActionCard";
import { useResetImportedData } from "@/hooks/useResetImportedData";

/**
 * DEV: Reset apenas dos dados IMPORTADOS (staging SolarMarket sm_*_raw).
 * Não toca em registros canônicos (clientes/projetos/propostas).
 */
export default function DevResetImportedPage() {
  const m = useResetImportedData();
  return (
    <ResetActionCard
      title="Reset Importados (Staging SolarMarket)"
      description={
        <>
          Remove apenas o <strong>staging</strong> da importação SM:
          <code> sm_clientes_raw</code>, <code>sm_projetos_raw</code>,
          <code> sm_propostas_raw</code>, <code>sm_funis_raw</code>,
          <code> sm_custom_fields_raw</code>, jobs e logs de import/promotion,
          mapeamentos de consultor e <code>external_entity_links</code> com
          origem <code>solar_market</code>.
          <span className="block mt-2 text-xs text-muted-foreground">
            ✅ Clientes, projetos e propostas canônicos ficam intactos.
          </span>
        </>
      }
      buttonLabel="Resetar Dados Importados"
      confirmTitle="Confirmar reset de importados"
      confirmKeyword="LIMPAR IMPORTADOS"
      confirmDescription={
        <span className="block">
          Isso apagará <strong>todo o staging SolarMarket e histórico de jobs</strong>.
          Registros canônicos (clientes/projetos/propostas) serão preservados.
        </span>
      }
      isPending={m.isPending}
      counts={m.data?.counts}
      onConfirm={() => m.mutate()}
      icon={<Download className="h-4 w-4 mr-2" />}
    />
  );
}
