import { useMemo } from "react";
import { Building, Zap, Receipt, ShieldCheck, Info, Calculator } from "lucide-react";
import { getFioBCobranca } from "@/lib/calcGrupoB";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormModalTemplate, FormSection, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const ESTADOS_BRASIL = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
];

export interface ConcessionariaFormData {
  nome: string;
  sigla: string;
  estado: string;
  tarifa_energia: string;
  tarifa_fio_b: string;
  tarifa_fio_b_gd: string;
  custo_disponibilidade_monofasico: string;
  custo_disponibilidade_bifasico: string;
  custo_disponibilidade_trifasico: string;
  aliquota_icms: string;
  pis_percentual: string;
  cofins_percentual: string;
  possui_isencao_scee: boolean | null;
  percentual_isencao: string;
}

function calcTarifaIntegral(te: number, fioB: number, icms: number, pis: number, cofins: number) {
  const sem = te + fioB;
  if (sem <= 0) return null;
  const totalTributo = (icms + pis + cofins) / 100;
  return totalTributo > 0 && totalTributo < 1 ? sem / (1 - totalTributo) : sem;
}

/* SectionCard removed — using FormSection from FormModalTemplate */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ConcessionariaFormData;
  onUpdateForm: (field: keyof ConcessionariaFormData, value: any) => void;
  onSave: () => void;
  isEditing: boolean;
}

export function ConcessionariaFormDialog({
  open,
  onOpenChange,
  form,
  onUpdateForm,
  onSave,
  isEditing,
}: Props) {
  const currentYear = new Date().getFullYear();
  const fioBCobranca = getFioBCobranca(currentYear);

  const integralInfo = useMemo(() => {
    const te = parseFloat(form.tarifa_energia) || 0;
    const fioB = parseFloat(form.tarifa_fio_b) || 0;
    const icms = parseFloat(form.aliquota_icms) || 0;
    const pis = parseFloat(form.pis_percentual) || 0;
    const cofins = parseFloat(form.cofins_percentual) || 0;
    const integral = calcTarifaIntegral(te, fioB, icms, pis, cofins);
    return { te, fioB, icms, pis, cofins, integral, sem: te + fioB };
  }, [form.tarifa_energia, form.tarifa_fio_b, form.aliquota_icms, form.pis_percentual, form.cofins_percentual]);

  const fioBVigente = useMemo(() => {
    const fioB = parseFloat(form.tarifa_fio_b) || 0;
    const override = parseFloat(form.tarifa_fio_b_gd);
    if (override > 0) return { value: override, source: "manual" as const };
    if (fioB > 0 && fioBCobranca !== null) {
      return { value: Math.round(fioB * fioBCobranca * 1000000) / 1000000, source: "lei14300" as const };
    }
    return { value: 0, source: "none" as const };
  }, [form.tarifa_fio_b, form.tarifa_fio_b_gd, fioBCobranca]);

  return (
    <FormModalTemplate
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Concessionária" : "Nova Concessionária"}
      onSubmit={onSave}
      submitLabel={isEditing ? "Salvar alterações" : "Cadastrar"}
      className="max-w-3xl"
    >
          {/* Identificação */}
          <FormSection title="Identificação">
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-xs font-medium">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome"
                placeholder="Ex: Light Serviços de Eletricidade"
                value={form.nome}
                onChange={(e) => onUpdateForm("nome", e.target.value)}
              />
            </div>
            <FormGrid>
              <div className="space-y-2">
                <Label htmlFor="sigla" className="text-xs font-medium">Sigla</Label>
                <Input
                  id="sigla"
                  placeholder="Ex: LIGHT"
                  value={form.sigla}
                  onChange={(e) => onUpdateForm("sigla", e.target.value)}
                  className="font-mono uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado" className="text-xs font-medium">Estado</Label>
                <Select value={form.estado} onValueChange={(v) => onUpdateForm("estado", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BRASIL.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormGrid>
          </FormSection>

          {/* Tarifas */}
          <FormSection title="Tarifas BT (R$/kWh)">
            <p className="text-xs text-muted-foreground -mt-1">Valores sem impostos — Grupo B (Baixa Tensão)</p>
            <FormGrid cols={3}>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tarifa Energia (TE)</Label>
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="0.4500"
                  value={form.tarifa_energia}
                  onChange={(e) => onUpdateForm("tarifa_energia", e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fio B Total (TUSD)</Label>
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="0.4000"
                  value={form.tarifa_fio_b}
                  onChange={(e) => onUpdateForm("tarifa_fio_b", e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 cursor-help">
                      Fio B GD
                      <Info className="w-3 h-3" />
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[220px]">
                    Override manual. Deixe vazio para usar o valor calculado pela Lei 14.300.
                  </TooltipContent>
                </Tooltip>
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="Auto"
                  value={form.tarifa_fio_b_gd}
                  onChange={(e) => onUpdateForm("tarifa_fio_b_gd", e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </FormGrid>

            {fioBVigente.value > 0 && (
              <div className="rounded-lg bg-warning/5 border border-warning/20 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-warning" />
                    Fio B Vigente GD ({currentYear})
                  </span>
                  <span className="text-base font-mono font-bold text-warning">
                    R$ {fioBVigente.value.toFixed(6)}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {fioBVigente.source === "lei14300" ? (
                    <>Lei 14.300 — {((fioBCobranca ?? 0) * 100).toFixed(0)}% cobrado do Fio B total ({integralInfo.fioB.toFixed(6)} × {((fioBCobranca ?? 0) * 100).toFixed(0)}%)</>
                  ) : (
                    <>Override manual — valor definido no campo "Fio B GD"</>
                  )}
                </div>
              </div>
            )}
          </FormSection>

          {/* Custo de Disponibilidade */}
          <FormSection title="Custo de Disponibilidade (R$)">
            <p className="text-xs text-muted-foreground -mt-1">Valor mínimo cobrado por tipo de ligação</p>
            <FormGrid cols={3}>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Monofásico</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="30.00"
                  value={form.custo_disponibilidade_monofasico}
                  onChange={(e) => onUpdateForm("custo_disponibilidade_monofasico", e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Bifásico</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="50.00"
                  value={form.custo_disponibilidade_bifasico}
                  onChange={(e) => onUpdateForm("custo_disponibilidade_bifasico", e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Trifásico</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="100.00"
                  value={form.custo_disponibilidade_trifasico}
                  onChange={(e) => onUpdateForm("custo_disponibilidade_trifasico", e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </FormGrid>
          </FormSection>

          {/* Tributação */}
          <FormSection title="Tributação">
            <p className="text-xs text-muted-foreground -mt-1">Deixe vazio para usar o padrão do estado. PIS/COFINS são necessários para o valor integral.</p>
            <FormGrid cols={3}>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">ICMS (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={40}
                  placeholder="18.00"
                  value={form.aliquota_icms}
                  onChange={(e) => onUpdateForm("aliquota_icms", e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">PIS (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={10}
                  placeholder="1.65"
                  value={form.pis_percentual}
                  onChange={(e) => onUpdateForm("pis_percentual", e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">COFINS (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={15}
                  placeholder="7.60"
                  value={form.cofins_percentual}
                  onChange={(e) => onUpdateForm("cofins_percentual", e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </FormGrid>

            {/* Isenção SCEE */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">% Isenção SCEE</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Usar do estado"
                  value={form.percentual_isencao}
                  onChange={(e) => onUpdateForm("percentual_isencao", e.target.value)}
                  disabled={form.possui_isencao_scee === false}
                  className="h-8 w-28 font-mono text-sm text-right"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Isenção SCEE:</Label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant={form.possui_isencao_scee === null ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs px-3"
                    onClick={() => onUpdateForm("possui_isencao_scee", null)}
                  >
                    Padrão UF
                  </Button>
                  <Button
                    type="button"
                    variant={form.possui_isencao_scee === true ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs px-3"
                    onClick={() => onUpdateForm("possui_isencao_scee", true)}
                  >
                    Sim
                  </Button>
                  <Button
                    type="button"
                    variant={form.possui_isencao_scee === false ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs px-3"
                    onClick={() => onUpdateForm("possui_isencao_scee", false)}
                  >
                    Não
                  </Button>
                </div>
              </div>
            </div>
          </FormSection>

          {/* Resultado computado */}
          {integralInfo.integral ? (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Valor integral c/ impostos</span>
                <span className="text-xl font-mono font-bold text-primary">
                  R$ {integralInfo.integral.toFixed(6)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-mono text-muted-foreground border-t border-primary/10 pt-3">
                <div>TE: R$ {integralInfo.te.toFixed(6)}</div>
                <div>Fio B: R$ {integralInfo.fioB.toFixed(6)}</div>
                <div>Sem imp: R$ {integralInfo.sem.toFixed(6)}</div>
                <div>Tributos: {(integralInfo.icms + integralInfo.pis + integralInfo.cofins).toFixed(2)}%</div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 flex items-center justify-center text-xs text-muted-foreground">
              Preencha TE, Fio B e tributos para calcular o valor integral
            </div>
          )}
    </FormModalTemplate>
  );
}
