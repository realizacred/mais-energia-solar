import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Pencil, Type, Hash, ToggleLeft, Calendar, List, DollarSign, Percent, FileText, AlignLeft, Paperclip, Wifi, Package, Zap, MapPin, Settings, icons, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/dateUtils";
import { CustomFieldFileInput } from "./CustomFieldFileInput";
import { toast } from "@/hooks/use-toast";

interface FieldDef {
  id: string;
  title: string;
  field_key: string;
  field_type: string;
  options: any;
  icon?: string | null;
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
  showSeparator?: boolean;
  disabled?: boolean;
}

const TYPE_ICON_MAP: Record<string, typeof Type> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  currency: DollarSign,
  percent: Percent,
  boolean: ToggleLeft,
  date: Calendar,
  select: List,
  multiselect: List,
  file: FileText,
};

const TITLE_ICON_MAP: Array<{ pattern: RegExp; icon: typeof Type }> = [
  { pattern: /identidade/i, icon: Paperclip },
  { pattern: /comprovante/i, icon: Paperclip },
  { pattern: /wi-?fi/i, icon: Wifi },
  { pattern: /equipamento/i, icon: Package },
  { pattern: /disjuntor/i, icon: Zap },
  { pattern: /localiza/i, icon: MapPin },
  { pattern: /transformador/i, icon: Settings },
];

async function resolveTenantId(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return (profile as any)?.tenant_id ?? null;
}

export function ImportantFieldRow({ field, value, dealId, onSaved, showSeparator = true, disabled = false }: Props) {
  const [saving, setSaving] = useState(false);
  
  const toPascal = (s: string) => s.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  const CustomIcon = field.icon ? (icons as any)[toPascal(field.icon)] : null;
  const TitleIcon = TITLE_ICON_MAP.find(m => m.pattern.test(field.title))?.icon;
  const FieldIcon = CustomIcon || TitleIcon || TYPE_ICON_MAP[field.field_type] || Type;

  async function save(newValue?: any) {
    setSaving(true);
    try {
      const tenantId = await resolveTenantId();
      const payload: any = {
        deal_id: dealId,
        field_id: field.id,
        tenant_id: tenantId,
        value_text: null,
        value_number: null,
        value_boolean: null,
        value_date: null,
      };

      if (field.field_type === "boolean") {
        payload.value_boolean = newValue !== undefined ? newValue : value?.value_boolean;
      } else if (field.field_type === "number" || field.field_type === "currency" || field.field_type === "percent") {
        payload.value_number = newValue != null && newValue !== "" ? parseFloat(newValue) : null;
      } else if (field.field_type === "date") {
        payload.value_date = newValue || null;
      } else {
        payload.value_text = newValue || null;
      }

      const { error } = await supabase
        .from("deal_custom_field_values")
        .upsert(payload, { onConflict: "deal_id,field_id" });

      if (error) {
        console.error("Erro ao salvar campo:", error);
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      } else {
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  // ── File row (upload directly) ──
  if (field.field_type === "file") {
    return (
      <>
        <div className="flex items-center gap-2 py-2 px-1 min-w-0">
          <FieldIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-xs font-bold text-foreground truncate min-w-0 w-[120px] shrink-0" title={field.title}>{field.title}</span>
          <div className="flex-1 min-w-0">
            <CustomFieldFileInput
              value={value?.value_text}
              fieldKey={field.field_key}
              dealId={dealId}
              compact
              disabled={disabled}
              onChange={async (jsonValue) => {
                const tenantId = await resolveTenantId();
                const { error } = await supabase
                  .from("deal_custom_field_values")
                  .upsert({
                    deal_id: dealId,
                    field_id: field.id,
                    tenant_id: tenantId,
                    value_text: jsonValue,
                    value_number: null,
                    value_boolean: null,
                    value_date: null,
                  } as any, { onConflict: "deal_id,field_id" });
                if (error) {
                  console.error("Erro ao salvar arquivo do campo:", error);
                  toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
                } else {
                  onSaved();
                }
              }}
            />
          </div>
        </div>
        {showSeparator && <Separator />}
      </>
    );
  }

  // ── Boolean row ──
  if (field.field_type === "boolean") {
    return (
      <>
        <div className="flex items-center gap-2 py-2 px-1">
          <FieldIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-xs font-bold text-foreground flex-1 min-w-0 truncate" title={field.title}>{field.title}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase font-medium">
              {value?.value_boolean ? "Sim" : "Não"}
            </span>
            <Switch
              checked={value?.value_boolean ?? false}
              onCheckedChange={(val) => save(val)}
              disabled={saving || disabled}
            />
          </div>
        </div>
        {showSeparator && <Separator />}
      </>
    );
  }

  // ── Text / Input row ──
  if (field.field_type === "text" || field.field_type === "textarea" || field.field_type === "number" || field.field_type === "currency" || field.field_type === "percent" || field.field_type === "date") {
    const isTextarea = field.field_type === "textarea" || field.title.toLowerCase().includes("equipamento") || field.title.toLowerCase().includes("localiza") || field.title.toLowerCase().includes("wi-fi") || field.title.toLowerCase().includes("obs");
    
    return (
      <>
        <div className="py-2 px-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <FieldIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="text-xs font-bold text-foreground truncate" title={field.title}>{field.title}</span>
            {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
          </div>
          
          {isTextarea ? (
            <Textarea
              placeholder="Clique para preencher..."
              className="w-full border border-border bg-background rounded-md p-2 text-sm resize-none focus-visible:ring-1 focus-visible:ring-primary min-h-[60px]"
              rows={2}
              defaultValue={field.field_type === "number" ? (value?.value_number?.toString() ?? "") : (value?.value_text ?? "")}
              onBlur={(e) => {
                const currentVal = field.field_type === "number" ? (value?.value_number?.toString() ?? "") : (value?.value_text ?? "");
                if (e.target.value !== currentVal) {
                  save(e.target.value);
                }
              }}
              disabled={disabled || saving}
            />
          ) : (
            <Input
              type={field.field_type === "number" || field.field_type === "currency" || field.field_type === "percent" ? "number" : field.field_type === "date" ? "date" : "text"}
              placeholder="Clique para preencher..."
              className="h-8 text-sm w-full bg-background border-border focus-visible:ring-1 focus-visible:ring-primary"
              defaultValue={field.field_type === "number" || field.field_type === "currency" || field.field_type === "percent" ? (value?.value_number?.toString() ?? "") : field.field_type === "date" ? (value?.value_date ?? "") : (value?.value_text ?? "")}
              onBlur={(e) => {
                const currentVal = field.field_type === "number" || field.field_type === "currency" || field.field_type === "percent" ? (value?.value_number?.toString() ?? "") : field.field_type === "date" ? (value?.value_date ?? "") : (value?.value_text ?? "");
                if (e.target.value !== currentVal) {
                  save(e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              disabled={disabled || saving}
            />
          )}
        </div>
        {showSeparator && <Separator />}
      </>
    );
  }

  // ── Select type row ──
  const options: string[] = Array.isArray(field.options) ? field.options : [];
  return (
    <>
      <div className="flex items-center justify-between gap-2 py-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <FieldIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-xs font-bold text-foreground truncate" title={field.title}>{field.title}</span>
        </div>
        <Select 
          value={value?.value_text || "none"} 
          onValueChange={(v) => save(v === "none" ? null : v)}
          disabled={disabled || saving}
        >
          <SelectTrigger className="h-8 text-xs w-[140px] bg-background border-border">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {options.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showSeparator && <Separator />}
    </>
  );
}
