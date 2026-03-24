import { useCallback } from "react";
import { Check, FileText, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useDealDocChecklist, useUpdateDealDocChecklist } from "@/hooks/useDealDocChecklist";

interface DocItem {
  key: string;
  label: string;
  icon: string;
}

const DOC_ITEMS: DocItem[] = [
  { key: "rg_cnh", label: "RG/CNH dos Proprietários", icon: "🪪" },
  { key: "conta_luz", label: "Conta de Luz (Última fatura)", icon: "⚡" },
  { key: "iptu_imovel", label: "IPTU/Documento do Imóvel", icon: "🏠" },
  { key: "fotos", label: "Fotos (Telhado, Padrão, Quadro)", icon: "📷" },
  { key: "autorizacao_art", label: "Autorização Concessionária (ART)", icon: "📋" },
  { key: "contrato_assinado", label: "Contrato Assinado", icon: "✍️" },
];

interface Props {
  dealId: string;
  compact?: boolean;
}

export function ProjetoDocChecklist({ dealId, compact = false }: Props) {
  const { data: checklist = {}, isLoading } = useDealDocChecklist(dealId);
  const updateMutation = useUpdateDealDocChecklist();

  const toggleItem = useCallback(async (key: string) => {
    const newVal = !checklist[key];
    const updated = { ...checklist, [key]: newVal };
    try {
      await updateMutation.mutateAsync({ dealId, checklist: updated });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  }, [checklist, dealId, updateMutation]);

  const completed = DOC_ITEMS.filter(d => checklist[d.key]).length;
  const total = DOC_ITEMS.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  if (isLoading) {
    return compact ? (
      <Skeleton className="h-6 w-full" />
    ) : (
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary" />
            Documentos
          </span>
          <span className={cn(
            "font-bold",
            completed === total ? "text-success" : "text-muted-foreground"
          )}>
            {completed}/{total}
          </span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              completed === total ? "bg-success" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Checklist de Documentos
          </CardTitle>
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full",
            completed === total
              ? "bg-success/10 text-success"
              : completed > 0
              ? "bg-warning/10 text-warning"
              : "bg-muted text-muted-foreground"
          )}>
            {completed}/{total}
          </span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              completed === total ? "bg-success" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {DOC_ITEMS.map(item => {
          const checked = !!checklist[item.key];
          return (
            <button
              key={item.key}
              onClick={() => toggleItem(item.key)}
              disabled={updateMutation.isPending}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left",
                "hover:bg-muted/50",
                checked ? "bg-success/5" : "bg-card"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                checked
                  ? "bg-success border-success text-success-foreground"
                  : "border-border bg-card"
              )}>
                {checked && <Check className="h-3 w-3" />}
              </div>
              <span className="text-base mr-1">{item.icon}</span>
              <span className={cn(
                "text-sm flex-1",
                checked ? "text-muted-foreground line-through" : "text-foreground font-medium"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}

        {completed < total && (
          <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-warning/5 border border-warning/20">
            <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" />
            <span className="text-[11px] text-warning">
              {total - completed} documento(s) pendente(s)
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
