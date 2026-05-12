/**
 * Botão "Download documentos SM" — chunked manual.
 * Chama sm-download-documents (batch=10) a partir do offset 0,
 * baixando cada URL externa para o bucket projeto-documentos.
 */
import { useMemo, useState } from "react";
import { Loader2, Download, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  tenantId: string | null | undefined;
  batch?: number;
}

interface State {
  offset: number;
  totalProcessed: number;
  totalDownloaded: number;
  totalSkipped: number;
  totalErrors: number;
  done: boolean;
  lastErrors: any[];
}

const DEFAULT: State = {
  offset: 0, totalProcessed: 0, totalDownloaded: 0, totalSkipped: 0,
  totalErrors: 0, done: false, lastErrors: [],
};

const STORAGE_KEY = (t: string) => `sm_download_documents:${t}`;

function load(tenantId: string): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(tenantId));
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch { return DEFAULT; }
}
function save(tenantId: string, s: State) {
  try { localStorage.setItem(STORAGE_KEY(tenantId), JSON.stringify(s)); } catch {}
}

export function DownloadDocumentsButton({ tenantId, batch = 10 }: Props) {
  const [state, setState] = useState<State>(() => tenantId ? load(tenantId) : DEFAULT);
  const [running, setRunning] = useState(false);

  const update = (s: State) => { setState(s); if (tenantId) save(tenantId, s); };

  const handleClick = async () => {
    if (!tenantId || running || state.done) return;
    setRunning(true);
    const timeout = setTimeout(() => {
      setRunning(false);
      toast({ title: "Sem resposta (120s)", description: "Clique novamente para continuar.", variant: "destructive" });
    }, 120_000);

    try {
      const { data, error } = await supabase.functions.invoke("sm-download-documents", {
        body: { tenant_id: tenantId, batch, offset: state.offset },
      });
      if (error) throw error;

      const processed = Number(data?.processed ?? 0);
      const downloaded = Number(data?.downloaded ?? 0);
      const skipped = Number(data?.skipped ?? 0);
      const errs = Array.isArray(data?.errors) ? data.errors : [];
      const next = data?.next_offset;
      const isDone = next === null || next === undefined || processed === 0;

      const ns: State = {
        offset: isDone ? state.offset : Number(next),
        totalProcessed: state.totalProcessed + processed,
        totalDownloaded: state.totalDownloaded + downloaded,
        totalSkipped: state.totalSkipped + skipped,
        totalErrors: state.totalErrors + errs.length,
        done: isDone,
        lastErrors: errs,
      };
      update(ns);

      toast({
        title: isDone ? "✅ Download concluído!" : `Chunk OK (offset ${state.offset})`,
        description: `+${downloaded} baixados · ${skipped} pulados · ${errs.length} erros`,
      });
    } catch (e: any) {
      toast({ title: "Falha", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      clearTimeout(timeout);
      setRunning(false);
    }
  };

  const handleReset = () => {
    if (!tenantId) return;
    if (!confirm("Resetar contadores e voltar ao offset 0?")) return;
    update(DEFAULT);
  };

  const label = useMemo(() => {
    if (running) return `Processando offset ${state.offset}...`;
    if (state.done) return "Download concluído";
    return `Continuar download (offset ${state.offset})`;
  }, [running, state.done, state.offset]);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Download de Documentos SM (Identidade & Comprovante)
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Baixa as URLs externas do S3 do SolarMarket para o bucket interno e
            atualiza os campos. Avance {batch} registros por clique.
          </p>
        </div>
        {state.done && (
          <Badge className="gap-1 bg-success/15 text-success border-success/30">
            <CheckCircle2 className="w-3 h-3" /> Concluído
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleClick} disabled={!tenantId || running || state.done}>
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {label}
        </Button>
        <Button size="sm" variant="outline" onClick={handleReset} disabled={running || !tenantId}>
          <RotateCcw className="w-4 h-4" /> Resetar
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Stat label="Processados" value={state.totalProcessed} />
        <Stat label="Baixados" value={state.totalDownloaded} />
        <Stat label="Pulados (já existem)" value={state.totalSkipped} />
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
                {err?.deal_id ?? "?"}: {err?.error ?? JSON.stringify(err)}
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
    <div className={`rounded border p-2 ${tone === "warn" ? "border-warning/40 bg-warning/5 text-warning" : "border-border bg-card text-foreground"}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}
