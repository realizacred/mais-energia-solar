import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const CONFIRM_TEXT = "LIMPAR";

interface ResetResult {
  success: boolean;
  message: string;
  deleted: {
    points: number;
    cache: number;
    poa: number;
    versions_archived: number;
  };
}

interface Props {
  onComplete?: () => void;
}

export function ResetSolarDataButton({ onComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const canConfirm = confirmText === CONFIRM_TEXT && !loading;

  const handleReset = async () => {
    if (!canConfirm) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc("reset_solar_data_layer", {
        _confirm: CONFIRM_TEXT,
      });

      if (error) {
        const msg = error.message || "Erro desconhecido";
        if (msg.includes("P0403") || msg.includes("administradores")) {
          toast.error("Permissão negada", { description: "Apenas administradores podem executar esta operação." });
        } else {
          toast.error("Falha ao limpar base", { description: msg });
        }
        return;
      }

      const result = data as unknown as ResetResult;

      toast.success("🧹 Base meteorológica limpa!", {
        description: `Pontos: ${result.deleted.points.toLocaleString("pt-BR")} | Cache: ${result.deleted.cache.toLocaleString("pt-BR")} | POA: ${result.deleted.poa.toLocaleString("pt-BR")}`,
        duration: 10000,
      });

      setOpen(false);
      onComplete?.();
    } catch (e: any) {
      toast.error("Erro inesperado", { description: e.message });
    } finally {
      setLoading(false);
      setConfirmText("");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmText(""); }}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Limpar Base Meteorológica
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Limpar Base Meteorológica
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive font-medium">
                ⚠️ AÇÃO IRREVERSÍVEL — Todos os dados meteorológicos (RAW GHI/DHI/DNI, cache geoespacial, POA) serão permanentemente removidos.
                Versões ativas serão arquivadas.
              </div>
              <p className="text-sm text-muted-foreground">
                Isso afeta <strong>todos os datasets</strong> da plataforma. 
                Após a limpeza, será necessário reimportar os dados.
              </p>
              <div className="space-y-2">
                <Label htmlFor="confirm-reset" className="text-sm font-medium">
                  Digite <span className="font-mono font-bold text-destructive">LIMPAR</span> para confirmar:
                </Label>
                <Input
                  id="confirm-reset"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="LIMPAR"
                  className="font-mono"
                  autoComplete="off"
                  disabled={loading}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={!canConfirm}
            className="gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Limpando…
              </>
            ) : (
              "Confirmar Limpeza"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
