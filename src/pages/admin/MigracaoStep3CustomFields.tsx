/**
 * Migração SolarMarket — Step 3 (Custom Fields).
 *
 * Mapeia cada campo customizado vindo do staging (sm_custom_fields_raw) para:
 *  - um deal_custom_field existente (map)
 *  - um novo deal_custom_field a ser criado (create)
 *  - um path nativo da proposta (map_native — snapshot.tipo_telhado etc.)
 *  - ignorar (ignore)
 *
 * Etapa dedicada — extraída do antigo Step 2 para reduzir carga cognitiva e
 * permitir validar o mapeamento antes de promover. RB-04 / RB-69.
 */
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ListChecks } from "lucide-react";
import { useTenantId } from "@/hooks/useTenantId";
import { CustomFieldsMapping } from "@/components/admin/solarmarket/mapeamento/CustomFieldsMapping";

export default function MigracaoStep3CustomFields() {
  const { data: tenantId } = useTenantId();
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1100px]">
      {/* Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/admin/migracao-solarmarket/mapear">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para o mapeamento de funis
          </Link>
        </Button>
        <h1 className="text-xl font-bold text-foreground">
          Step 3 — Mapear campos customizados
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Para cada campo do SolarMarket, escolha como ele deve ser tratado no CRM:
          vincular a um campo existente, criar um novo, gravar em um campo nativo da proposta
          ou ignorar.
        </p>
      </div>

      {/* Card de introdução */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <ListChecks className="w-5 h-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Por que esta etapa é importante
              </p>
              <p className="text-sm text-muted-foreground">
                Sem mapeamento, dados como tipo de telhado, garantias e campos personalizados
                ficam em texto solto no staging e não aparecem na proposta nativa.
                Defina cada campo aqui antes de promover.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de campos customizados */}
      {tenantId && <CustomFieldsMapping tenantId={tenantId} />}

      {/* Continuar */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-5 flex justify-end">
          <Button onClick={() => navigate("/admin/migracao-solarmarket/migrar")}>
            Continuar para Step 4 — Migrar
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
