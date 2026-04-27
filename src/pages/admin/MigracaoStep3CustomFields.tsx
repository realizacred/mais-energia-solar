/**
 * Migração SolarMarket — Step 3 (Custom Fields).
 *
 * Mapeia cada campo customizado vindo do staging (sm_custom_fields_raw).
 * Layout denso e full-width via MigrationLayout (RB-04 / RB-69).
 */
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useTenantId } from "@/hooks/useTenantId";
import { CustomFieldsMapping } from "@/components/admin/solarmarket/mapeamento/CustomFieldsMapping";
import { MigrationLayout } from "@/components/admin/solarmarket/MigrationLayout";

export default function MigracaoStep3CustomFields() {
  const { data: tenantId } = useTenantId();
  const navigate = useNavigate();

  return (
    <MigrationLayout
      stepLabel="Step 3 / 4"
      title="Mapear campos customizados"
      subtitle="Vincule, crie ou ignore cada campo do SolarMarket antes de promover. Sem mapeamento, dados como tipo de telhado e garantias ficam soltos no staging."
      backTo="/admin/migracao-solarmarket/mapear"
      backLabel="Voltar para mapeamento de funis"
      actions={
        <Button
          size="sm"
          onClick={() => navigate("/admin/migracao-solarmarket/migrar")}
        >
          Continuar para Step 4
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      }
    >
      {tenantId && <CustomFieldsMapping tenantId={tenantId} />}
    </MigrationLayout>
  );
}
