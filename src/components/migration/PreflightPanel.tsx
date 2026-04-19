/**
 * PreflightPanel — Pré-validação visual + impacto estimado antes de criar um job.
 *
 * Renderiza um conjunto de checks (semáforo) e um bloco de "Impacto estimado".
 * Não dispara nada — apenas informa. O bloqueio efetivo do botão de execução
 * é feito pelo componente pai com base em `data?.blocked`.
 */
import { CheckCircle2, AlertTriangle, Info, XCircle, Loader2 } from "lucide-react";
import { SectionCard } from "@/components/ui-kit";
import { useMigrationPreflight } from "@/hooks/useMigrationPreflight";
import { cn } from "@/lib/utils";

interface Props {
  tenantId: string | null;
}

export function PreflightPanel({ tenantId }: Props) {
  const { data, isLoading, isFetching } = useMigrationPreflight(tenantId);

  if (!tenantId) {
    return (
      <SectionCard title="Pré-validação" variant="neutral">
        <p className="text-xs text-muted-foreground">
          Selecione um tenant para ver as checagens.
        </p>
      </SectionCard>
    );
  }

  if (isLoading || !data) {
    return (
      <SectionCard title="Pré-validação" variant="neutral">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Validando...
        </div>
      </SectionCard>
    );
  }

  const checks: Array<{ tone: "ok" | "warn" | "info" | "err"; label: string }> = [];
  checks.push(
    data.tenantOk
      ? { tone: "ok", label: "Tenant válido" }
      : { tone: "err", label: "Tenant inválido" },
  );
  checks.push(
    data.stagingOk
      ? {
          tone: "ok",
          label: `Staging encontrado (${(
            data.totalClients +
            data.totalProjects +
            data.totalProposals
          ).toLocaleString("pt-BR")} reg.)`,
        }
      : { tone: "err", label: "Sem dados de staging" },
  );
  if (data.stagingOk) {
    if (data.defaultedToComercial > 0) {
      checks.push({
        tone: "info",
        label: `${data.defaultedToComercial.toLocaleString("pt-BR")} projetos sem funil → pipeline Comercial`,
      });
    }
    if (data.vendedorAsConsultor > 0) {
      checks.push({
        tone: "info",
        label: `${data.vendedorAsConsultor.toLocaleString("pt-BR")} projetos do funil "Vendedores" → consultor + status`,
      });
    }
    if (data.missingStagesEstimate > 0) {
      checks.push({
        tone: "warn",
        label: `${data.missingStagesEstimate} etapas serão criadas se não existirem`,
      });
    }
    if (data.diagnostics.length > 0) {
      checks.push({
        tone: "warn",
        label: `Diagnóstico: ${data.diagnostics.join("; ")}`,
      });
    }
  }
  checks.push(
    data.blocked
      ? { tone: "err", label: data.blockReason ?? "Execução bloqueada" }
      : { tone: "ok", label: "Execução liberada" },
  );

  return (
    <SectionCard
      title="Pré-validação"
      variant="neutral"
      actions={
        isFetching ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> atualizando
          </span>
        ) : null
      }
    >
      <div className="space-y-3">
        <ul className="space-y-1.5">
          {checks.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <ToneIcon tone={c.tone} />
              <span className={cn(toneText(c.tone))}>{c.label}</span>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Estimate label="Clientes (staging)" value={data.totalClients} />
          <Estimate label="Projetos (staging)" value={data.totalProjects} />
          <Estimate label="Propostas (staging)" value={data.totalProposals} />
          <Estimate
            label="Vendedor → consultor"
            value={data.vendedorAsConsultor}
            tone={data.vendedorAsConsultor > 0 ? "warn" : undefined}
          />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Projetos sem funil ({data.defaultedToComercial.toLocaleString("pt-BR")}) caem em <strong>Comercial</strong>.
          Projetos do funil "Vendedores" ({data.vendedorAsConsultor.toLocaleString("pt-BR")}) viram <strong>consultor responsável</strong> e a etapa é derivada do status da proposta. A contagem definitiva é apurada durante a execução do job.
        </p>
      </div>
    </SectionCard>
  );
}

function ToneIcon({ tone }: { tone: "ok" | "warn" | "info" | "err" }) {
  if (tone === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />;
  if (tone === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />;
  if (tone === "err") return <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />;
  return <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />;
}

function toneText(tone: "ok" | "warn" | "info" | "err") {
  if (tone === "warn") return "text-warning";
  if (tone === "err") return "text-destructive";
  return "text-foreground";
}

function Estimate({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card px-3 py-2",
        tone === "warn" && "border-warning/40 bg-warning/5",
      )}
    >
      <p className="text-lg font-semibold tabular-nums leading-none text-foreground">
        {value.toLocaleString("pt-BR")}
      </p>
      <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
