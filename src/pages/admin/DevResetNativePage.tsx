import { User } from "lucide-react";
import { ResetActionCard } from "@/components/admin/dev/ResetActionCard";
import { useResetNativeData } from "@/hooks/useResetNativeData";

/**
 * DEV: Reset apenas dos dados NATIVOS (criados manualmente na UI).
 * Não toca em staging SM nem em registros migrados (external_source=solar_market).
 */
export default function DevResetNativePage() {
  const m = useResetNativeData();
  return (
    <ResetActionCard
      title="Reset Nativos (Criados Manualmente)"
      description={
        <>
          Remove apenas registros canônicos criados <strong>nativamente pela UI</strong>:
          clientes, projetos, propostas, deals e recebimentos onde
          <code> external_source IS NULL</code> (ou diferente de SolarMarket).
          <span className="block mt-2 text-xs text-muted-foreground">
            ✅ Dados migrados do SM e leads ficam intactos.
          </span>
        </>
      }
      buttonLabel="Resetar Dados Nativos"
      confirmTitle="Confirmar reset de nativos"
      confirmKeyword="LIMPAR NATIVOS"
      confirmDescription={
        <span className="block">
          Isso apagará <strong>todos os registros criados manualmente</strong>.
          Registros migrados do SolarMarket serão preservados.
        </span>
      }
      isPending={m.isPending}
      counts={m.data?.counts}
      onConfirm={() => m.mutate()}
      icon={<User className="h-4 w-4 mr-2" />}
    />
  );
}
