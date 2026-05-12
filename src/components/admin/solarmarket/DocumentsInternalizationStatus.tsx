/**
 * DocumentsInternalizationStatus
 * Painel READ-ONLY do estado de internalização de documentos SM.
 * Substitui os botões manuais "Backfill" e "Download documentos SM" — agora
 * o download é executado dentro de sm-promote-custom-fields (canônico).
 * (RB-65, RB-71). AGENTS.md v4.1 / RB-76: sem segunda central, sem remendo.
 */
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Cloud, FileWarning, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface Props {
  tenantId: string | null | undefined;
}

interface Stats {
  internalized: number;
  pending: number;
  empty: number;
  errors: number;
  lastRunAt: string | null;
}

export function DocumentsInternalizationStatus({ tenantId }: Props) {
  const q = useQuery<Stats>({
    queryKey: ["sm-documents-status", tenantId],
    enabled: !!tenantId,
    staleTime: 30_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: defs } = await supabase
        .from("deal_custom_fields")
        .select("id")
        .eq("tenant_id", tenantId!)
        .in("field_key", ["cap_identidade", "cap_comprovante_endereco"]);
      const fieldIds = (defs ?? []).map((d: any) => d.id);
      if (fieldIds.length === 0) {
        return { internalized: 0, pending: 0, empty: 0, errors: 0, lastRunAt: null };
      }
      const { data: rows } = await supabase
        .from("deal_custom_field_values")
        .select("value_text")
        .in("field_id", fieldIds);

      let internalized = 0, pending = 0, empty = 0;
      for (const r of rows ?? []) {
        const v = (r as any).value_text as string | null;
        if (!v || v === "[]" || v === "null") { empty++; continue; }
        if (/https?:\/\//i.test(v)) pending++;
        else internalized++;
      }

      const { data: lastJob } = await supabase
        .from("solarmarket_promotion_jobs")
        .select("last_step_at, finished_at")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        internalized,
        pending,
        empty,
        errors: 0,
        lastRunAt: (lastJob as any)?.last_step_at ?? (lastJob as any)?.finished_at ?? null,
      };
    },
  });

  const s = q.data;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Documentos SolarMarket — Internalização
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            O download dos arquivos roda automaticamente após cada chunk de
            promoção (sm-migrate-chunk → sm-download-documents). Sem ação manual.
          </p>
        </div>
        {q.isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        {!q.isLoading && s && s.pending === 0 && s.internalized > 0 && (
          <Badge className="gap-1 bg-success/15 text-success border-success/30">
            <CheckCircle2 className="w-3 h-3" /> Tudo internalizado
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Stat icon={<Cloud className="w-3.5 h-3.5" />} label="Internalizados" value={s?.internalized ?? 0} tone="ok" />
        <Stat icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Pendentes (URL externa)" value={s?.pending ?? 0} tone={s && s.pending > 0 ? "warn" : undefined} />
        <Stat icon={<FileWarning className="w-3.5 h-3.5" />} label="Vazios" value={s?.empty ?? 0} />
        <Stat label="Última execução" valueText={s?.lastRunAt ? new Date(s.lastRunAt).toLocaleString("pt-BR") : "—"} />
      </div>
    </div>
  );
}

function Stat({
  label, value, valueText, tone, icon,
}: { label: string; value?: number; valueText?: string; tone?: "ok" | "warn"; icon?: React.ReactNode }) {
  const toneCls =
    tone === "ok" ? "border-success/40 bg-success/5 text-success"
      : tone === "warn" ? "border-warning/40 bg-warning/5 text-warning"
        : "border-border bg-card text-foreground";
  return (
    <div className={`rounded border p-2 ${toneCls}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="text-sm font-semibold tabular-nums">
        {valueText ?? (value ?? 0).toLocaleString("pt-BR")}
      </div>
    </div>
  );
}
