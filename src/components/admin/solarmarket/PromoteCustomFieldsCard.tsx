/**
 * PromoteCustomFieldsCard — Card opcional do Step 3 que promove os campos
 * customizados `cap_*` do staging para `deal_custom_field_values` e baixa
 * os arquivos (cap_identidade, cap_comprovante_endereco) para o bucket
 * `imported-files`.
 *
 * Pode ser executado a qualquer momento após a migração principal — é idempotente.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  Download,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  useSmPromoteCustomFields,
  type PromoteCfTotals,
} from "@/hooks/useSmPromoteCustomFields";

export function PromoteCustomFieldsCard() {
  const promote = useSmPromoteCustomFields();
  const [progress, setProgress] = useState<PromoteCfTotals | null>(null);

  const handleRun = async () => {
    setProgress(null);
    try {
      const result = await promote.mutateAsync({
        batch: 20,
        onProgress: (p) => setProgress(p),
      });
      toast({
        title: "Custom fields promovidos",
        description: `${result.upserted} valores · ${result.files_downloaded} arquivos baixados${result.files_failed > 0 ? ` · ${result.files_failed} falhas` : ""}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: "Falha ao promover custom fields",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const isRunning = promote.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-foreground">
                  Campos customizados & arquivos
                </h2>
                <Badge
                  variant="outline"
                  className="bg-info/10 text-info border-info/20 gap-1.5"
                >
                  <FileText className="w-3 h-3" /> Opcional
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Lê <code>cap_*</code> das propostas em staging e grava nos campos
                customizados dos projetos. Para identidade e comprovante de
                endereço, baixa os arquivos das URLs externas para o bucket{" "}
                <code>imported-files</code>. Idempotente — pode rodar várias
                vezes.
              </p>
            </div>
            <Button onClick={handleRun} disabled={isRunning} className="gap-2">
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processando…
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Promover custom fields
                </>
              )}
            </Button>
          </div>

          {(isRunning || progress) && progress && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-border text-xs">
              <Stat label="Projetos" value={progress.processed} />
              <Stat label="Valores" value={progress.upserted} tone="success" />
              <Stat
                label="Arquivos baixados"
                value={progress.files_downloaded}
                tone="success"
              />
              <Stat
                label="Já existiam"
                value={progress.files_skipped}
                tone="muted"
              />
              <Stat
                label="Falhas"
                value={progress.files_failed}
                tone={progress.files_failed > 0 ? "destructive" : "muted"}
              />
            </div>
          )}

          {progress && !isRunning && progress.files_failed === 0 && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="w-4 h-4" />
              Concluído em {(progress.duration_ms / 1000).toFixed(1)}s.
            </div>
          )}

          {progress && progress.errors.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs space-y-1 max-h-40 overflow-y-auto">
              <div className="flex items-center gap-2 font-semibold text-warning">
                <AlertTriangle className="w-3.5 h-3.5" />
                Primeiros erros ({progress.errors.length})
              </div>
              {progress.errors.slice(0, 10).map((e, i) => (
                <div
                  key={i}
                  className="font-mono text-muted-foreground truncate"
                >
                  {e.deal_id?.slice(0, 8)}… — {e.error}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "destructive" | "muted";
}) {
  const colorMap = {
    default: "text-foreground",
    success: "text-success",
    destructive: "text-destructive",
    muted: "text-muted-foreground",
  } as const;
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={`font-mono font-bold ${colorMap[tone]}`}>
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}
