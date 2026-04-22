/**
 * Migração SolarMarket — Step 3 (Migrar). Placeholder.
 */
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction } from "lucide-react";

export default function MigracaoStep3Migrar() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1000px]">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/admin/migracao-solarmarket">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para a migração
          </Link>
        </Button>
        <h1 className="text-xl font-bold text-foreground">
          Step 3 — Criar no seu CRM
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Promova clientes, projetos e propostas da área de revisão para o CRM.
        </p>
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Construction className="w-5 h-5 text-warning" />
            <CardTitle className="text-base font-semibold text-foreground">
              Em construção
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Esta etapa será implementada em breve. Conclua os Steps 1 e 2 primeiro.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
