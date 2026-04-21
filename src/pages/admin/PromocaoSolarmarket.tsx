/**
 * PromocaoSolarmarket — Página dedicada da Fase 2 (Promoção Staging → CRM).
 *
 * Reutiliza o componente PromocaoSolarmarketSection, que também é embutido
 * dentro da página de Importação. SSOT em um único componente.
 */
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { PromocaoSolarmarketSection } from "@/components/admin/solarmarket/PromocaoSolarmarketSection";
import { Rocket, ArrowLeft } from "lucide-react";

export default function PromocaoSolarmarket() {
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <PageHeader
        icon={Rocket}
        title="Promoção SolarMarket → CRM"
        description="Fase 2 — promove registros já importados em staging para o domínio canônico (clientes, projetos, propostas e versões)."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/importacao-solarmarket">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Importação (Fase 1)
            </Link>
          </Button>
        }
      />
      <PromocaoSolarmarketSection />
    </div>
  );
}
