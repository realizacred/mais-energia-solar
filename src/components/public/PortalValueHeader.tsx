/**
 * PortalValueHeader — Commercial value message card shown at top of portal.
 * Communicates the benefit of shared energy in simple terms.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Sun, Zap } from "lucide-react";

interface PortalValueHeaderProps {
  unitName: string;
  codigoUc: string;
  hasGd: boolean;
  totalSavingsYear?: number;
}

export function PortalValueHeader({ unitName, codigoUc, hasGd, totalSavingsYear }: PortalValueHeaderProps) {
  return (
    <Card className="border-l-[3px] border-l-primary bg-primary/[0.03] overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sun className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {unitName}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              UC: <span className="font-mono font-medium text-foreground">{codigoUc}</span>
            </p>
            {hasGd ? (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed flex items-start gap-1.5">
                <Zap className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                <span>
                  Você está economizando com energia compartilhada.
                  {totalSavingsYear != null && totalSavingsYear > 0 && (
                    <> Neste ano sua economia já é de <span className="font-semibold text-success">R$ {totalSavingsYear.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>.</>
                  )}
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Acompanhe aqui suas faturas, consumo e economia.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
