import { Cloud } from "lucide-react";
import { ResetActionCard } from "@/components/admin/dev/ResetActionCard";
import { useResetMigratedData } from "@/hooks/useResetMigratedData";

/**
 * DEV: Reset apenas dos dados MIGRADOS (canônicos com external_source=solar_market).
 * Não toca em staging nem em registros nativos.
 */
export default function DevResetMigratedPage() {
  const m = useResetMigratedData();
  return (
    <ResetActionCard
      title="Reset Migrados (Canônicos do SolarMarket)"
      description={
        <>
          Remove apenas registros canônicos <strong>vindos da promoção SM</strong>:
          clientes, projetos, propostas, versões, deals e recebimentos onde
          <code> external_source = solar_market</code>.
          <span className="block mt-2 text-xs text-muted-foreground">
            ✅ Staging SM (<code>sm_*_raw</code>) e dados nativos ficam intactos.
          </span>
        </>
      }
      buttonLabel="Resetar Dados Migrados"
      confirmTitle="Confirmar reset de migrados"
      confirmKeyword="LIMPAR MIGRADOS"
      confirmDescription={
        <span className="block">
          Isso apagará <strong>todos os registros canônicos com origem SolarMarket</strong>.
          Staging e dados nativos serão preservados.
        </span>
      }
      isPending={m.isPending}
      counts={m.data?.counts as Record<string, number> | undefined}
      onConfirm={() => m.mutate()}
      icon={<Cloud className="h-4 w-4 mr-2" />}
    />
  );
}
