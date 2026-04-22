/**
 * PromocaoPreflightCard — Diagnóstico pré-promoção exibido acima do "Promover Lote".
 *
 * Mostra:
 *  - Alerta de configuração incompleta (sem pipeline Comercial)
 *  - Checklist com status de pipeline, stages e mapeamento de consultores
 *
 * Governança:
 *  - RB-01: cores semânticas (bg-warning/10, text-success, etc.)
 *  - RB-04: consome hook dedicado (useSolarmarketDiagnostic)
 *  - RB-06: skeleton enquanto carrega
 */
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { useSolarmarketDiagnostic } from "@/hooks/useSolarmarketDiagnostic";
import { useConsultoresAtivos } from "@/hooks/useConsultoresAtivos";
import { AlertTriangle, CheckCircle2, XCircle, ListChecks, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItemProps {
  ok: boolean;
  label: string;
  detail?: string;
}

function ChecklistItem({ ok, label, detail }: ChecklistItemProps) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", ok ? "text-success" : "text-destructive")} />
      <div className="flex-1 min-w-0">
        <span className="text-foreground">{label}</span>
        {detail && <span className="text-muted-foreground ml-1">— {detail}</span>}
      </div>
    </li>
  );
}

export function PromocaoPreflightCard() {
  const diagnostic = useSolarmarketDiagnostic();
  const consultores = useConsultoresAtivos();

  if (diagnostic.isLoading || consultores.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const data = diagnostic.data;
  const hasComercial = !!data?.comercialPipeline;
  const stagesCount = data?.comercialPipeline?.stages.length ?? 0;
  const hasStages = stagesCount > 0;

  const totalConsultores = consultores.data?.length ?? 0;
  const hasConsultores = totalConsultores > 0;
  const allReady = hasComercial && hasStages && hasConsultores;

  return (
    <div className="space-y-4">
      {!hasComercial && (
        <Alert className="border-warning/40 bg-warning/10 text-foreground [&>svg]:text-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-foreground">Configuração Incompleta</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Não foi encontrado pipeline <strong className="text-foreground">"Comercial"</strong> no seu sistema.{" "}
            <Link
              to="/admin/solarmarket-diagnostic"
              className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
            >
              Clique aqui para configurar mapeamentos
              <ArrowRight className="w-3 h-3" />
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <SectionCard
        icon={ListChecks}
        title="Checklist Pré-Promoção"
        description="Verifique se o ambiente está pronto antes de promover o lote."
        variant={hasComercial && hasStages && allMapped ? "green" : "warning"}
      >
        <ul className="space-y-2.5">
          <ChecklistItem
            ok={hasComercial}
            label='Pipeline "Comercial" existe?'
            detail={hasComercial ? "SIM" : "NÃO"}
          />
          <ChecklistItem
            ok={hasStages}
            label="Pipeline tem stages configurados?"
            detail={hasStages ? `${stagesCount} stages` : "0 stages"}
          />
          <ChecklistItem
            ok={allMapped}
            label="Consultores mapeados?"
            detail={`${mappedConsultores} de ${totalConsultores}`}
          />
        </ul>

        {(!hasComercial || !hasStages || !allMapped) && (
          <div className="mt-4 pt-4 border-t border-border">
            <Link
              to="/admin/solarmarket-diagnostic"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1 font-medium"
            >
              Abrir diagnóstico de mapeamento
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
