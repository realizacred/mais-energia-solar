/**
 * SolarmarketMapeamentos — Placeholder da Fase 2 do fluxo SolarMarket.
 * RB-01/RB-02: tokens semânticos. RB-03: Button shadcn. RB-21: shadow-sm.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Construction } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function SolarmarketMapeamentos() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/importacao-solarmarket">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Importação
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-bold text-foreground">Mapeamentos SolarMarket</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fase 2 de 3 — Configure como os funis do SolarMarket viram pipelines/consultores.
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
            Esta página será implementada na Fase 2. Complete a importação primeiro (Fase 1).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
