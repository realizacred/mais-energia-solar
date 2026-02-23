import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface CustomField {
  id: string;
  title: string;
  field_key: string;
  field_type: string;
  field_context: string;
  options: Json | null;
  required_on_create: boolean | null;
  show_on_create: boolean | null;
  is_active: boolean | null;
  ordem: number | null;
}

interface Props {
  values: Record<string, any>;
  onValuesChange: (values: Record<string, any>) => void;
}

export function StepCamposCustomizados({ values, onValuesChange }: Props) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("deal_custom_fields")
      .select("id, title, field_key, field_type, field_context, options, required_on_create, show_on_create, is_active, ordem")
      .eq("is_active", true)
      .order("ordem")
      .then(({ data }) => {
        // Filter fields that should show on proposal creation
        const visible = (data || []).filter(
          (f) => f.show_on_create !== false
        ) as CustomField[];
        setFields(visible);
        setLoading(false);
      });
  }, []);

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
  const isRequired = field.required_on_create === true;
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
          <Input type="date" value={value || ""} onChange={e => onChange(e.target.value)} className="h-9 text-xs" />
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
