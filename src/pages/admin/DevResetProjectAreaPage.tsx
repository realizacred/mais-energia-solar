import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, CheckCircle2, FolderX, ShieldAlert,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useResetProjectArea, type ProjectAreaCounts } from "@/hooks/useResetProjectArea";

export default function DevResetProjectAreaPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const mutation = useResetProjectArea();

  const handleConfirm = () => {
    setConfirmOpen(false);
    setConfirmText("");
    mutation.mutate();
  };

  const counts = mutation.data?.counts as ProjectAreaCounts | undefined;

  return (
    <div className="space-y-6">
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Reset Área de Projetos
          </CardTitle>
          <CardDescription>
            Remove <strong>todos</strong> os dados de projetos, propostas, deals, clientes,
            documentos, recebimentos e comissões do tenant atual.
            <span className="block mt-2 font-semibold text-success">
              ✅ Leads são preservados para testes futuros.
            </span>
            <span className="block mt-1 text-xs text-muted-foreground">
              Contadores (cliente_code, projeto_num, proposta_num) são zerados.
              Flags de migração SM são resetados para permitir re-migração.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="font-medium text-warning">Ação irreversível</p>
              <p className="text-muted-foreground text-xs mt-1">
                Todos os dados da área de projeto serão permanentemente removidos.
                Esta ação não pode ser desfeita. Apenas leads, configurações e dados SM ficam intactos.
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
              <><FolderX className="h-4 w-4 mr-2" /> Resetar Área de Projetos</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
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
              {([
                ["Clientes", counts.clientes],
                ["Projetos", counts.projetos],
                ["Deals", counts.deals],
                ["Propostas", counts.propostas],
                ["Versões", counts.versoes],
                ["Documentos", counts.documentos],
                ["Recebimentos", counts.recebimentos],
                ["Comissões", counts.comissoes],
                ["Checklists", counts.checklists],
                ["Agendamentos", counts.appointments],
              ] as [string, number][]).map(([label, count]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <Badge variant="outline">{count ?? 0}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={(open) => { setConfirmOpen(open); if (!open) setConfirmText(""); }}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Confirmar reset completo</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Isso apagará <strong>todos os clientes, projetos, propostas, deals, documentos,
                recebimentos e comissões</strong> deste tenant.
              </span>
              <span className="block font-semibold text-success">
                Leads serão preservados.
              </span>
              <span className="block mt-3">
                Digite <strong>RESETAR</strong> para confirmar:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESETAR"
            className="font-mono"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={confirmText !== "RESETAR"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
