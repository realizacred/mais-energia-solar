import { useState, useEffect } from "react";
import { User, Building2, Zap, DollarSign, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { formatBRL } from "./types";

// ─── Types ────────────────────────────────────────────────

interface CustomField {
  id: string;
  title: string;
  field_key: string;
  field_type: string;
  options: Json | null;
  required_on_proposal: boolean | null;
  is_active: boolean | null;
  ordem: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteNome: string;
  empresaNome: string;
  potenciaKwp: number;
  precoFinal: number;
  nomeProposta: string;
  onNomePropostaChange: (v: string) => void;
  descricaoProposta: string;
  onDescricaoPropostaChange: (v: string) => void;
  customFieldValues: Record<string, any>;
  onCustomFieldValuesChange: (v: Record<string, any>) => void;
  onConfirm: () => void;
  /** Save actions */
  onSaveDraft?: () => void;
  onSaveActive?: () => void;
  saving?: boolean;
  savedPropostaId?: string | null;
}

export function DialogPosDimensionamento({
  open, onOpenChange,
  clienteNome, empresaNome, potenciaKwp, precoFinal,
  nomeProposta, onNomePropostaChange,
  descricaoProposta, onDescricaoPropostaChange,
  customFieldValues, onCustomFieldValuesChange,
  onConfirm,
  onSaveDraft, onSaveActive, saving, savedPropostaId,
}: Props) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("deal_custom_fields")
      .select("id, title, field_key, field_type, options, required_on_proposal, is_active, ordem")
      .eq("is_active", true)
      .eq("field_context", "pos_dimensionamento")
      .order("ordem")
      .then(({ data }) => {
        setFields((data || []) as CustomField[]);
        setLoading(false);
      });
  }, [open]);

  const updateCustom = (key: string, value: any) => {
    onCustomFieldValuesChange({ ...customFieldValues, [key]: value });
  };

  const hasRequired = !nomeProposta.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Alterar Proposta</DialogTitle>
        </DialogHeader>

        {/* ── Summary */}
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-primary" />
            <span><span className="font-medium text-foreground">Cliente:</span> {clienteNome || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span><span className="font-medium text-foreground">Empresa:</span> {empresaNome || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span><span className="font-medium text-foreground">Potência:</span> {potenciaKwp.toFixed(2)} kWp</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            <span><span className="font-medium text-foreground">Preço:</span> {formatBRL(precoFinal)}</span>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* ── Nome da Proposta */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nome da Proposta <span className="text-destructive">*</span></Label>
          <Input
            value={nomeProposta}
            onChange={e => onNomePropostaChange(e.target.value)}
            placeholder="Ex: Proposta Solar Residencial"
            className="h-9 text-sm"
          />
        </div>

        {/* ── Descrição */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Descrição (Opcional)</Label>
          <Textarea
            value={descricaoProposta}
            onChange={e => onDescricaoPropostaChange(e.target.value)}
            placeholder="Observações sobre esta proposta..."
            className="text-sm min-h-[80px] resize-y"
          />
        </div>

        {/* ── Custom Fields (pos_dimensionamento) */}
        {loading ? (
          <div className="flex items-center justify-center py-4 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Carregando campos...</span>
          </div>
        ) : fields.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-bold">Campos Customizados</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fields.map(field => (
                <PosCustomFieldInput
                  key={field.id}
                  field={field}
                  value={customFieldValues[field.field_key]}
                  onChange={(val) => updateCustom(field.field_key, val)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 pt-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          {onSaveDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await onSaveDraft();
                  onOpenChange(false);
                } catch (err) {
                  console.error("[DialogPos] saveDraft error:", err);
                }
              }}
              disabled={saving}
            >
              {saving ? "Salvando..." : savedPropostaId ? "Atualizar Rascunho" : "Salvar Rascunho"}
            </Button>
          )}
          {onSaveActive && (
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  await onSaveActive();
                  onOpenChange(false);
                } catch (err) {
                  console.error("[DialogPos] saveActive error:", err);
                }
              }}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar como ativa"}
            </Button>
          )}
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={hasRequired || saving}
          >
            Prosseguir para Proposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Custom Field Renderer (pos_dimensionamento) ──────────

function PosCustomFieldInput({ field, value, onChange }: {
  field: CustomField;
  value: any;
  onChange: (val: any) => void;
}) {
  const isRequired = field.required_on_proposal === true;
  const label = `${field.title}${isRequired ? " *" : ""}`;

  switch (field.field_type) {
    case "select": {
      const options = Array.isArray(field.options) ? field.options as string[] : [];
      return (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Select value={value || ""} onValueChange={onChange}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    case "multiselect": {
      const options = Array.isArray(field.options) ? field.options as string[] : [];
      const selected: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-[36px]">
            {options.map(opt => {
              const isSelected = selected.includes(String(opt));
              return (
                <Badge
                  key={String(opt)}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer text-[10px]"
                  onClick={() => {
                    if (isSelected) onChange(selected.filter(s => s !== String(opt)));
                    else onChange([...selected, String(opt)]);
                  }}
                >
                  {String(opt)}
                </Badge>
              );
            })}
          </div>
        </div>
      );
    }

    case "boolean":
      return (
        <div className="flex items-center justify-between gap-2 py-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Switch checked={!!value} onCheckedChange={onChange} />
        </div>
      );

    case "number":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Input type="number" value={value ?? ""} onChange={e => onChange(Number(e.target.value))} className="h-9 text-xs" />
        </div>
      );

    case "date":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Input type="date" value={value || ""} onChange={e => onChange(e.target.value)} className="h-9 text-xs" />
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-1.5 col-span-full">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Textarea value={value || ""} onChange={e => onChange(e.target.value)} className="text-xs min-h-[60px]" />
        </div>
      );

    default: // text
      return (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Input value={value || ""} onChange={e => onChange(e.target.value)} className="h-9 text-xs" placeholder="Texto" />
        </div>
      );
  }
}
