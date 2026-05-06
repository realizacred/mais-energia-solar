import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, ShieldAlert, Cloud } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ResetCardProps {
  title: string;
  description: React.ReactNode;
  buttonLabel: string;
  confirmTitle: string;
  confirmKeyword: string;
  confirmDescription: React.ReactNode;
  isPending: boolean;
  counts?: Record<string, number | string>;
  onConfirm: () => void;
  icon?: React.ReactNode;
}

export function ResetActionCard({
  title, description, buttonLabel, confirmTitle, confirmKeyword,
  confirmDescription, isPending, counts, onConfirm, icon,
}: ResetCardProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const handleConfirm = () => {
    setOpen(false);
    setText("");
    onConfirm();
  };

  return (
    <div className="space-y-6">
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
            <p className="text-muted-foreground text-xs">
              Ação irreversível. Bloqueado se houver sincronização ativa.
            </p>
          </div>
          <Button
            onClick={() => setOpen(true)}
            disabled={isPending}
            variant="outline"
            className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            {isPending ? "Processando..." : <>{icon ?? <Cloud className="h-4 w-4 mr-2" />}{buttonLabel}</>}
          </Button>
        </CardContent>
      </Card>

      {counts && Object.keys(counts).length > 0 && (
        <Card className="border-success/30 bg-success/5">
          <CardHeader>
            <CardTitle className="text-base text-success flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Reset concluído
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

      <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setText(""); }}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {confirmDescription}
              <span className="block mt-3">
                Digite <strong>{confirmKeyword}</strong> para confirmar:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={confirmKeyword}
            className="font-mono"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={text !== confirmKeyword}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
