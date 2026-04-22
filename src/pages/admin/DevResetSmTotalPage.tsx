import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, ShieldAlert, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useResetTenantData } from "@/hooks/useResetTenantData";

/**
 * DEV: Reset TOTAL SolarMarket — apaga staging (sm_*) + dados canônicos
 * promovidos. Útil para repetir testes de importação + promoção do zero.
 */
export default function DevResetSmTotalPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const mutation = useResetTenantData();

  const handleConfirm = () => {
    setConfirmOpen(false);
    setConfirmText("");
    mutation.mutate();
  };

  const counts = mutation.data?.counts;

  return (
    <div className="space-y-6">
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Reset Total SolarMarket (Staging + Canônico)
          </CardTitle>
          <CardDescription>
            Remove <strong>tudo</strong> que foi importado do SolarMarket: staging
            (<code>sm_*</code>, clientes/projetos/propostas raw, funis, campos custom)
            e os registros canônicos criados pela promoção (clientes, projetos,
            propostas nativas, versões, deals, recebimentos com origem
            <code> solar_market</code>).
            <span className="block mt-2 text-xs text-muted-foreground">
              Ideal para reiniciar o ciclo Importação → Promoção do zero em ambiente DEV.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="font-medium text-warning">Ação irreversível</p>
              <p className="text-muted-foreground text-xs mt-1">
                Bloqueado se houver sincronização ou promoção SM em andamento.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={mutation.isPending}
            variant="outline"
            className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            {mutation.isPending ? (
              <>Resetando...</>
            ) : (
              <><Trash2 className="h-4 w-4 mr-2" /> Resetar Tudo (Staging + Canônico)</>
            )}
          </Button>
        </CardContent>
      </Card>

      {counts && (
        <Card className="border-success/30 bg-success/5">
          <CardHeader>
            <CardTitle className="text-base text-success flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Reset concluído
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {Object.entries(counts).map(([label, count]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <Badge variant="outline">{Number(count) || 0}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(open) => { setConfirmOpen(open); if (!open) setConfirmText(""); }}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Confirmar reset total SM</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Isso apagará <strong>todo o staging SolarMarket</strong> e <strong>todos os
                registros canônicos</strong> criados pela promoção.
              </span>
              <span className="block mt-3">
                Digite <strong>APAGAR TUDO</strong> para confirmar:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="APAGAR TUDO"
            className="font-mono"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={confirmText !== "APAGAR TUDO"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Reset Total
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
