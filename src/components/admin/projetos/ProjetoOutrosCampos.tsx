/**
 * ProjetoOutrosCampos — Collapsible sections for "Campos importantes" and "Outros campos"
 * matching the reference layout with file uploads, editable text fields, and linked selects.
 */
import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ChevronUp, Paperclip, Upload, Pencil, Check, X, Loader2,
  Wifi, Package, Zap, MapPin, Settings, FileText, Type, CheckCircle,
} from "lucide-react";
import { ImportantFieldRow } from "./ImportantFieldRow";

// ─── Types ────────────────────────────────────────
interface ClienteExtra {
  identidade_urls: string[] | null;
  comprovante_endereco_urls: string[] | null;
  localizacao: string | null;
  modelo_inversor: string | null;
  observacoes: string | null;
  disjuntor_id: string | null;
  transformador_id: string | null;
  numero_placas: number | null;
  potencia_kwp: number | null;
}

interface DisjuntorOption { id: string; nome: string; }
interface TransformadorOption { id: string; nome: string; }

interface Props {
  clienteId: string | null;
  dealId: string;
  importantFields: Array<{ id: string; title: string; field_key: string; field_type: string; options: any; icon?: string | null }>;
  customFieldValues: Record<string, { value_text?: string | null; value_number?: number | null; value_boolean?: boolean | null; value_date?: string | null }>;
  onReloadImportant: () => void;
}

// ─── Hook: extra client fields ────────────────────
function useClienteExtra(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente-extra", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from("clientes")
        .select("identidade_urls, comprovante_endereco_urls, localizacao, modelo_inversor, observacoes, disjuntor_id, transformador_id, numero_placas, potencia_kwp")
        .eq("id", clienteId)
        .single();
      if (error) throw error;
      return data as ClienteExtra;
    },
    enabled: !!clienteId,
    staleTime: 1000 * 60 * 5,
  });
}

function useDisjuntores() {
  return useQuery({
    queryKey: ["disjuntores-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("disjuntores")
        .select("id, amperagem, descricao")
        .eq("ativo", true)
        .order("amperagem");
      return (data || []).map(d => ({ id: d.id, nome: `${d.amperagem}A${d.descricao ? ` - ${d.descricao}` : ""}` })) as DisjuntorOption[];
    },
    staleTime: 1000 * 60 * 15,
  });
}

function useTransformadores() {
  return useQuery({
    queryKey: ["transformadores-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transformadores")
        .select("id, potencia_kva, descricao")
        .eq("ativo", true)
        .order("potencia_kva");
      return (data || []).map(t => ({ id: t.id, nome: `${t.potencia_kva} kVA${t.descricao ? ` - ${t.descricao}` : ""}` })) as TransformadorOption[];
    },
    staleTime: 1000 * 60 * 15,
  });
}

// ─── Main Component ───────────────────────────────
export function ProjetoOutrosCampos({ clienteId, dealId, importantFields, customFieldValues, onReloadImportant }: Props) {
  const { data: extra, isLoading } = useClienteExtra(clienteId);
  const { data: disjuntores = [] } = useDisjuntores();
  const { data: transformadores = [] } = useTransformadores();
  const qc = useQueryClient();

  const [camposOpen, setCamposOpen] = useState(true);
  const [outrosOpen, setOutrosOpen] = useState(true);

  const refreshExtra = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["cliente-extra", clienteId] });
  }, [qc, clienteId]);

  // Resolve names for selects
  const disjuntorName = disjuntores.find(d => d.id === extra?.disjuntor_id)?.nome || "";
  const transformadorName = transformadores.find(t => t.id === extra?.transformador_id)?.nome || "";

  const hasIdentidade = extra?.identidade_urls && extra.identidade_urls.length > 0;
  const hasComprovante = extra?.comprovante_endereco_urls && extra.comprovante_endereco_urls.length > 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Build set of important field titles (lowercased) to exclude from "Outros campos"
  const importantTitlesLower = new Set(
    importantFields.map(f => f.title.toLowerCase().trim())
  );

  // ── "Outros campos" rows definition ──
  const allOutrosCamposRows: OutroCampoRow[] = [
    {
      key: "identidade",
      label: "Identidade",
      icon: Paperclip,
      type: "file",
      hasFile: !!hasIdentidade,
      fileCount: extra?.identidade_urls?.length || 0,
      bucket: "clientes",
      fieldPath: "identidade_urls",
    },
    {
      key: "comprovante",
      label: "Comprovante Endereço",
      icon: Paperclip,
      type: "file",
      hasFile: !!hasComprovante,
      fileCount: extra?.comprovante_endereco_urls?.length || 0,
      bucket: "clientes",
      fieldPath: "comprovante_endereco_urls",
    },
    {
      key: "equipamento",
      label: "Equipamento",
      icon: Package,
      type: "text",
      value: buildEquipamentoText(extra),
      dbField: "modelo_inversor",
    },
    {
      key: "disjuntor",
      label: "Disjuntor",
      icon: Zap,
      type: "select",
      value: disjuntorName,
      dbField: "disjuntor_id",
      options: disjuntores,
      selectedId: extra?.disjuntor_id || "",
    },
    {
      key: "localizacao",
      label: "Localização",
      icon: MapPin,
      type: "text",
      value: extra?.localizacao || "",
      dbField: "localizacao",
    },
    {
      key: "transformador",
      label: "Transformador",
      icon: Settings,
      type: "select",
      value: transformadorName,
      dbField: "transformador_id",
      options: transformadores,
      selectedId: extra?.transformador_id || "",
    },
    {
      key: "observacoes",
      label: "Observações",
      icon: Type,
      type: "textarea",
      value: extra?.observacoes || "",
      dbField: "observacoes",
    },
  ];

  // Filter out rows already shown in "Campos importantes"
  const outrosCamposRows = allOutrosCamposRows.filter(
    row => !importantTitlesLower.has(row.label.toLowerCase().trim())
  );

  return (
    <div className="space-y-2">
      {/* ── Campos Importantes ── */}
      <Card>
        <Collapsible open={camposOpen} onOpenChange={setCamposOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-between px-4 py-1.5 h-auto hover:bg-muted/30 rounded-t-lg">
              <span className="text-sm font-bold text-foreground">Campos importantes</span>
              <ChevronUp className={cn("h-4 w-4 text-muted-foreground transition-transform", !camposOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-3 sm:p-3 pt-0 sm:pt-0">
              {importantFields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2.5">
                  Nenhum campo importante encontrado para esta etapa
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {importantFields.map((field) => (
                    <ImportantFieldInline
                      key={field.id}
                      field={field}
                      value={customFieldValues[field.id]}
                      dealId={dealId}
                      onSaved={onReloadImportant}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* ── Outros Campos ── */}
      {clienteId && (
        <Card>
          <Collapsible open={outrosOpen} onOpenChange={setOutrosOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full flex items-center justify-between px-4 py-1.5 h-auto hover:bg-muted/30 rounded-t-lg">
                <span className="text-sm font-bold text-foreground">Outros campos</span>
                <ChevronUp className={cn("h-4 w-4 text-muted-foreground transition-transform", !outrosOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-3 sm:p-3 pt-0 sm:pt-0">
                <div className="divide-y divide-border">
                  {outrosCamposRows.map((row) => (
                    <OutroCampoRowComp
                      key={row.key}
                      row={row}
                      clienteId={clienteId!}
                      onSaved={refreshExtra}
                    />
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────
function buildEquipamentoText(extra: ClienteExtra | null | undefined): string {
  if (!extra) return "";
  const parts: string[] = [];
  if (extra.numero_placas) parts.push(`Quant Mod:${extra.numero_placas}`);
  if (extra.potencia_kwp) parts.push(`P. Modulo:${extra.potencia_kwp}`);
  if (extra.modelo_inversor) parts.push(extra.modelo_inversor);
  return parts.join(", ");
}

// ─── OutroCampoRow Types ──────────────────────────
interface OutroCampoRow {
  key: string;
  label: string;
  icon: typeof Type;
  type: "text" | "textarea" | "file" | "select";
  value?: string;
  hasFile?: boolean;
  fileCount?: number;
  bucket?: string;
  fieldPath?: string;
  dbField?: string;
  options?: Array<{ id: string; nome: string }>;
  selectedId?: string;
}

// ─── OutroCampoRow Component ──────────────────────
function OutroCampoRowComp({ row, clienteId, onSaved }: { row: OutroCampoRow; clienteId: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(row.value || "");
    setEditing(true);
  };

  const saveField = async (value: string) => {
    if (!row.dbField) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("clientes")
        .update({ [row.dbField]: value || null })
        .eq("id", clienteId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: "Sem permissão", description: "Não foi possível salvar. Verifique suas permissões ou peça ao administrador.", variant: "destructive" });
      } else {
        toast({ title: "Campo atualizado" });
        onSaved();
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !row.fieldPath) return;
    setSaving(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${clienteId}/${row.key}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("clientes").upload(path, file);
      if (upErr) throw upErr;

      // Get current urls array and append
      const { data: cur } = await supabase.from("clientes").select(row.fieldPath).eq("id", clienteId).single();
      const existing = (cur as any)?.[row.fieldPath] || [];
      const updated = [...existing, path];
      const { error } = await supabase.from("clientes").update({ [row.fieldPath]: updated }).eq("id", clienteId);
      if (error) throw error;
      toast({ title: "Arquivo anexado" });
      onSaved();
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── File type row ──
  if (row.type === "file") {
    return (
      <div className="flex items-center justify-between py-1 gap-2">
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
        <div className="flex items-center gap-2 min-w-0">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-xs text-foreground truncate">{row.label}</span>
          {row.hasFile && (
            <span className="text-xs text-muted-foreground">({row.fileCount})</span>
          )}
        </div>
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5 shrink-0"
          onClick={() => fileRef.current?.click()}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          Anexar aqui
        </Button>
      </div>
    );
  }

  // ── Select type row ──
  if (row.type === "select" && row.options) {
    return (
      <div className="flex items-center justify-between py-1 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {row.value ? (
            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-success" />
          ) : (
            <row.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className={cn("text-xs truncate", row.value ? "text-primary" : "text-foreground")}>{row.label}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Select
            value={row.selectedId || "none"}
            onValueChange={(v) => saveField(v === "none" ? "" : v)}
          >
            <SelectTrigger className="h-8 text-sm w-[140px] bg-muted/30 border-border">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {row.options.map(opt => (
                <SelectItem key={opt.id} value={opt.id}>{opt.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={startEdit} disabled>
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Text / Textarea type row (editing) ──
  if (editing) {
    return (
      <div className="py-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <row.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs text-foreground">{row.label}</span>
        </div>
        {row.type === "textarea" ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="text-sm"
            autoFocus
          />
        ) : (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") saveField(draft); if (e.key === "Escape") setEditing(false); }}
          />
        )}
        <div className="flex items-center gap-1.5 justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => saveField(draft)} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    );
  }

  // ── Text / Textarea display row ──
  return (
      <div className="flex items-center justify-between py-1 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <row.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className={cn("text-xs truncate", row.value ? "text-primary" : "text-foreground")}>{row.label}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className={cn(
          "text-xs px-2 py-0.5 rounded border text-center truncate w-[130px]",
          row.value ? "border-border bg-muted/30 text-foreground" : "border-dashed border-border text-muted-foreground"
        )}>
          {row.value || "—"}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={startEdit}>
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

// Reuse existing ImportantFieldRow directly

function ImportantFieldInline({ field, value, dealId, onSaved }: {
  field: { id: string; title: string; field_key: string; field_type: string; options: any; icon?: string | null };
  value: { value_text?: string | null; value_number?: number | null; value_boolean?: boolean | null; value_date?: string | null } | undefined;
  dealId: string;
  onSaved: () => void;
}) {
  return <ImportantFieldRow field={field} value={value} dealId={dealId} onSaved={onSaved} showSeparator={false} />;
}
