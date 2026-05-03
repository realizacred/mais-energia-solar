import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useCustomFieldsList } from "@/hooks/useCustomFieldsSettings";
import type { Json } from "@/integrations/supabase/types";

interface CustomField {
  id: string;
  title: string;
  field_key: string;
  field_type: string;
  field_context: string;
  options: Json | null;
  required_on_create: boolean | null;
  required_on_proposal?: boolean | null;
  show_on_create: boolean | null;
  is_active: boolean | null;
  ordem: number | null;
}

interface Props {
  values: Record<string, any>;
  onValuesChange: (values: Record<string, any>) => void;
}

/**
 * StepCamposCustomizados — usa useCustomFieldsList (hook centralizado)
 * para reagir em tempo real a mudanças de tipo/configuração feitas em admin/custom-fields.
 * §16: Queries só em hooks — NUNCA em componentes (RB-04)
 */
export function StepCamposCustomizados({ values, onValuesChange }: Props) {
  const { data: allFields, isLoading: loading } = useCustomFieldsList();

  const fields = useMemo(() =>
    (allFields ?? [])
      .filter((f: any) => f.is_active && f.field_context === "pre_dimensionamento")
      .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0)) as CustomField[],
    [allFields]
  );

  const updateValue = (key: string, value: any) => {
    onValuesChange({ ...values, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Carregando campos...</span>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="border rounded-xl p-8 text-center text-sm text-muted-foreground">
        Nenhum campo customizado configurado. Configure em Configurações → Opções Customizáveis.
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {fields.map((field) => (
          <CustomFieldInput
            key={field.id}
            field={field}
            value={values[field.field_key]}
            onChange={(val) => updateValue(field.field_key, val)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Dynamic Field Renderer ───────────────────────────────
function CustomFieldInput({ field, value, onChange }: {
  field: CustomField;
  value: any;
  onChange: (val: any) => void;
}) {
  const isRequired = field.required_on_proposal === true || field.required_on_create === true;
  const label = `${field.title}${isRequired ? " *" : ""}`;

  switch (field.field_type) {
    case "select": {
      const options = Array.isArray(field.options) ? field.options as string[] : [];
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{label}</Label>
          <Select value={value || ""} onValueChange={onChange}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
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
          <Label className="text-xs">{label}</Label>
          <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[36px]">
            {options.map((opt) => {
              const isSelected = selected.includes(String(opt));
              return (
                <Badge
                  key={String(opt)}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer text-[10px]"
                  onClick={() => {
                    if (isSelected) {
                      onChange(selected.filter(s => s !== String(opt)));
                    } else {
                      onChange([...selected, String(opt)]);
                    }
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
          <Label className="text-xs">{label}</Label>
          <Switch checked={!!value} onCheckedChange={onChange} />
        </div>
      );

    case "currency":
    case "monetary":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{label}</Label>
          <CurrencyInput value={value || 0} onChange={onChange} className="h-9 text-xs" />
        </div>
      );

    case "percent":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{label}</Label>
          <div className="relative">
            <Input
              type="number"
              step="0.01"
              min={0}
              max={100}
              value={value ?? ""}
              onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
              className="h-9 text-xs pr-7"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
          </div>
        </div>
      );

    case "number":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{label}</Label>
          <Input type="number" value={value || ""} onChange={e => onChange(Number(e.target.value))} className="h-9 text-xs" />
        </div>
      );

    case "date":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{label}</Label>
          <DateInput value={value || ""} onChange={onChange} className="h-9 text-xs" />
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-1.5 col-span-full">
          <Label className="text-xs">{label}</Label>
          <Textarea value={value || ""} onChange={e => onChange(e.target.value)} className="text-xs min-h-[60px]" />
        </div>
      );

    default: // text
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{label}</Label>
          <Input value={value || ""} onChange={e => onChange(e.target.value)} className="h-9 text-xs" />
        </div>
      );
  }
}
