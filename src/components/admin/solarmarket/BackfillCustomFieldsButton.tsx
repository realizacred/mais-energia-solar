/**
 * Botão "Continuar Backfill de Documentos" — chunked manual.
 * Chama sm-promote-custom-fields (batch=25) a partir do último offset salvo
 * em localStorage. Permite ao usuário avançar 1 chunk por clique até concluir,
 * sem depender de timeout do servidor.
 */
import { useMemo, useState } from "react";
import { Loader2, Download, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  tenantId: string | null | undefined;
  initialOffset?: number;
  batch?: number;
}

interface BackfillState {
  offset: number;
  totalUpserted: number;
  totalFiles: number;
  totalNative: number;
  totalErrors: number;
  totalProcessed: number;
  done: boolean;
  lastErrors: any[];
}

const DEFAULT_STATE: BackfillState = {
  offset: 600,
  totalUpserted: 0,
  totalFiles: 0,
  totalNative: 0,
  totalErrors: 0,
  totalProcessed: 0,
  done: false,
  lastErrors: [],
};

function storageKey(tenantId: string) {
  return `sm_backfill_custom_fields:${tenantId}`;
}

function loadState(tenantId: string, initialOffset: number): BackfillState {
  try {
    const raw = localStorage.getItem(storageKey(tenantId));
    if (!raw) return { ...DEFAULT_STATE, offset: initialOffset };
    const parsed = JSON.parse(raw) as Partial<BackfillState>;
    return { ...DEFAULT_STATE, offset: initialOffset, ...parsed };
  } catch {
    return { ...DEFAULT_STATE, offset: initialOffset };
  }
}

function saveState(tenantId: string, state: BackfillState) {
  try {
    localStorage.setItem(storageKey(tenantId), JSON.stringify(state));
  } catch { /* ignore */ }
}

export function BackfillCustomFieldsButton({
  tenantId,
  initialOffset = 600,
  batch = 25,
}: Props) {
  const [state, setState] = useState<BackfillState>(() =>
    tenantId ? loadState(tenantId, initialOffset) : { ...DEFAULT_STATE, offset: initialOffset },
  );
  const [running, setRunning] = useState(false);
  const [currentOffset, setCurrentOffset] = useState<number | null>(null);

  const updateState = (next: BackfillState) => {
    setState(next);
    if (tenantId) saveState(tenantId, next);
  };

  const handleClick = async () => {
    if (!tenantId || running || state.done) return;
    setRunning(true);
    setCurrentOffset(state.offset);

    // Safety timeout — destrava o botão se a invocação não retornar em 120s
    // (ex.: timeout silencioso de gateway). O backend continua processando;
    // o usuário só clica de novo no próximo chunk.
    const timeoutMs = 120_000;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setRunning(false);
      setCurrentOffset(null);
      toast({
        title: "Sem resposta do servidor (120s)",
        description:
          "O chunk pode ter concluído em segundo plano. Clique novamente para continuar do próximo offset.",
        variant: "destructive",
      });
    }, timeoutMs);

    try {
      const { data, error } = await supabase.functions.invoke("sm-promote-custom-fields", {
        body: {
          action: "promote",
          payload: { batch, offset: state.offset, tenant_id: tenantId },
        },
      });
      if (timedOut) return;
      if (error) throw error;

      const processed = Number(data?.processed ?? 0);
      const upserted = Number(data?.upserted ?? 0);
      const files = Number(data?.files_downloaded ?? 0);
      const native = Number(data?.native_updates ?? 0);
      const errs = Array.isArray(data?.errors) ? data.errors : [];
      const next = data?.next_offset;
      // Concluído quando next_offset vem null/undefined OU quando processed=0
      // (significa que não há mais registros na janela do tenant).
      const isDone = next === null || next === undefined || processed === 0;

      const newState: BackfillState = {
        offset: isDone ? state.offset : Number(next),
        totalProcessed: state.totalProcessed + processed,
        totalUpserted: state.totalUpserted + upserted,
        totalFiles: state.totalFiles + files,
        totalNative: state.totalNative + native,
        totalErrors: state.totalErrors + errs.length,
        done: isDone,
        lastErrors: errs,
      };
      updateState(newState);

      toast({
        title: isDone ? "✅ Backfill concluído!" : `Chunk OK (offset ${state.offset})`,
        description: `+${upserted} campos · +${files} docs · +${errs.length} erros · próximo offset: ${isDone ? "—" : next}`,
      });
    } catch (e: any) {
      if (timedOut) return;
      toast({
        title: "Falha no chunk",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      clearTimeout(timeoutId);
      if (!timedOut) {
        setRunning(false);
        setCurrentOffset(null);
      }
    }
  };

  const handleReset = () => {
    if (!tenantId) return;
    if (!confirm("Resetar contadores e voltar ao offset inicial?")) return;
    const fresh: BackfillState = { ...DEFAULT_STATE, offset: initialOffset };
    updateState(fresh);
  };

  const buttonLabel = useMemo(() => {
    if (running) return `Processando offset ${currentOffset}...`;
    if (state.done) return "Backfill concluído";
    return `Continuar backfill (offset ${state.offset})`;
  }, [running, currentOffset, state.done, state.offset]);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Backfill de Documentos (sm-promote-custom-fields)
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Avance um chunk de {batch} registros por clique. O offset é
            persistido localmente — você pode parar e retomar quando quiser.
          </p>
        </div>
        {state.done ? (
          <Badge className="gap-1 bg-success/15 text-success border-success/30">
            <CheckCircle2 className="w-3 h-3" /> Concluído
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={handleClick}
          disabled={!tenantId || running || state.done}
        >
          {running ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {buttonLabel}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReset}
          disabled={running || !tenantId}
        >
          <RotateCcw className="w-4 h-4" /> Resetar contadores
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <Stat label="Processados" value={state.totalProcessed} />
        <Stat label="Campos gravados" value={state.totalUpserted} />
        <Stat label="Documentos baixados" value={state.totalFiles} />
        <Stat label="Updates nativos" value={state.totalNative} />
        <Stat label="Erros" value={state.totalErrors} tone={state.totalErrors > 0 ? "warn" : undefined} />
      </div>

      {state.lastErrors.length > 0 && (
        <div className="rounded border border-warning/30 bg-warning/5 p-2 text-xs space-y-1">
          <div className="flex items-center gap-1 text-warning font-medium">
            <AlertTriangle className="w-3.5 h-3.5" /> Erros do último chunk:
          </div>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5 max-h-32 overflow-auto">
            {state.lastErrors.slice(0, 10).map((err: any, i: number) => (
              <li key={i} className="font-mono">
                {err?.projeto_id ?? err?.id ?? "?"}: {err?.error ?? err?.message ?? JSON.stringify(err)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div
      className={`rounded border p-2 ${
        tone === "warn"
          ? "border-warning/40 bg-warning/5 text-warning"
          : "border-border bg-card text-foreground"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}
