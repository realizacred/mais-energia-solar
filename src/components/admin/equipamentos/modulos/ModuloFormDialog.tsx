import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Modulo } from "./types";
import { CELL_TYPES, TENSAO_SISTEMAS } from "./types";

interface Props {
  modulo: Modulo | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (id: string | undefined, payload: Record<string, unknown>) => void;
  isPending: boolean;
}

interface FormData {
  fabricante: string;
  modelo: string;
  potencia_wp: string;
  tipo_celula: string;
  num_celulas: string;
  tensao_sistema: string;
  eficiencia_percent: string;
  comprimento_mm: string;
  largura_mm: string;
  profundidade_mm: string;
  peso_kg: string;
  bifacial: boolean;
  garantia_produto_anos: string;
  garantia_performance_anos: string;
  vmp_v: string;
  imp_a: string;
  voc_v: string;
  isc_a: string;
  temp_coeff_pmax: string;
  temp_coeff_voc: string;
  temp_coeff_isc: string;
  status: string;
}

const EMPTY: FormData = {
  fabricante: "", modelo: "", potencia_wp: "", tipo_celula: "Mono PERC",
  num_celulas: "", tensao_sistema: "1500V", eficiencia_percent: "",
  comprimento_mm: "", largura_mm: "", profundidade_mm: "",
  peso_kg: "", bifacial: false,
  garantia_produto_anos: "12", garantia_performance_anos: "25",
  vmp_v: "", imp_a: "", voc_v: "", isc_a: "",
  temp_coeff_pmax: "", temp_coeff_voc: "", temp_coeff_isc: "",
  status: "rascunho",
};

interface ValidationError { field: string; message: string; type: "error" | "warning" }

function validate(f: FormData): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!f.fabricante.trim()) errs.push({ field: "fabricante", message: "Obrigatório", type: "error" });
  if (!f.modelo.trim()) errs.push({ field: "modelo", message: "Obrigatório", type: "error" });

  const pot = parseInt(f.potencia_wp);
  if (!f.potencia_wp || isNaN(pot)) errs.push({ field: "potencia_wp", message: "Obrigatório", type: "error" });
  else if (pot < 100 || pot > 900) errs.push({ field: "potencia_wp", message: "Faixa: 100–900 Wp", type: "error" });

  const eff = parseFloat(f.eficiencia_percent);
  if (f.eficiencia_percent && !isNaN(eff)) {
    if (eff < 10 || eff > 30) errs.push({ field: "eficiencia_percent", message: "Faixa: 10–30%", type: "error" });
    else if (eff > 25) errs.push({ field: "eficiencia_percent", message: "Eficiência alta — verifique", type: "warning" });
  }

  const peso = parseFloat(f.peso_kg);
  if (f.peso_kg && !isNaN(peso) && peso < 0) errs.push({ field: "peso_kg", message: "Não pode ser negativo", type: "error" });

  const comp = parseInt(f.comprimento_mm);
  if (f.comprimento_mm && !isNaN(comp) && (comp < 1000 || comp > 2600))
    errs.push({ field: "comprimento_mm", message: "Faixa: 1000–2600 mm", type: "warning" });

  const larg = parseInt(f.largura_mm);
  if (f.largura_mm && !isNaN(larg) && (larg < 600 || larg > 1400))
    errs.push({ field: "largura_mm", message: "Faixa: 600–1400 mm", type: "warning" });

  return errs;
}

function fromModulo(m: Modulo): FormData {
  return {
    fabricante: m.fabricante, modelo: m.modelo,
    potencia_wp: String(m.potencia_wp),
    tipo_celula: m.tipo_celula || "Mono PERC",
    num_celulas: m.num_celulas ? String(m.num_celulas) : "",
    tensao_sistema: m.tensao_sistema || "1500V",
    eficiencia_percent: m.eficiencia_percent ? String(m.eficiencia_percent) : "",
    comprimento_mm: m.comprimento_mm ? String(m.comprimento_mm) : "",
    largura_mm: m.largura_mm ? String(m.largura_mm) : "",
    profundidade_mm: m.profundidade_mm ? String(m.profundidade_mm) : "",
    peso_kg: m.peso_kg ? String(m.peso_kg) : "",
    bifacial: m.bifacial,
    garantia_produto_anos: m.garantia_produto_anos ? String(m.garantia_produto_anos) : "12",
    garantia_performance_anos: m.garantia_performance_anos ? String(m.garantia_performance_anos) : "25",
    vmp_v: m.vmp_v ? String(m.vmp_v) : "",
    imp_a: m.imp_a ? String(m.imp_a) : "",
    voc_v: m.voc_v ? String(m.voc_v) : "",
    isc_a: m.isc_a ? String(m.isc_a) : "",
    temp_coeff_pmax: m.temp_coeff_pmax ? String(m.temp_coeff_pmax) : "",
    temp_coeff_voc: m.temp_coeff_voc ? String(m.temp_coeff_voc) : "",
    temp_coeff_isc: m.temp_coeff_isc ? String(m.temp_coeff_isc) : "",
    status: m.status || "rascunho",
  };
}

function SectionCollapsible({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-semibold text-foreground hover:text-primary transition-colors">
        {title}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ModuloFormDialog({ modulo, open, onOpenChange, onSave, isPending }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<ValidationError[]>([]);

  useEffect(() => {
    if (open) {
      setForm(modulo ? fromModulo(modulo) : EMPTY);
      setErrors([]);
    }
  }, [open, modulo]);

  const set = useCallback((key: keyof FormData, val: string | boolean) =>
    setForm(p => ({ ...p, [key]: val })), []);

  const fieldError = (field: string) => errors.find(e => e.field === field);

  const handleSave = () => {
    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (validationErrors.some(e => e.type === "error")) {
      toast({ title: "Corrija os erros antes de salvar", variant: "destructive" });
      return;
    }
    const num = (v: string) => v ? parseFloat(v) : null;
    const int = (v: string) => v ? parseInt(v) : null;
    onSave(modulo?.id, {
      fabricante: form.fabricante.trim(),
      modelo: form.modelo.trim(),
      potencia_wp: parseInt(form.potencia_wp),
      tipo_celula: form.tipo_celula,
      num_celulas: int(form.num_celulas),
      tensao_sistema: form.tensao_sistema,
      eficiencia_percent: num(form.eficiencia_percent),
      comprimento_mm: int(form.comprimento_mm),
      largura_mm: int(form.largura_mm),
      profundidade_mm: int(form.profundidade_mm),
      peso_kg: num(form.peso_kg),
      bifacial: form.bifacial,
      garantia_produto_anos: int(form.garantia_produto_anos),
      garantia_performance_anos: int(form.garantia_performance_anos),
      vmp_v: num(form.vmp_v),
      imp_a: num(form.imp_a),
      voc_v: num(form.voc_v),
      isc_a: num(form.isc_a),
      temp_coeff_pmax: num(form.temp_coeff_pmax),
      temp_coeff_voc: num(form.temp_coeff_voc),
      temp_coeff_isc: num(form.temp_coeff_isc),
      status: form.status,
    });
  };

  function FieldInput({ label, field, type = "text", step, placeholder, unit }: {
    label: string; field: keyof FormData; type?: string; step?: string; placeholder?: string; unit?: string;
  }) {
    const err = fieldError(field);
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}{unit ? ` (${unit})` : ""}</Label>
        <Input
          type={type} step={step} placeholder={placeholder}
          value={form[field] as string}
          onChange={e => set(field, e.target.value)}
          className={err?.type === "error" ? "border-destructive" : err?.type === "warning" ? "border-yellow-500" : ""}
        />
        {err && (
          <p className={`text-xs flex items-center gap-1 ${err.type === "error" ? "text-destructive" : "text-yellow-600"}`}>
            <AlertTriangle className="w-3 h-3" /> {err.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modulo ? "Editar Módulo" : "Novo Módulo Fotovoltaico"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 divide-y">
          <SectionCollapsible title="📋 Identificação" defaultOpen>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <FieldInput label="Fabricante" field="fabricante" placeholder="Ex: Canadian Solar" />
              </div>
              <div className="sm:col-span-2">
                <FieldInput label="Modelo" field="modelo" placeholder="Ex: CS7N-665MS" />
              </div>
              <FieldInput label="Potência" field="potencia_wp" type="number" placeholder="665" unit="Wp" />
              <div className="space-y-1">
                <Label className="text-xs">Tipo Célula</Label>
                <Select value={form.tipo_celula} onValueChange={v => set("tipo_celula", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CELL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <FieldInput label="Nº de células" field="num_celulas" type="number" placeholder="144" />
              <div className="space-y-1">
                <Label className="text-xs">Tensão do sistema</Label>
                <Select value={form.tensao_sistema} onValueChange={v => set("tensao_sistema", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TENSAO_SISTEMAS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Switch checked={form.bifacial} onCheckedChange={v => set("bifacial", v)} />
                <Label className="text-xs">Módulo Bifacial</Label>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="revisao">Revisão</SelectItem>
                    <SelectItem value="publicado">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCollapsible>

          <SectionCollapsible title="⚡ Elétrico (STC)">
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="Vmp" field="vmp_v" type="number" step="0.01" unit="V" />
              <FieldInput label="Imp" field="imp_a" type="number" step="0.01" unit="A" />
              <FieldInput label="Voc" field="voc_v" type="number" step="0.01" unit="V" />
              <FieldInput label="Isc" field="isc_a" type="number" step="0.01" unit="A" />
            </div>
          </SectionCollapsible>

          <SectionCollapsible title="📐 Dimensões & Construção">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FieldInput label="Comprimento" field="comprimento_mm" type="number" placeholder="2384" unit="mm" />
              <FieldInput label="Largura" field="largura_mm" type="number" placeholder="1303" unit="mm" />
              <FieldInput label="Profundidade" field="profundidade_mm" type="number" placeholder="35" unit="mm" />
              <FieldInput label="Peso" field="peso_kg" type="number" step="0.1" placeholder="37.0" unit="kg" />
              <FieldInput label="Eficiência" field="eficiencia_percent" type="number" step="0.01" placeholder="22.50" unit="%" />
            </div>
          </SectionCollapsible>

          <SectionCollapsible title="🌡️ Temperatura" defaultOpen={false}>
            <div className="grid grid-cols-3 gap-3">
              <FieldInput label="Coeff Pmax" field="temp_coeff_pmax" type="number" step="0.001" unit="%/°C" />
              <FieldInput label="Coeff Voc" field="temp_coeff_voc" type="number" step="0.001" unit="%/°C" />
              <FieldInput label="Coeff Isc" field="temp_coeff_isc" type="number" step="0.001" unit="%/°C" />
            </div>
          </SectionCollapsible>

          <SectionCollapsible title="🛡️ Garantia" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="Garantia Produto" field="garantia_produto_anos" type="number" unit="anos" />
              <FieldInput label="Garantia Performance" field="garantia_performance_anos" type="number" unit="anos" />
            </div>
          </SectionCollapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
