/**
 * UpgradeModal — Select a plan and create an Asaas charge.
 * §25-S1 modal pattern. §16 queries in hooks.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Sparkles, Check, Loader2 } from "lucide-react";
import { useBillingPlans, type BillingPlan } from "@/hooks/useBillingPlans";
import { useCreateUpgradeCharge } from "@/hooks/useBillingUpgrade";
import { AsaasNotConfigured } from "./AsaasNotConfigured";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanCode?: string;
}

export function UpgradeModal({
  open,
  onOpenChange,
  currentPlanCode,
}: UpgradeModalProps) {
  const { data: plans = [], isLoading: plansLoading } = useBillingPlans();
  const createCharge = useCreateUpgradeCharge();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const upgradePlans = plans.filter(
    (p) => p.is_active && p.code !== currentPlanCode && p.price_monthly > 0,
  );

  const isAsaasNotConfigured = (createCharge.error as any)?.code === "asaas_not_configured";

  const handleConfirm = async () => {
    if (!selectedPlanId) return;

    const result = await createCharge.mutateAsync(selectedPlanId);

    if (result.invoice_url) {
      window.open(result.invoice_url, "_blank");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Fazer upgrade do plano
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Selecione o plano desejado e confirme para gerar a cobrança
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-3">
            {isAsaasNotConfigured ? (
              <AsaasNotConfigured context="upgrade" className="min-h-[200px] py-8" />
            ) : plansLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : upgradePlans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum plano disponível para upgrade.
              </div>
            ) : (
              upgradePlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  selected={selectedPlanId === plan.id}
                  onSelect={() => setSelectedPlanId(plan.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createCharge.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedPlanId || createCharge.isPending}
            className="gap-2"
          >
            {createCharge.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando cobrança...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4" />
                Confirmar e pagar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: BillingPlan;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`p-4 cursor-pointer transition-all ${
        selected
          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
          : "hover:border-primary/40"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selected
                ? "border-primary bg-primary"
                : "border-muted-foreground/30"
            }`}
          >
            {selected && <Check className="w-3 h-3 text-primary-foreground" />}
          </div>
          <div>
            <p className="font-semibold text-foreground">{plan.name}</p>
            {plan.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {plan.description}
              </p>
            )}
          </div>
        </div>
        <Badge variant="outline" className="text-sm font-mono">
          R${" "}
          {plan.price_monthly.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}
          /mês
        </Badge>
      </div>
    </Card>
  );
}
