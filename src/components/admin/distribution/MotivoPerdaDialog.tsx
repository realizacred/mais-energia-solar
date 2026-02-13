import { useState } from "react";
import { XCircle } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useMotivosPerda, useRecordLoss } from "@/hooks/useDistribution";

interface MotivoPerdaDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  leadNome: string;
  /** The status_id for "Perdido" */
  perdidoStatusId: string;
  onSuccess?: () => void;
}

export function MotivoPerdaDialog({
  open,
  onOpenChange,
  leadId,
  leadNome,
  perdidoStatusId,
  onSuccess,
}: MotivoPerdaDialogProps) {
  const { motivos, loading: loadingMotivos } = useMotivosPerda();
  const recordLoss = useRecordLoss();
  const [selectedMotivo, setSelectedMotivo] = useState("");
  const [obs, setObs] = useState("");

  const handleSubmit = async () => {
    if (!selectedMotivo) return;
    await recordLoss.mutateAsync({
      leadId,
      motivoPerdaId: selectedMotivo,
      motivoPerdaObs: obs.trim() || undefined,
      statusId: perdidoStatusId,
    });
    setSelectedMotivo("");
    setObs("");
    onOpenChange(false);
    onSuccess?.();
  };

  const activeMotivos = motivos.filter((m) => m.ativo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Registrar Perda
          </DialogTitle>
          <DialogDescription>
            Informe o motivo da perda de <strong>{leadNome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Motivo de Perda *</Label>
            {loadingMotivos ? (
              <div className="flex items-center gap-2 py-2">
                <Spinner size="sm" />
                <span className="text-sm text-muted-foreground">Carregando motivos...</span>
              </div>
            ) : activeMotivos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Nenhum motivo cadastrado. Configure em Cadastros → Status de Leads.
              </p>
            ) : (
              <Select value={selectedMotivo} onValueChange={setSelectedMotivo}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {activeMotivos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label>Observações (opcional)</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
              placeholder="Detalhes adicionais sobre a perda..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!selectedMotivo || recordLoss.isPending}
          >
            {recordLoss.isPending && <Spinner size="sm" className="mr-2" />}
            Registrar Perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
