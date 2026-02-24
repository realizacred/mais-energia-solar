import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FieldDef {
  id: string;
  title: string;
  field_key: string;
  field_type: string;
  options: any;
}

interface FieldValue {
  value_text?: string | null;
  value_number?: number | null;
  value_boolean?: boolean | null;
  value_date?: string | null;
}

interface Props {
  field: FieldDef;
  value: FieldValue | undefined;
  dealId: string;
  onSaved: () => void;
}

export function ImportantFieldRow({ field, value, dealId, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftBool, setDraftBool] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = getDisplayValue(field, value);

  function startEdit() {
    if (field.field_type === "boolean") {
      setDraftBool(value?.value_boolean ?? false);
    } else if (field.field_type === "number" || field.field_type === "currency") {
      setDraft(value?.value_number != null ? String(value.value_number) : "");
    } else if (field.field_type === "date") {
      setDraft(value?.value_date ?? "");
    } else {
      setDraft(value?.value_text ?? "");
    }
    setEditing(true);
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function save() {
    setSaving(true);
    try {
      const payload: any = {
        deal_id: dealId,
        field_id: field.id,
        value_text: null,
        value_number: null,
        value_boolean: null,
        value_date: null,
      };

      if (field.field_type === "boolean") {
        payload.value_boolean = draftBool;
      } else if (field.field_type === "number" || field.field_type === "currency") {
        payload.value_number = draft ? parseFloat(draft) : null;
      } else if (field.field_type === "date") {
        payload.value_date = draft || null;
      } else {
        payload.value_text = draft || null;
      }

      const { error } = await supabase
        .from("deal_custom_field_values")
        .upsert(payload, { onConflict: "deal_id,field_id" });

      if (error) console.error("Erro ao salvar campo:", error);
      else onSaved();
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function cancel() {
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  }

  // Boolean toggle - save immediately
  async function toggleBool() {
    const newVal = !(value?.value_boolean ?? false);
    setSaving(true);
    try {
      await supabase
        .from("deal_custom_field_values")
        .upsert({
          deal_id: dealId,
          field_id: field.id,
          value_text: null,
          value_number: null,
          value_boolean: newVal,
          value_date: null,
        } as any, { onConflict: "deal_id,field_id" });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  // For boolean, render switch directly (no edit mode needed)
  if (field.field_type === "boolean") {
    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-muted-foreground">{field.title}</span>
        <Switch
          checked={value?.value_boolean ?? false}
          onCheckedChange={() => toggleBool()}
          disabled={saving}
          className="scale-75"
        />
      </div>
    );
  }

  // For select/dropdown fields
  const options: string[] = Array.isArray(field.options) ? field.options : [];

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="text-muted-foreground shrink-0 min-w-0 truncate">{field.title}</span>
        <div className="flex items-center gap-1 flex-1 justify-end">
          {field.field_type === "select" && options.length > 0 ? (
            <Select value={draft || "none"} onValueChange={(v) => { setDraft(v === "none" ? "" : v); }}>
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {options.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              ref={inputRef}
              type={field.field_type === "number" || field.field_type === "currency" ? "number" : field.field_type === "date" ? "date" : "text"}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-7 text-xs w-32"
              step={field.field_type === "currency" ? "0.01" : undefined}
            />
          )}
          <button onClick={save} disabled={saving} className="h-6 w-6 flex items-center justify-center rounded hover:bg-primary/10 text-primary transition-colors">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={cancel} className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="flex items-center justify-between w-full text-left py-1 group hover:bg-muted/40 -mx-1 px-1 rounded transition-colors cursor-pointer"
    >
      <span className="text-muted-foreground">{field.title}</span>
      <span className="flex items-center gap-1.5">
        <span className={cn("font-medium", displayValue === "—" ? "text-muted-foreground/50" : "text-foreground")}>{displayValue}</span>
        <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors" />
      </span>
    </button>
  );
}

function getDisplayValue(field: FieldDef, val: FieldValue | undefined): string {
  if (!val) return "—";
  if (field.field_type === "boolean") return val.value_boolean ? "Sim" : "Não";
  if (field.field_type === "number" || field.field_type === "currency") return val.value_number != null ? String(val.value_number) : "—";
  if (field.field_type === "date") return val.value_date ? new Date(val.value_date).toLocaleDateString("pt-BR") : "—";
  return val.value_text || "—";
}
