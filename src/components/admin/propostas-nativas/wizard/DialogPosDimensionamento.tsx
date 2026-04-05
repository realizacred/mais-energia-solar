import { useState, useEffect, useMemo } from "react";
import { User, Building2, Zap, DollarSign, CheckCircle, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useCustomFieldsList } from "@/hooks/useCustomFieldsSettings";
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
  financialWarnings?: string[];
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
  financialWarnings = [],
  onConfirm,
  onSaveDraft, onSaveActive, saving, savedPropostaId,
}: Props) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) {
      setFields([]);
      setLoading(true);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;

    setLoading(true);
    supabase
      .from("deal_custom_fields")
      .select("id, title, field_key, field_type, options, required_on_proposal, is_active, ordem")
      .eq("is_active", true)
      .eq("field_context", "pos_dimensionamento")
      .order("ordem")
      .then(({ data }) => {
        if (!isMounted) return;
        setFields((data || []) as CustomField[]);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open]);

  const updateCustom = (key: string, value: any) => {
    onCustomFieldValuesChange({ ...customFieldValues, [key]: value });
  };

  // Check nome + all required custom fields
  const missingRequiredCustom = fields
    .filter(f => f.required_on_proposal === true)
    .some(f => {
      const val = customFieldValues[f.field_key];
      if (val === undefined || val === null || val === "") return true;
      if (Array.isArray(val) && val.length === 0) return true;
      return false;
    });

  const hasRequired = !nomeProposta.trim() || missingRequiredCustom;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">Alterar Proposta</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Revise os dados e salve a proposta</p>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-[84px] w-full rounded-lg" />
              <Skeleton className="h-px w-full" />
              <Skeleton className="h-[56px] w-full rounded-lg" />
              <Skeleton className="h-[96px] w-full rounded-lg" />
            </div>
          ) : (
            <div className="space-y-4">
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
                  <span><span className="font-medium text-foreground">Potência:</span> {(Number(potenciaKwp) || 0).toFixed(2)} kWp</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  <span><span className="font-medium text-foreground">Preço:</span> {formatBRL(precoFinal)}</span>
                </div>
              </div>

              <div className="border-t border-border" />

              {financialWarnings.length > 0 && (
                <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-warning">
                      Atenção comercial
                    </p>
                  </div>
                  <div className="space-y-2">
                    {financialWarnings.map((warning, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 rounded-md border border-warning/20 bg-background/70 p-2.5"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                        <p className="text-xs text-foreground leading-relaxed">{warning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome da Proposta <span className="text-destructive">*</span></Label>
                <Input
                  value={nomeProposta}
                  onChange={e => onNomePropostaChange(e.target.value)}
                  placeholder="Ex: Proposta Solar Residencial"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Descrição (Opcional)</Label>
                <Textarea
                  value={descricaoProposta}
                  onChange={e => onDescricaoPropostaChange(e.target.value)}
                  placeholder="Observações sobre esta proposta..."
                  className="text-sm min-h-[80px] resize-y"
                />
              </div>

              {fields.length > 0 && (
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
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 flex-wrap shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading || saving}>
            Cancelar
          </Button>
          {onSaveDraft && (
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                try {
                  await onSaveDraft();
                  onOpenChange(false);
                  onConfirm();
                } catch (err) {
                  console.error("[DialogPos] saveDraft error:", err);
                }
              }}
              disabled={loading || hasRequired || saving}
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          )}
          {onSaveActive && (
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={async () => {
                try {
                  await onSaveActive();
                  onOpenChange(false);
                  onConfirm();
                } catch (err) {
                  console.error("[DialogPos] saveActive error:", err);
                }
              }}
              disabled={loading || hasRequired || saving}
            >
              {saving ? "Salvando..." : "⭐ Salvar como Ativa"}
            </Button>
          )}
        </div>
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

    case "multi_select":
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
          <DateInput value={value || ""} onChange={onChange} className="h-9 text-xs" />
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
