/**
 * FormulaAISuggest — Mini-modal for AI-assisted formula generation.
 * Uses Lovable AI via suggest-formula edge function.
 */
import { useState } from "react";
import { Sparkles, Loader2, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VARIABLES_CATALOG } from "@/lib/variablesCatalog";

interface FormulaAISuggestProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: (formula: string) => void;
}

export function FormulaAISuggest({ open, onOpenChange, onAccept }: FormulaAISuggestProps) {
  const [description, setDescription] = useState("");
  const [formula, setFormula] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get available variable keys for context
  const availableVars = VARIABLES_CATALOG
    .filter((v) => !v.notImplemented)
    .map((v) => v.legacyKey.replace(/^\[|\]$/g, ""))
    .slice(0, 80);

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast.error("Descreva o que a fórmula deve calcular");
      return;
    }

    setLoading(true);
    setError(null);
    setFormula(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("suggest-formula", {
        body: {
          description: description.trim(),
          available_variables: availableVars,
        },
      });

      if (fnError) throw fnError;

      const result = data?.formula || "";
      if (result.startsWith("IMPOSSIVEL:")) {
        setError(result.replace("IMPOSSIVEL:", "").trim());
      } else {
        setFormula(result);
      }
    } catch (e: any) {
      const msg = e?.message || "Erro ao gerar fórmula";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (formula) {
      onAccept(formula);
      onOpenChange(false);
      setDescription("");
      setFormula(null);
      toast.success("Fórmula inserida na expressão");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setDescription("");
    setFormula(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Sugerir fórmula com IA
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Descreva o cálculo e a IA gerará a expressão
            </DialogDescription>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            <div>
              <Label className="text-xs font-medium">Descreva o que a variável deve calcular:</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Percentual de quanto a geração solar cobre do consumo mensal"
                className="min-h-[80px] text-sm mt-1.5"
              />
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">Exemplos de descrições:</p>
              <div className="flex flex-wrap gap-1">
                {[
                  "Economia acumulada em 25 anos",
                  "Preço por watt-pico em R$/Wp",
                  "Percentual de cobertura solar",
                  "ROI anual do investimento",
                ].map((ex) => (
                  <Badge
                    key={ex}
                    variant="outline"
                    className="text-[9px] cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={() => setDescription(ex)}
                  >
                    {ex}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1">
                Variáveis disponíveis ({availableVars.length}):
              </p>
              <div className="max-h-[100px] overflow-y-auto bg-muted/30 rounded-lg p-2">
                <p className="text-[9px] font-mono text-muted-foreground leading-relaxed">
                  {availableVars.slice(0, 30).map((v) => `[${v}]`).join(", ")}
                  {availableVars.length > 30 && ` ... +${availableVars.length - 30} mais`}
                </p>
              </div>
            </div>

            {/* Result */}
            {formula && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-2">
                <p className="text-xs font-medium text-success flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Fórmula gerada:
                </p>
                <code className="block text-sm font-mono text-foreground bg-card p-2 rounded border border-border break-all">
                  {formula}
                </code>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          {formula ? (
            <>
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Tentar novamente
              </Button>
              <Button onClick={handleAccept}>
                <Check className="h-3.5 w-3.5 mr-1" /> Usar esta fórmula
              </Button>
            </>
          ) : (
            <Button onClick={handleGenerate} disabled={loading || !description.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> Gerar fórmula
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
