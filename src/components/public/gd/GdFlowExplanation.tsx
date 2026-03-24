/**
 * GdFlowExplanation — Visual explanation of how GD energy distribution works.
 * Uses simple language for non-technical clients.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sun, ArrowRight, Home, Building2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIA_LABELS: Record<string, string> = {
  gd1: "Autoconsumo Local",
  gd2: "Autoconsumo Remoto",
  gd3: "Compartilhado",
};

interface GdFlowExplanationProps {
  categoriaGd?: string | null;
  geradoraName?: string;
  beneficiaryCount: number;
  brandPrimary?: string;
}

export function GdFlowExplanation({
  categoriaGd,
  geradoraName,
  beneficiaryCount,
  brandPrimary,
}: GdFlowExplanationProps) {
  const catLabel = categoriaGd ? CATEGORIA_LABELS[categoriaGd] || categoriaGd.toUpperCase() : null;

  return (
    <Card className="border-l-[3px] border-l-success overflow-hidden">
      <CardHeader className="pb-2 px-4 sm:px-5">
        <CardTitle className="text-sm flex items-center gap-2 text-foreground">
          <Zap className="w-4 h-4 text-success" />
          Como sua energia é distribuída
          {catLabel && (
            <Badge variant="outline" className="text-[10px] ml-auto border-success/30 text-success">
              {catLabel}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-5 pb-4 space-y-4">
        {/* Visual Flow */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 py-3">
          {/* Usina */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center bg-warning/10"
              style={brandPrimary ? { backgroundColor: `${brandPrimary}15` } : undefined}
            >
              <Sun className="w-6 h-6 sm:w-7 sm:h-7 text-warning" />
            </div>
            <span className="text-[10px] sm:text-xs font-medium text-foreground text-center leading-tight">
              Usina Solar
            </span>
          </div>

          {/* Arrow 1 */}
          <div className="flex flex-col items-center gap-0.5">
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">100%</span>
          </div>

          {/* GD Distribution */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center bg-primary/10">
              <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            </div>
            <span className="text-[10px] sm:text-xs font-medium text-foreground text-center leading-tight">
              Distribuição
            </span>
          </div>

          {/* Arrow 2 */}
          <div className="flex flex-col items-center gap-0.5">
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">%</span>
          </div>

          {/* Beneficiárias */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center bg-info/10">
              {beneficiaryCount > 1 ? (
                <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-info" />
              ) : (
                <Home className="w-6 h-6 sm:w-7 sm:h-7 text-info" />
              )}
            </div>
            <span className="text-[10px] sm:text-xs font-medium text-foreground text-center leading-tight">
              {beneficiaryCount > 1 ? `${beneficiaryCount + 1} Unidades` : "Suas Unidades"}
            </span>
          </div>
        </div>

        {/* Simple explanation */}
        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
          <p className="text-xs text-foreground leading-relaxed">
            A energia gerada pela usina solar{geradoraName ? ` (${geradoraName})` : ""} é distribuída
            entre suas unidades de acordo com um <span className="font-semibold">percentual definido</span>.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Cada unidade recebe uma parte da energia e usa essa parte para{" "}
            <span className="font-medium text-success">compensar o consumo</span> da rede elétrica,{" "}
            <span className="font-medium text-foreground">reduzindo sua conta de luz</span>.
          </p>
        </div>

        {/* Key terms */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
          <div className="flex items-start gap-2 p-2 rounded-md bg-success/5 border border-success/10">
            <span className="w-2 h-2 rounded-full bg-success mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-foreground">Compensação</span>
              <p className="text-muted-foreground mt-0.5">Energia que você não precisou pagar</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/5 border border-destructive/10">
            <span className="w-2 h-2 rounded-full bg-destructive mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-foreground">Consumo</span>
              <p className="text-muted-foreground mt-0.5">Energia total utilizada pela unidade</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2 rounded-md bg-info/5 border border-info/10">
            <span className="w-2 h-2 rounded-full bg-info mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-foreground">Crédito</span>
              <p className="text-muted-foreground mt-0.5">Energia excedente acumulada para uso futuro</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
