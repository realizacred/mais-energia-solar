/**
 * EnrichVersoesCard — Step 3 (opcional) — enriquece propostas migradas do SolarMarket
 * com dados completos: kit gerador, financeiro, técnico, UCs e localização do projeto.
 *
 * Sobrescreve dados existentes. Idempotente — pode rodar várias vezes.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  Sparkles,
  Package,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  useSmEnrichVersoes,
  type EnrichTotals,
} from "@/hooks/useSmEnrichVersoes";

export function EnrichVersoesCard() {
  const enrich = useSmEnrichVersoes();
  const [progress, setProgress] = useState<EnrichTotals | null>(null);

  const handleRun = async () => {
    setProgress(null);
    try {
      const result = await enrich.mutateAsync({
        batch: 25,
        onProgress: (p) => setProgress(p),
      });
      toast({
        title: "Propostas enriquecidas",
        description: `${result.versoes_updated} versões · ${result.kit_itens_inserted} itens de kit · ${result.ucs_inserted} UCs · ${result.projetos_updated} projetos`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: "Falha ao enriquecer propostas",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const isRunning = enrich.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
    >
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-foreground">
                  Enriquecer propostas migradas
                </h2>
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/20 gap-1.5"
                >
                  <Sparkles className="w-3 h-3" /> Tudo de uma vez
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Reconstrói <strong>kit gerador</strong> (módulos, inversores,
                estruturas), preenche <strong>dados financeiros</strong> (valor,
                custo, margem, payback, TIR, VPL), <strong>técnicos</strong>{" "}
                (kWp, geração, área), <strong>UCs</strong> e{" "}
                <strong>localização do projeto</strong> (endereço, lat/lng) a
                partir do staging <code>sm_propostas_raw</code>. Sobrescreve
                sempre — idempotente.
              </p>
            </div>
            <Button onClick={handleRun} disabled={isRunning} className="gap-2">
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Enriquecendo…
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" /> Enriquecer tudo
                </>
              )}
            </Button>
          </div>

          {(isRunning || progress) && progress && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-border text-xs">
              <Stat label="Propostas" value={progress.processed} />
              <Stat label="Versões" value={progress.versoes_updated} tone="success" />
              <Stat label="Itens kit" value={progress.kit_itens_inserted} tone="success" />
              <Stat label="UCs" value={progress.ucs_inserted} tone="success" />
              <Stat label="Projetos" value={progress.projetos_updated} tone="success" />
            </div>
          )}

          {progress && !isRunning && progress.errors.length === 0 && (
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
                  {(e.versao_id || e.proposta_id || "").slice(0, 8)}… —{" "}
                  {e.error}
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
