/**
 * PortalSavingsHighlight — Commercial savings highlight card for the client portal.
 * Shows the current month's savings with encouraging commercial copy.
 */
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, Sparkles } from "lucide-react";

interface PortalSavingsHighlightProps {
  savingsBrl: number;
  monthLabel: string;
  compensatedKwh: number;
}

export function PortalSavingsHighlight({ savingsBrl, monthLabel, compensatedKwh }: PortalSavingsHighlightProps) {
  if (savingsBrl <= 0 && compensatedKwh <= 0) return null;

  return (
    <Card className="border-l-[3px] border-l-success bg-success/[0.03] overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            {savingsBrl > 0 ? (
              <>
                <p className="text-xs text-muted-foreground font-medium">
                  Economia em {monthLabel}
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-success font-mono mt-0.5">
                  R$ {savingsBrl.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Você economizou com energia compartilhada neste mês.
                  {compensatedKwh > 0 && (
                    <> Foram <span className="font-medium text-foreground">{compensatedKwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh</span> compensados na sua conta.</>
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground font-medium">
                  Energia compensada em {monthLabel}
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-success font-mono mt-0.5">
                  {compensatedKwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh
                </p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Energia que você recebeu da usina e não precisou pagar à concessionária.
                </p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
