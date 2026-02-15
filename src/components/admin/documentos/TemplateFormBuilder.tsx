import { useState } from "react";
import { Plus, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { FormFieldSchema } from "./types";

interface Props {
  fields: FormFieldSchema[];
  onChange: (fields: FormFieldSchema[]) => void;
}

const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "currency", label: "Moeda" },
  { value: "select", label: "Seleção" },
  { value: "textarea", label: "Área de texto" },
];

export function TemplateFormBuilder({ fields, onChange }: Props) {
  const addField = () => {
    onChange([
      ...fields,
      {
        key: `campo_${fields.length + 1}`,
        label: "",
        type: "text",
        required: false,
        order: fields.length,
      },
    ]);
  };

  const update = (idx: number, patch: Partial<FormFieldSchema>) => {
    const next = fields.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(fields.filter((_, i) => i !== idx).map((f, i) => ({ ...f, order: i })));
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...fields];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next.map((f, i) => ({ ...f, order: i })));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campos do formulário</p>
        <Button type="button" variant="outline" size="sm" onClick={addField} className="h-7 text-xs gap-1">
          <Plus className="h-3 w-3" /> Adicionar campo
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-4 text-center">Nenhum campo adicionado</p>
      )}

      <div className="space-y-2">
        {fields.map((f, idx) => (
          <div key={idx} className="flex items-start gap-2 p-2 rounded-lg border bg-card">
            <button type="button" onClick={() => moveUp(idx)} className="mt-2 cursor-grab text-muted-foreground hover:text-foreground">
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
              <Input
                value={f.key}
                onChange={(e) => update(idx, { key: e.target.value.replace(/\s/g, "_").toLowerCase() })}
                placeholder="chave_campo"
                className="h-8 text-xs font-mono"
              />
              <Input
                value={f.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                placeholder="Label"
                className="h-8 text-xs"
              />
              <Select value={f.type} onValueChange={(v) => update(idx, { type: v as FormFieldSchema["type"] })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch checked={f.required} onCheckedChange={(v) => update(idx, { required: v })} />
                <Label className="text-xs">Obrig.</Label>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} className="h-8 w-8 text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
