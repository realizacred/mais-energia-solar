/**
 * CustomFieldEditModal — Modal unificado para criar/editar campos customizados.
 * Funciona para os 3 contextos: Projetos, Pré-dimensionamento, Pós-dimensionamento.
 * Extraído de CustomFieldsSettings.tsx para reutilização e consistência visual.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Settings2, ChevronLeft, Loader2, Copy, HelpCircle, Sliders, Layers,
  Type, Hash, DollarSign, Calendar, CalendarClock, ListChecks, CheckSquare,
  FileText, GripVertical, Plus, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { icons } from "lucide-react";

// ─── Shared constants ───

export const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  textarea: "Texto Maior",
  number: "Numérico",
  currency: "Monetário",
  multi_select: "Opções Múltiplas",
  select: "Opção Única",
  date: "Data",
  datetime: "Data e Hora",
  file: "Arquivo",
  boolean: "Sim/Não",
};

const FIELD_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Type, textarea: Type, number: Hash, currency: DollarSign,
  multi_select: ListChecks, select: CheckSquare, date: Calendar,
  datetime: CalendarClock, file: FileText, boolean: CheckSquare,
};

const FIELD_TYPE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  text:         { bg: "bg-info/15",        text: "text-info",        ring: "ring-info/30" },
  textarea:     { bg: "bg-info/15",        text: "text-info",        ring: "ring-info/30" },
  number:       { bg: "bg-primary/15",     text: "text-primary",     ring: "ring-primary/30" },
  currency:     { bg: "bg-success/15",     text: "text-success",     ring: "ring-success/30" },
  multi_select: { bg: "bg-secondary/15",   text: "text-secondary",   ring: "ring-secondary/30" },
  select:       { bg: "bg-accent/15",      text: "text-accent-foreground", ring: "ring-accent/30" },
  date:         { bg: "bg-warning/15",     text: "text-warning",     ring: "ring-warning/30" },
  datetime:     { bg: "bg-warning/15",     text: "text-warning",     ring: "ring-warning/30" },
  file:         { bg: "bg-destructive/15", text: "text-destructive", ring: "ring-destructive/30" },
  boolean:      { bg: "bg-success/15",     text: "text-success",     ring: "ring-success/30" },
};

const OPTION_TYPES = ["select", "multi_select"];

export const FIELD_KEY_PREFIXES: Record<string, string> = {
  projeto: "cap",
  pre_dimensionamento: "pre",
  pos_dimensionamento: "pos",
};

export const CONTEXT_LABELS: Record<string, string> = {
  projeto: "Projetos",
  pre_dimensionamento: "Pré-dimensionamento",
  pos_dimensionamento: "Pós-dimensionamento",
};

export function normalizeFieldType(fieldType: string) {
  return fieldType === "multiselect" ? "multi_select" : fieldType;
}

// ─── Types ───

export interface CustomFieldFormData {
  title: string;
  field_key: string;
  field_type: string;
  field_context: string;
  show_on_create: boolean;
  required_on_create: boolean;
  visible_on_funnel: boolean;
  important_on_funnel: boolean;
  required_on_funnel: boolean;
  required_on_proposal: boolean;
  visibilityMode: "all" | "some";
  visible_pipeline_ids: string[];
  important_stage_ids: string[];
  required_stage_ids: string[];
  icon: string;
}

export interface CustomFieldData {
  id: string;
  title: string;
  field_key: string;
  field_type: string;
  field_context: string;
  options: any;
  ordem: number;
  show_on_create: boolean;
  required_on_create: boolean;
  visible_on_funnel: boolean;
  important_on_funnel: boolean;
  required_on_funnel: boolean;
  required_on_proposal: boolean;
  is_active: boolean;
  visible_pipeline_ids: string[];
  important_stage_ids: string[];
  required_stage_ids: string[];
  icon: string | null;
}

interface PipelineInfo {
  id: string;
  name: string;
}

interface StageInfo {
  id: string;
  name: string;
  pipeline_id: string;
  position: number;
}

interface CustomFieldEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingField: CustomFieldData | null;
  context: string;
  existingKeys: string[];
  pipelines: PipelineInfo[];
  stages: StageInfo[];
  onSave: (payload: Record<string, any>, id?: string) => Promise<void>;
}

// ─── Sortable Option Item ───

function SortableOptionItem({ id, value, onChange, onRemove }: {
  id: string; value: string; onChange: (v: string) => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5 group">
      <Button variant="ghost" size="icon" {...attributes} {...listeners}
        className="h-7 w-7 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
        <GripVertical className="h-3.5 w-3.5" />
      </Button>
      <Input value={value} onChange={e => onChange(e.target.value)}
        className="h-8 text-xs flex-1" placeholder="Valor da opção" />
      <Button variant="ghost" size="icon" onClick={onRemove}
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Main Component ───

export function CustomFieldEditModal({
  open, onOpenChange, editingField, context, existingKeys, pipelines, stages, onSave,
}: CustomFieldEditModalProps) {
  const [wizardStep, setWizardStep] = useState<"type" | "config">("type");
  const [saving, setSaving] = useState(false);
  const [fieldKeyError, setFieldKeyError] = useState<string | null>(null);

  const [form, setForm] = useState<CustomFieldFormData>({
    title: "", field_key: "", field_type: "text", field_context: context,
    show_on_create: false, required_on_create: false,
    visible_on_funnel: false, important_on_funnel: false,
    required_on_funnel: false, required_on_proposal: false,
    visibilityMode: "all", visible_pipeline_ids: [],
    important_stage_ids: [], required_stage_ids: [], icon: "",
  });

  // Options as array of { id, value } for drag-to-reorder
  const [options, setOptions] = useState<{ id: string; value: string }[]>([]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Reset form when dialog opens/field changes
  useEffect(() => {
    if (!open) return;
    if (editingField) {
      const vpids = editingField.visible_pipeline_ids || [];
      setForm({
        title: editingField.title,
        field_key: editingField.field_key,
        field_type: normalizeFieldType(editingField.field_type),
        field_context: editingField.field_context,
        show_on_create: editingField.show_on_create,
        required_on_create: editingField.required_on_create,
        visible_on_funnel: editingField.visible_on_funnel,
        important_on_funnel: editingField.important_on_funnel,
        required_on_funnel: editingField.required_on_funnel,
        required_on_proposal: editingField.required_on_proposal,
        visibilityMode: vpids.length > 0 ? "some" : "all",
        visible_pipeline_ids: vpids,
        important_stage_ids: editingField.important_stage_ids || [],
        required_stage_ids: editingField.required_stage_ids || [],
        icon: editingField.icon || "",
      });
      const opts = editingField.options;
      if (opts && Array.isArray(opts)) {
        setOptions(opts.map((v: string, i: number) => ({ id: `opt-${i}`, value: v })));
      } else {
        setOptions([]);
      }
      setWizardStep("config");
    } else {
      setForm({
        title: "", field_key: "", field_type: "text", field_context: context,
        show_on_create: false, required_on_create: false,
        visible_on_funnel: false, important_on_funnel: false,
        required_on_funnel: false, required_on_proposal: false,
        visibilityMode: "all", visible_pipeline_ids: [],
        important_stage_ids: [], required_stage_ids: [], icon: "",
      });
      setOptions([]);
      setWizardStep("type");
    }
    setFieldKeyError(null);
  }, [open, editingField, context]);

  const validateFieldKey = (key: string, ctx: string): string | null => {
    if (!key.trim()) return "Chave é obrigatória.";
    if (!/^[a-z0-9_]+$/.test(key)) return "Chave deve conter apenas letras minúsculas, números e underscore.";
    const expectedPrefix = FIELD_KEY_PREFIXES[ctx] || "cap";
    if (!key.startsWith(`${expectedPrefix}_`)) return `Chave deve começar com "${expectedPrefix}_".`;
    if (key.length < 4) return "Chave muito curta.";
    return null;
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.field_key.trim()) return;
    const keyErr = validateFieldKey(form.field_key, form.field_context);
    if (keyErr) { setFieldKeyError(keyErr); return; }
    const isDuplicate = existingKeys.some(k => k === form.field_key && k !== editingField?.field_key);
    if (isDuplicate) { setFieldKeyError("Chave já existe. Escolha outro nome."); return; }
    setFieldKeyError(null);
    setSaving(true);
    try {
      const normalizedType = normalizeFieldType(form.field_type);
      const optionsPayload = OPTION_TYPES.includes(normalizedType)
        ? options.map(o => o.value.trim()).filter(Boolean)
        : null;
      const { visibilityMode, icon, ...formRest } = form;
      const visible_on_funnel = visibilityMode === "all";
      const visible_pipeline_ids = visibilityMode === "some" ? formRest.visible_pipeline_ids : [];
      const payload = {
        ...formRest, field_type: normalizedType, options: optionsPayload,
        visible_on_funnel, visible_pipeline_ids,
        important_on_funnel: formRest.important_stage_ids.length > 0,
        required_on_funnel: formRest.required_stage_ids.length > 0,
        icon: icon || null,
      };
      await onSave(payload, editingField?.id);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleOptionDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOptions(prev => {
      const oldIdx = prev.findIndex(o => o.id === active.id);
      const newIdx = prev.findIndex(o => o.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }, []);

  const addOption = () => {
    setOptions(prev => [...prev, { id: `opt-${Date.now()}`, value: "" }]);
  };

  const removeOption = (id: string) => {
    setOptions(prev => prev.filter(o => o.id !== id));
  };

  const updateOption = (id: string, value: string) => {
    setOptions(prev => prev.map(o => o.id === id ? { ...o, value } : o));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setWizardStep("type"); }}>
      <DialogContent className="w-[90vw] max-w-[600px] p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Settings2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {editingField
                ? "Editar Campo"
                : `Novo Campo Customizado (${CONTEXT_LABELS[form.field_context]})`}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {wizardStep === "type"
                ? "Selecione o tipo de campo que deseja criar"
                : "Configure as propriedades do campo"}
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
          {/* ── Step 1: Type Grid ── */}
          {wizardStep === "type" && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 py-2">
              {Object.entries(FIELD_TYPE_LABELS).map(([key, label]) => {
                const Icon = FIELD_TYPE_ICONS[key] || Type;
                const colors = FIELD_TYPE_COLORS[key] || FIELD_TYPE_COLORS.text;
                return (
                  <Button key={key} variant="outline" type="button"
                    onClick={() => { setForm(p => ({ ...p, field_type: key })); setWizardStep("config"); }}
                    className={cn(
                      "flex flex-col items-center gap-2.5 p-4 rounded-xl h-auto",
                      "hover:shadow-md hover:scale-[1.03]",
                      "border-border bg-card text-foreground"
                    )}>
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ring-1", colors.bg, colors.ring)}>
                      <Icon className={cn("h-5 w-5", colors.text)} />
                    </div>
                    <span className="text-[11px] font-medium text-center leading-tight text-foreground">{label}</span>
                  </Button>
                );
              })}
            </div>
          )}

          {/* ── Step 2: Config ── */}
          {wizardStep === "config" && (
            <>
              {/* Back / Change type */}
              <Button variant="ghost" type="button" onClick={() => setWizardStep("type")}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" />
                {editingField ? "Alterar tipo" : "Voltar"}
              </Button>

              {/* Selected type indicator */}
              <div className="flex justify-center py-1">
                {(() => {
                  const nft = normalizeFieldType(form.field_type);
                  const Icon = FIELD_TYPE_ICONS[nft] || Type;
                  const colors = FIELD_TYPE_COLORS[nft] || FIELD_TYPE_COLORS.text;
                  return (
                    <div className="flex flex-col items-center gap-1.5 px-6 py-3 rounded-xl border bg-card shadow-sm">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ring-1", colors.bg, colors.ring)}>
                        <Icon className={cn("h-6 w-6", colors.text)} />
                      </div>
                      <span className="text-xs font-semibold text-foreground">{FIELD_TYPE_LABELS[nft]}</span>
                    </div>
                  );
                })()}
              </div>

              {/* ── Card: Dados do Campo ── */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
                  <div className="w-6 h-6 rounded-md bg-info/15 flex items-center justify-center">
                    <Type className="h-3.5 w-3.5 text-info" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">Dados do Campo</h4>
                </div>
                <div className="p-4 space-y-4">
                  {/* Title + Variable */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Título do Campo</Label>
                      <Input value={form.title}
                        onChange={e => {
                          const title = e.target.value;
                          const prefix = FIELD_KEY_PREFIXES[form.field_context] || FIELD_KEY_PREFIXES.projeto;
                          const slug = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                            .replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
                          setForm(p => ({
                            ...p, title,
                            ...(!editingField && slug ? { field_key: `${prefix}_${slug}` } : {}),
                          }));
                        }}
                        placeholder="Exemplo: Wifi" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-medium">Variável</Label>
                        <Tooltip>
                          <TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                          <TooltipContent className="text-xs max-w-[220px]">
                            Identificador único usado como variável em templates e consultas. Gerado automaticamente a partir do título.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input value={form.field_key}
                          onChange={e => {
                            const raw = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                            setForm(p => ({ ...p, field_key: raw }));
                            setFieldKeyError(null);
                          }}
                          placeholder={`${FIELD_KEY_PREFIXES[form.field_context] || "cap"}_nome_do_campo`}
                          className={cn("flex-1 font-mono text-xs h-9", fieldKeyError && "border-destructive")}
                          disabled={!!editingField} />
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                          disabled={!form.field_key}
                          onClick={() => {
                            navigator.clipboard.writeText(`[${form.field_key}]`);
                            toast({ title: `[${form.field_key}] copiado!` });
                          }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {fieldKeyError && <p className="text-[11px] text-destructive mt-0.5">{fieldKeyError}</p>}
                    </div>
                  </div>

                  {/* Type — editable via Select */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Tipo</Label>
                    <Select value={normalizeFieldType(form.field_type)}
                      onValueChange={v => setForm(p => ({ ...p, field_type: v }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(FIELD_TYPE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Options for select/multi_select — drag-to-reorder */}
                  {OPTION_TYPES.includes(normalizeFieldType(form.field_type)) && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Valores possíveis</Label>
                        <Button type="button" variant="outline" size="sm" onClick={addOption} className="h-7 text-xs gap-1">
                          <Plus className="h-3 w-3" /> Adicionar
                        </Button>
                      </div>
                      {options.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">
                          Nenhuma opção. Clique em "Adicionar" para criar.
                        </p>
                      ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleOptionDragEnd}>
                          <SortableContext items={options.map(o => o.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-1.5">
                              {options.map(opt => (
                                <SortableOptionItem key={opt.id} id={opt.id} value={opt.value}
                                  onChange={v => updateOption(opt.id, v)}
                                  onRemove={() => removeOption(opt.id)} />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Arraste <GripVertical className="h-3 w-3 inline" /> para reordenar as opções.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Card: Ícone do Campo ── */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
                  <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">Ícone do Campo</h4>
                </div>
                <div className="p-4 space-y-3">
                  <IconPicker selected={form.icon} onSelect={icon => setForm(p => ({ ...p, icon }))} />
                  {form.icon && (
                    <Button variant="ghost" size="sm" onClick={() => setForm(p => ({ ...p, icon: "" }))} className="text-xs text-muted-foreground">
                      Remover ícone (usar padrão do tipo)
                    </Button>
                  )}
                </div>
              </div>

              {/* ── Card: Comportamento (PROJETO context) ── */}
              {form.field_context === "projeto" && (
                <BehaviorCardProjeto form={form} setForm={setForm} pipelines={pipelines} stages={stages} />
              )}

              {/* ── Card: Comportamento (PRE/POS DIMENSIONAMENTO) ── */}
              {(form.field_context === "pre_dimensionamento" || form.field_context === "pos_dimensionamento") && (
                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
                    <div className="w-6 h-6 rounded-md bg-warning/15 flex items-center justify-center">
                      <Sliders className="h-3.5 w-3.5 text-warning" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground">Comportamento</h4>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Obrigatório na proposta?</Label>
                      <Select value={form.required_on_proposal ? "sim" : "nao"}
                        onValueChange={v => setForm(p => ({ ...p, required_on_proposal: v === "sim" }))}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {wizardStep === "config" ? (
          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button onClick={handleSave} disabled={!form.title.trim() || !form.field_key.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingField ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Behavior Card for "Projeto" context ───

function BehaviorCardProjeto({ form, setForm, pipelines, stages }: {
  form: CustomFieldFormData;
  setForm: React.Dispatch<React.SetStateAction<CustomFieldFormData>>;
  pipelines: PipelineInfo[];
  stages: StageInfo[];
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
        <div className="w-6 h-6 rounded-md bg-warning/15 flex items-center justify-center">
          <Sliders className="h-3.5 w-3.5 text-warning" />
        </div>
        <h4 className="text-sm font-semibold text-foreground">Comportamento</h4>
      </div>
      <div className="p-4 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Mostrar campo em novo projeto?</Label>
          <Select value={form.show_on_create ? "sim" : "nao"}
            onValueChange={v => setForm(p => ({ ...p, show_on_create: v === "sim" }))}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Visibilidade em funis?</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input type="radio" name="fieldVis" checked={form.visibilityMode === "all"}
                onChange={() => setForm(p => ({ ...p, visibilityMode: "all", visible_pipeline_ids: [] }))}
                className="accent-primary" />
              Todos
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input type="radio" name="fieldVis" checked={form.visibilityMode === "some"}
                onChange={() => setForm(p => ({ ...p, visibilityMode: "some" }))}
                className="accent-primary" />
              Alguns
            </label>
          </div>
        </div>

        {form.visibilityMode === "some" && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Funil</Label>
            <Select onValueChange={v => {
              if (!form.visible_pipeline_ids.includes(v)) {
                setForm(p => ({ ...p, visible_pipeline_ids: [...p.visible_pipeline_ids, v] }));
              }
            }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione uma opção" /></SelectTrigger>
              <SelectContent>
                {pipelines.filter(p => !form.visible_pipeline_ids.includes(p.id)).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.visible_pipeline_ids.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {form.visible_pipeline_ids.map(pid => {
                  const p = pipelines.find(pp => pp.id === pid);
                  return p ? (
                    <span key={pid} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {p.name}
                      <button type="button" onClick={() => setForm(prev => ({
                        ...prev, visible_pipeline_ids: prev.visible_pipeline_ids.filter(x => x !== pid)
                      }))} className="hover:text-destructive">×</button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StageMultiSelect label="Campo importante em etapa do funil:" stages={stages} pipelines={pipelines}
            selectedIds={form.important_stage_ids}
            onChange={ids => setForm(p => ({ ...p, important_stage_ids: ids }))} />
          <StageMultiSelect label="Campo obrigatório em etapa do funil:" stages={stages} pipelines={pipelines}
            selectedIds={form.required_stage_ids}
            onChange={ids => setForm(p => ({ ...p, required_stage_ids: ids }))} />
        </div>
      </div>
    </div>
  );
}

// ─── Stage Multi-Select ───

import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

function StageMultiSelect({ label, stages, pipelines, selectedIds, onChange }: {
  label: string; stages: StageInfo[]; pipelines: PipelineInfo[];
  selectedIds: string[]; onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const grouped = pipelines.map(p => ({ ...p, stages: stages.filter(s => s.pipeline_id === p.id) }));
  const summary = selectedIds.length === 0 ? "Nenhum" : `Múltiplos (${selectedIds.length})`;
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  const toggleAll = (checked: boolean) => onChange(checked ? stages.map(s => s.id) : []);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="relative">
        <Button variant="outline" type="button" onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between h-9 px-3 text-sm">
          <span className="truncate">{summary}</span>
          <ChevronLeft className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform -rotate-90", open && "rotate-90")} />
        </Button>
        {open && (
          <div className="absolute z-50 mt-1 w-full bg-card border rounded-lg shadow-lg p-2 space-y-1 max-h-[200px] overflow-y-auto">
            <label className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-muted/30 rounded">
              <input type="checkbox" checked={selectedIds.length === stages.length && stages.length > 0}
                onChange={e => toggleAll(e.target.checked)} className="accent-primary rounded" />
              <span className="font-medium">Marcar todos</span>
            </label>
            <Separator />
            {grouped.filter(g => g.stages.length > 0).map(g => (
              <div key={g.id}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase px-2 pt-1">{g.name}</p>
                {g.stages.map(s => (
                  <label key={s.id} className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-muted/30 rounded">
                    <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggle(s.id)} className="accent-primary rounded" />
                    {s.name}
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Icon Picker ───

const ICON_PICKER_LIST = [
  "circle-dot", "phone", "calendar", "mail", "message-circle", "video", "map-pin",
  "clipboard-check", "file-text", "send", "user", "users", "briefcase", "wrench",
  "zap", "star", "flag", "target", "eye", "link", "camera", "upload",
  "download", "settings", "search", "bell", "clock", "check-circle", "x-circle",
  "alert-triangle", "info", "help-circle", "bookmark", "heart", "thumbs-up",
  "award", "shield", "lock", "unlock", "home", "building-2", "truck",
  "package", "dollar-sign", "credit-card", "receipt-text", "calculator",
  "bar-chart-3", "trending-up", "pie-chart", "activity", "sun", "bolt",
];

function IconPicker({ selected, onSelect }: { selected: string; onSelect: (icon: string) => void }) {
  const toPascal = (s: string) => s.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  return (
    <div className="grid grid-cols-10 gap-1.5 p-3 border rounded-xl bg-muted/10 max-h-[160px] overflow-y-auto">
      {ICON_PICKER_LIST.map(name => {
        const Icon = (icons as any)[toPascal(name)];
        if (!Icon) return null;
        const isSelected = selected === name;
        return (
          <Button key={name} variant="ghost" type="button" size="icon" onClick={() => onSelect(name)}
            className={cn("w-8 h-8 rounded-lg", isSelected
              ? "bg-primary/15 text-primary ring-2 ring-primary/30 shadow-sm scale-110"
              : "hover:bg-primary/10 text-muted-foreground hover:text-primary hover:shadow-sm hover:scale-105"
            )} title={name}>
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
