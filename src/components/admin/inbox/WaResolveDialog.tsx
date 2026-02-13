import { useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface WaResolveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (sendSurvey: boolean) => void;
  clienteName?: string;
}

export function WaResolveDialog({
  open,
  onOpenChange,
  onConfirm,
  clienteName,
}: WaResolveDialogProps) {
  const [sendSurvey, setSendSurvey] = useState(true);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Resolver Conversa
          </AlertDialogTitle>
          <AlertDialogDescription>
            {clienteName
              ? `Deseja finalizar o atendimento de ${clienteName}?`
              : "Deseja finalizar este atendimento?"}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center justify-between rounded-lg border border-border/60 p-4 my-2">
          <div className="flex items-center gap-3">
            <Star className="h-5 w-5 text-warning" />
            <div>
              <Label htmlFor="send-survey" className="text-sm font-medium cursor-pointer">
                Enviar pesquisa de satisfação
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                O cliente receberá uma mensagem para avaliar o atendimento (1 a 5)
              </p>
            </div>
          </div>
          <Switch
            id="send-survey"
            checked={sendSurvey}
            onCheckedChange={setSendSurvey}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(sendSurvey)}
            className="bg-success hover:bg-success/90 text-success-foreground"
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Resolver
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
