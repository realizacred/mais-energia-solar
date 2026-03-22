/**
 * AddCreditDialog — Modal to manually add GD credits to a UC.
 * Uses FormModalTemplate (§25 canonical).
 */
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateUnitCredit, useUcLinkedPlants, type CreateCreditPayload } from "@/hooks/useUnitCredits";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  tenantId: string;
}

const POSTOS_TARIFARIOS = [
  { value: "fora_ponta", label: "Fora Ponta" },
  { value: "ponta", label: "Ponta" },
  { value: "intermediario", label: "Intermediário" },
];

const MESES = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

function getYearOptions() {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) {
    years.push(String(y));
  }
  return years;
}

export function AddCreditDialog({ open, onOpenChange, unitId, tenantId }: Props) {
  const { toast } = useToast();
  const createCredit = useCreateUnitCredit();
  const { data: linkedPlants } = useUcLinkedPlants(unitId, open);

  const now = new Date();
  const [quantidade, setQuantidade] = useState("");
  const [mesVigencia, setMesVigencia] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [anoVigencia, setAnoVigencia] = useState(String(now.getFullYear()));
  const [postoTarifario, setPostoTarifario] = useState("fora_ponta");
  const [plantId, setPlantId] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (open) {
      const n = new Date();
      setQuantidade("");
      setMesVigencia(String(n.getMonth() + 1).padStart(2, "0"));
      setAnoVigencia(String(n.getFullYear()));
      setPostoTarifario("fora_ponta");
      setPlantId(null);
      setObservacoes("");
    }
  }, [open]);

  const handleSave = async () => {
    const qty = parseFloat(quantidade);
    if (!qty || qty <= 0) {
      toast({ title: "Quantidade inválida", description: "Informe um valor em kWh maior que zero.", variant: "destructive" });
      return;
    }

    const payload: CreateCreditPayload = {
      unit_id: unitId,
      tenant_id: tenantId,
      plant_id: plantId,
      quantidade_kwh: qty,
      data_vigencia: `${anoVigencia}-${mesVigencia}-01`,
      posto_tarifario: postoTarifario,
      observacoes: observacoes.trim() || null,
    };

    try {
      await createCredit.mutateAsync(payload);
      toast({ title: "Crédito adicionado com sucesso" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao adicionar crédito", description: err.message, variant: "destructive" });
    }
  };

  return (
    <FormModalTemplate
      open={open}
      onOpenChange={onOpenChange}
      title="Adicionar Crédito"
      subtitle="Adicione créditos GD manualmente à unidade consumidora"
      icon={Zap}
      onSubmit={handleSave}
      submitLabel={createCredit.isPending ? "Salvando..." : "Salvar"}
      disabled={createCredit.isPending}
      saving={createCredit.isPending}
      className="w-[90vw] max-w-md"
    >
      {/* Quantidade */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">
          Quantidade (kWh) <span className="text-destructive">*</span>
        </Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="Ex: 300"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
        />
      </div>

      {/* Data de vigência (Mês + Ano) */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">
          Data de vigência <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Select value={mesVigencia} onValueChange={setMesVigencia}>
            <SelectTrigger>
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={anoVigencia} onValueChange={setAnoVigencia}>
            <SelectTrigger>
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {getYearOptions().map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Posto tarifário */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">
          Posto tarifário <span className="text-destructive">*</span>
        </Label>
        <Select value={postoTarifario} onValueChange={setPostoTarifario}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POSTOS_TARIFARIOS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Usina de origem */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Usina de origem</Label>
        <Select value={plantId ?? "__none__"} onValueChange={(v) => setPlantId(v === "__none__" ? null : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Nenhuma</SelectItem>
            {linkedPlants?.map((plant) => (
              <SelectItem key={plant.id} value={plant.id}>
                {plant.name || plant.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Observações */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Observações (opcional)</Label>
        <Textarea
          placeholder="Ex: crédito de mês anterior"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
        />
      </div>
    </FormModalTemplate>
  );
}
