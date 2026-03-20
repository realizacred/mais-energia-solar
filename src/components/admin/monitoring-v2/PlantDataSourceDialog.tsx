/**
 * PlantDataSourceDialog — Modal to add a new data source (portal) to a plant.
 * §25: Modal padrão w-[90vw]. §22: Button variants.
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Radio } from "lucide-react";
import {
  useAvailableIntegrations,
  useCreatePlantDataSource,
  type CreateDataSourcePayload,
} from "@/hooks/usePlantDataSources";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantId: string;
  tenantId: string;
}

export function PlantDataSourceDialog({ open, onOpenChange, plantId, tenantId }: Props) {
  const { data: integrations = [] } = useAvailableIntegrations();
  const create = useCreatePlantDataSource();

  const [integrationId, setIntegrationId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [label, setLabel] = useState("");

  const selectedIntegration = integrations.find((i) => i.id === integrationId);

  const handleSubmit = async () => {
    if (!integrationId) {
      toast.error("Selecione uma credencial.");
      return;
    }
    const payload: CreateDataSourcePayload = {
      plant_id: plantId,
      integration_id: integrationId,
      provider_device_id: deviceId || null,
      label: label || (selectedIntegration
        ? `${selectedIntegration.provider}${deviceId ? ` - ${deviceId}` : ""}`
        : null),
      tenant_id: tenantId,
    };
    try {
      await create.mutateAsync(payload);
      toast.success("Portal adicionado com sucesso!");
      setIntegrationId("");
      setDeviceId("");
      setLabel("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar portal");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Adicionar Portal
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Escolha a credencial e o identificador do inversor
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Credencial *</Label>
              <Select value={integrationId} onValueChange={setIntegrationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a integração..." />
                </SelectTrigger>
                <SelectContent>
                  {integrations.map((int) => (
                    <SelectItem key={int.id} value={int.id}>
                      {int.provider} — {int.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Coleta de Dados (Device ID)</Label>
              <Input
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="Ex: solarz3_9976_2"
              />
              <p className="text-xs text-muted-foreground">
                Identificador do inversor/dispositivo no portal do fabricante
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Label (opcional)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Nome exibido no badge"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
