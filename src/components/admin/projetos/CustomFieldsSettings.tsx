import React, { useState, useEffect, useCallback } from "react";
import { useMotivosPerda } from "@/hooks/useDistribution";
import {
  useCustomFieldsList, useActivityTypesList, usePipelineStages, usePipelinesList,
  useSaveCustomField, useDeleteCustomField, useToggleCustomField,
  useSaveActivityType, useDeleteActivityType,
} from "@/hooks/useCustomFieldsSettings";
import { useTenantPremises } from "@/hooks/useTenantPremises";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, GripVertical, Pencil, Settings2, Layers, Zap, AlertTriangle,
  Save, Loader2, LayoutGrid, ListOrdered, Type, Hash, DollarSign, Calendar,
  CalendarClock, ListChecks, CheckSquare, FileText, ChevronLeft, ChevronDown, HelpCircle,
  Sliders, Copy, Landmark
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// ─── Types ───
interface CustomField {
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

interface StageInfo {
  id: string;
  name: string;
  pipeline_id: string;
  position: number;
}

interface ActivityType {
  id: string;
  title: string;
  ordem: number;
  visible_on_funnel: boolean;
  is_active: boolean;
  icon: string | null;
  pipeline_ids: string[] | null;
}

interface MotivoPerda {
  id: string;
  nome: string;
  ordem: number | null;
  ativo: boolean | null;
}

const FIELD_TYPE_LABELS: Record<string, string> = {
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
  text: Type,
  textarea: Type,
  number: Hash,
  currency: DollarSign,
  multi_select: ListChecks,
  select: CheckSquare,
  date: Calendar,
  datetime: CalendarClock,
  file: FileText,
  boolean: CheckSquare,
};

/** Cores vibrantes por tipo — gradientes suaves para visual 3D */
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

// Types that show "Valores possíveis" textarea
const OPTION_TYPES = ["select", "multi_select"];

const FIELD_KEY_PREFIXES: Record<string, string> = {
  projeto: "cap",
  pre_dimensionamento: "pre",
  pos_dimensionamento: "pos",
};

function normalizeFieldType(fieldType: string) {
  return fieldType === "multiselect" ? "multi_select" : fieldType;
}

const CONTEXT_LABELS: Record<string, string> = {
  projeto: "Projetos",
  pre_dimensionamento: "Pré-dimensionamento",
  pos_dimensionamento: "Pós-dimensionamento",
};

export function CustomFieldsSettings() {
  const [activeTab, setActiveTab] = useState("campos");
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityType | null>(null);
  const [motivoDialogOpen, setMotivoDialogOpen] = useState(false);
  const [editingMotivo, setEditingMotivo] = useState<MotivoPerda | null>(null);
  const [saving, setSaving] = useState(false);
  const [contextFilter, setContextFilter] = useState("projeto");

  // ─── Queries via hooks ───
  const { data: fields = [], isLoading: fieldsLoading } = useCustomFieldsList();
  const { data: activityTypes = [], isLoading: actLoading } = useActivityTypesList();
  const { data: stages = [] } = usePipelineStages();
  const { data: pipelines = [] } = usePipelinesList();
  const loading = fieldsLoading || actLoading;

  // ─── Mutations via hooks ───
  const saveFieldMutation = useSaveCustomField();
  const deleteFieldMutation = useDeleteCustomField();
  const toggleFieldMutation = useToggleCustomField();
  const saveActivityMutation = useSaveActivityType();
  const deleteActivityMutation = useDeleteActivityType();

  // ─── Use canonical hook for motivos_perda (SSOT) ───
  const { motivos, loading: motivosLoading, upsert: upsertMotivo, remove: removeMotivo } = useMotivosPerda();

  // ─── Premissas (SSOT via useTenantPremises) ───
  const premissasCtx = useTenantPremises();

  // ─── Custom Field CRUD ───
  const [fieldForm, setFieldForm] = useState({
    title: "", field_key: "", field_type: "text", field_context: "projeto",
    show_on_create: false, required_on_create: false,
    visible_on_funnel: false, important_on_funnel: false,
    required_on_funnel: false, required_on_proposal: false,
    visibilityMode: "all" as "all" | "some",
    visible_pipeline_ids: [] as string[],
    important_stage_ids: [] as string[],
    required_stage_ids: [] as string[],
    icon: "" as string,
  });
  const [fieldWizardStep, setFieldWizardStep] = useState<"type" | "config">("type");
  const [optionsText, setOptionsText] = useState("");

  const openFieldDialog = (field?: CustomField) => {
    if (field) {
      setEditingField(field);
      const vpids = field.visible_pipeline_ids || [];
      setFieldForm({
        title: field.title, field_key: field.field_key, field_type: normalizeFieldType(field.field_type),
        field_context: field.field_context,
        show_on_create: field.show_on_create, required_on_create: field.required_on_create,
        visible_on_funnel: field.visible_on_funnel, important_on_funnel: field.important_on_funnel,
        required_on_funnel: field.required_on_funnel, required_on_proposal: field.required_on_proposal,
        visibilityMode: vpids.length > 0 ? "some" : "all",
        visible_pipeline_ids: vpids,
        important_stage_ids: field.important_stage_ids || [],
        required_stage_ids: field.required_stage_ids || [],
        icon: field.icon || "",
      });
      const opts = field.options;
      if (opts && Array.isArray(opts)) {
        setOptionsText(opts.join("\n"));
      } else {
        setOptionsText("");
      }
      setFieldWizardStep("config");
    } else {
      setEditingField(null);
      setFieldForm({
        title: "", field_key: "", field_type: "text", field_context: contextFilter,
        show_on_create: false, required_on_create: false,
        visible_on_funnel: false, important_on_funnel: false,
        required_on_funnel: false, required_on_proposal: false,
        visibilityMode: "all",
        visible_pipeline_ids: [],
        important_stage_ids: [],
        required_stage_ids: [],
        icon: "",
      });
      setOptionsText("");
      setFieldWizardStep("type");
    }
    setFieldKeyError(null);
    setFieldDialogOpen(true);
  };

  const [fieldKeyError, setFieldKeyError] = useState<string | null>(null);

  const validateFieldKey = (key: string, context: string): string | null => {
    if (!key.trim()) return "Chave é obrigatória.";
    if (!/^[a-z0-9_]+$/.test(key)) return "Chave deve conter apenas letras minúsculas, números e underscore.";
    const expectedPrefix = FIELD_KEY_PREFIXES[context] || "cap";
    if (!key.startsWith(`${expectedPrefix}_`)) return `Chave deve começar com "${expectedPrefix}_".`;
    if (key.length < 4) return "Chave muito curta.";
    return null;
  };

  const handleSaveField = async () => {
    if (!fieldForm.title.trim() || !fieldForm.field_key.trim()) return;

    // Validate field_key format
    const keyErr = validateFieldKey(fieldForm.field_key, fieldForm.field_context);
    if (keyErr) {
      setFieldKeyError(keyErr);
      return;
    }

    // Check uniqueness (skip for edits keeping same key)
    const isDuplicate = fields.some(
      (f: any) => f.field_key === fieldForm.field_key && f.id !== editingField?.id
    );
    if (isDuplicate) {
      setFieldKeyError("Chave já existe. Escolha outro nome.");
      return;
    }

    setFieldKeyError(null);
    setSaving(true);
    try {
      const normalizedFieldType = normalizeFieldType(fieldForm.field_type);
      const options = OPTION_TYPES.includes(normalizedFieldType)
        ? optionsText.split("\n").map(s => s.trim()).filter(Boolean)
        : null;
      const { visibilityMode, icon, ...formRest } = fieldForm;
      const visible_on_funnel = visibilityMode === "all";
      const visible_pipeline_ids = visibilityMode === "some" ? formRest.visible_pipeline_ids : [];
      const payload = {
        ...formRest, field_type: normalizedFieldType, options, visible_on_funnel, visible_pipeline_ids,
        important_on_funnel: formRest.important_stage_ids.length > 0,
        required_on_funnel: formRest.required_stage_ids.length > 0,
        icon: icon || null,
      };

      await saveFieldMutation.mutateAsync({ id: editingField?.id, data: payload });
      toast({ title: editingField ? "Campo atualizado" : "Campo criado" });
      setFieldDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDeleteField = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja remover este campo?")) return;
    try {
      await deleteFieldMutation.mutateAsync(id);
      toast({ title: "Campo removido" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // ─── Activity Types CRUD ───
  const [activityForm, setActivityForm] = useState({
    title: "", visible_on_funnel: true, icon: "circle-dot",
    visibilityMode: "all" as "all" | "some", pipeline_ids: [] as string[],
  });

  const openActivityDialog = (at?: ActivityType) => {
    if (at) {
      setEditingActivity(at);
      const pids = at.pipeline_ids || [];
      setActivityForm({
        title: at.title, visible_on_funnel: at.visible_on_funnel,
        icon: at.icon || "circle-dot",
        visibilityMode: pids.length > 0 ? "some" : "all",
        pipeline_ids: pids,
      });
    } else {
      setEditingActivity(null);
      setActivityForm({ title: "", visible_on_funnel: true, icon: "circle-dot", visibilityMode: "all", pipeline_ids: [] });
    }
    setActivityDialogOpen(true);
  };

  const handleSaveActivity = async () => {
    if (!activityForm.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: activityForm.title,
        visible_on_funnel: activityForm.visible_on_funnel,
        icon: activityForm.icon || "circle-dot",
        pipeline_ids: activityForm.visibilityMode === "all" ? [] : activityForm.pipeline_ids,
      };
      await saveActivityMutation.mutateAsync({ id: editingActivity?.id, data: payload });
      toast({ title: editingActivity ? "Tipo atualizado" : "Tipo criado" });
      setActivityDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja remover este tipo de atividade?")) return;
    try {
      await deleteActivityMutation.mutateAsync(id);
      toast({ title: "Tipo removido" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // ─── Motivos Perda — delegates to useMotivosPerda hook (SSOT) ───
  const [motivoForm, setMotivoForm] = useState({ nome: "" });

  const openMotivoDialog = (m?: MotivoPerda) => {
    if (m) {
      setEditingMotivo(m);
      setMotivoForm({ nome: m.nome });
    } else {
      setEditingMotivo(null);
      setMotivoForm({ nome: "" });
    }
    setMotivoDialogOpen(true);
  };

  const handleSaveMotivo = async () => {
    if (!motivoForm.nome.trim()) return;
    setSaving(true);
    try {
      await upsertMotivo(editingMotivo ? { id: editingMotivo.id, nome: motivoForm.nome } : { nome: motivoForm.nome });
      setMotivoDialogOpen(false);
    } catch { /* hook already toasts */ }
    finally { setSaving(false); }
  };

  const handleDeleteMotivo = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja remover este motivo?")) return;
    removeMotivo(id);
  };

  const filteredFields = fields.filter(f => f.field_context === contextFilter);
  const isPosDimensionamento = contextFilter === "pos_dimensionamento";

  // ─── DnD for pos_dimensionamento reorder ───
  const queryClient = useQueryClient();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filteredFields.findIndex(f => f.id === active.id);
    const newIndex = filteredFields.findIndex(f => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filteredFields, oldIndex, newIndex);
    // Persist new ordem values
    try {
      await Promise.all(
        reordered.map((f, i) =>
          supabase.from("deal_custom_fields").update({ ordem: i + 1 } as any).eq("id", f.id)
        )
      );
      queryClient.invalidateQueries({ queryKey: ["deal-custom-fields"] });
      toast({ title: "Ordem atualizada" });
    } catch {
      toast({ title: "Erro ao reordenar", variant: "destructive" });
    }
  }, [filteredFields, queryClient]);

  if (loading || motivosLoading || premissasCtx.loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings2}
        title="Opções Customizáveis"
        description="Personalize campos, premissas, tipos de atividade e motivos de perda do seu CRM"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="overflow-x-auto flex-wrap h-auto">
          <TabsTrigger value="campos" className="gap-1.5">
            <LayoutGrid className="h-4 w-4" />Campos Customizados
          </TabsTrigger>
          <TabsTrigger value="premissas" className="gap-1.5">
            <Sliders className="h-4 w-4" />Premissas
          </TabsTrigger>
          <TabsTrigger value="atividades" className="gap-1.5">
            <Zap className="h-4 w-4" />Tipos de Atividades
          </TabsTrigger>
          <TabsTrigger value="motivos" className="gap-1.5">
            <AlertTriangle className="h-4 w-4" />Motivos de Perda
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB: Campos Customizados ═══ */}
        <TabsContent value="campos" className="space-y-4 mt-4">
          {/* Context sub-tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(CONTEXT_LABELS).map(([key, label]) => (
              <Button
                key={key}
                variant={contextFilter === key ? "secondary" : "outline"}
                size="sm"
                onClick={() => setContextFilter(key)}
                className="shrink-0"
              >
                {label}
              </Button>
            ))}
            <div className="flex-1" />
            <Button size="sm" onClick={() => openFieldDialog()} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Novo Campo
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-primary" />
                Campos de {CONTEXT_LABELS[contextFilter]}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {contextFilter === "projeto" && "Campos exibidos no cadastro e funil de projetos"}
                {contextFilter === "pre_dimensionamento" && "Campos exibidos na etapa de pré-dimensionamento da proposta"}
                {contextFilter === "pos_dimensionamento" && "Campos exibidos na etapa de pós-dimensionamento da proposta"}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {filteredFields.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <LayoutGrid className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm font-medium">Nenhum campo customizado</p>
                  <p className="text-xs mt-1">Crie campos para personalizar seus {CONTEXT_LABELS[contextFilter].toLowerCase()}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {isPosDimensionamento ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-16">Ordem</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Título</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Chave</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Tipo</th>
                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground">Obrigatório na Proposta</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Ações</th>
                          </tr>
                        </thead>
                        <SortableContext items={filteredFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                          <tbody>
                            {filteredFields.map((f, i) => (
                              <SortableFieldRow
                                key={f.id}
                                field={f}
                                index={i}
                                contextFilter={contextFilter}
                                pipelines={pipelines}
                                stages={stages}
                                onEdit={openFieldDialog}
                                onDelete={handleDeleteField}
                              />
                            ))}
                          </tbody>
                        </SortableContext>
                      </table>
                    </DndContext>
                  ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Ordem</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Título</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Chave</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Tipo</th>
                        {contextFilter === "projeto" && (
                          <>
                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground">Novo projeto</th>
                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground">Obrig. criar</th>
                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground">Visíveis nos funis</th>
                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground">Importante em etapa</th>
                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground">Obrigatório em etapa</th>
                          </>
                        )}
                        {contextFilter === "pre_dimensionamento" && (
                          <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground">Obrigatório na Proposta</th>
                        )}
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFields.map((f, i) => {
                        const toPascal = (s: string) => s.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
                        const CustomIcon = f.icon ? (icons as any)[toPascal(f.icon)] : null;
                        const FallbackIcon = FIELD_TYPE_ICONS[normalizeFieldType(f.field_type)] || Type;
                        const RowIcon = CustomIcon || FallbackIcon;
                        return (
                        <tr key={f.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <span className="text-xs text-muted-foreground">{i + 1}</span>
                          </td>
                          <td className="px-4 py-2.5 font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                <RowIcon className="h-3.5 w-3.5 text-primary" />
                              </div>
                              {f.title}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="group inline-flex items-center gap-1 h-auto py-0.5 px-1"
                              onClick={() => {
                                navigator.clipboard.writeText(`[${f.field_key}]`);
                                toast({ title: `[${f.field_key}] copiado!` });
                              }}
                            >
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">[{f.field_key}]</code>
                              <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Button>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className="text-[10px]">{FIELD_TYPE_LABELS[normalizeFieldType(f.field_type)] || f.field_type}</Badge>
                          </td>
                          {contextFilter === "projeto" && (
                            <>
                              <td className="text-center px-2"><SwitchCell value={f.show_on_create} fieldId={f.id} column="show_on_create" onUpdate={() => {}} /></td>
                              <td className="text-center px-2"><SwitchCell value={f.required_on_create} fieldId={f.id} column="required_on_create" onUpdate={() => {}} /></td>
                              <td className="text-center px-2 text-xs text-muted-foreground">
                                {(f.visible_pipeline_ids?.length > 0)
                                  ? f.visible_pipeline_ids.map(pid => pipelines.find(p => p.id === pid)?.name || "?").join(", ")
                                  : f.visible_on_funnel ? "Todos" : "Nenhum"}
                              </td>
                              <td className="text-center px-2 text-xs text-muted-foreground">
                                {(f.important_stage_ids?.length > 0)
                                  ? f.important_stage_ids.map(sid => stages.find(s => s.id === sid)?.name || "?").join(", ")
                                  : "Nenhum"}
                              </td>
                              <td className="text-center px-2 text-xs text-muted-foreground">
                                {(f.required_stage_ids?.length > 0)
                                  ? f.required_stage_ids.map(sid => stages.find(s => s.id === sid)?.name || "?").join(", ")
                                  : "Nenhum"}
                              </td>
                            </>
                          )}
                          {contextFilter === "pre_dimensionamento" && (
                            <td className="text-center px-2"><SwitchCell value={f.required_on_proposal} fieldId={f.id} column="required_on_proposal" onUpdate={() => {}} /></td>
                          )}
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openFieldDialog(f)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteField(f.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Tipos de Atividades ═══ */}
        <TabsContent value="atividades" className="space-y-4 mt-4">
          {/* Tipos padrão do sistema (read-only) */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Tipos padrão do sistema</p>
            <p className="text-xs text-muted-foreground mb-3">Estes tipos são nativos e não podem ser removidos.</p>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Tipo</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Chave</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: "task", label: "Tarefa" },
                      { key: "call", label: "Ligação" },
                      { key: "meeting", label: "Reunião" },
                      { key: "email", label: "E-mail" },
                      { key: "visit", label: "Visita" },
                      { key: "follow_up", label: "Follow-up" },
                      { key: "other", label: "Outro" },
                    ].map((t) => (
                      <tr key={t.key} className="border-b last:border-0">
                        <td className="px-4 py-2.5 font-medium text-foreground">{t.label}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{t.key}</td>
                        <td className="text-center px-4">
                          <Badge variant="soft-success" className="text-[10px]">Ativo</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Tipos customizados */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-foreground">Tipos customizados</p>
                <p className="text-xs text-muted-foreground mt-0.5">Adicione novos tipos de atividade específicos para seu negócio</p>
              </div>
              <Button size="sm" onClick={() => openActivityDialog()} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Novo Tipo
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {activityTypes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Zap className="h-6 w-6 mb-2 opacity-30" />
                    <p className="text-xs">Nenhum tipo customizado cadastrado</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Ordem</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Título</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Visível nos funis</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityTypes.map((at, i) => {
                        const toPascal = (s: string) => s.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
                        const AtIcon = at.icon ? (icons as any)[toPascal(at.icon)] : null;
                        return (
                          <tr key={at.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                                <span className="text-xs text-muted-foreground">{i + 1}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-medium">
                              <div className="flex items-center gap-2">
                                {AtIcon && <AtIcon className="h-4 w-4 text-muted-foreground" />}
                                {at.title}
                              </div>
                            </td>
                            <td className="text-center px-4">
                              <Badge variant={at.visible_on_funnel ? "default" : "secondary"} className="text-[10px]">
                                {at.visible_on_funnel ? "Sim" : "Não"}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openActivityDialog(at)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteActivity(at.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ TAB: Motivos de Perda ═══ */}
        <TabsContent value="motivos" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Configure os motivos de perda ao marcar projetos como perdidos</p>
            <Button size="sm" onClick={() => openMotivoDialog()} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Novo Motivo
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {motivos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm font-medium">Nenhum motivo de perda cadastrado</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Ordem</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Motivo de Perda</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {motivos.map((m, i) => (
                      <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-muted-foreground">{i + 1}</span>
                        </td>
                        <td className="px-4 py-2.5 font-medium">{m.nome}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMotivoDialog(m)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteMotivo(m.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Premissas ═══ */}
        <TabsContent value="premissas" className="space-y-4 mt-4">
          <PremissasTabContent ctx={premissasCtx} />
        </TabsContent>
      </Tabs>

      {/* ═══ Dialog: Campo Customizado (Wizard) ═══ */}
      <Dialog open={fieldDialogOpen} onOpenChange={(open) => { setFieldDialogOpen(open); if (!open) setFieldWizardStep("type"); }}>
        <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Settings2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {editingField
                  ? "Editar Campo"
                  : `Novo Campo Customizado (${CONTEXT_LABELS[fieldForm.field_context]})`}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fieldWizardStep === "type"
                  ? "Selecione o tipo de campo que deseja criar"
                  : "Configure as propriedades do campo"}
              </p>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
          {/* ── Step 1: Type Grid ── */}
          {fieldWizardStep === "type" && (() => {
            const availableTypes = Object.entries(FIELD_TYPE_LABELS);
            return (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 py-2">
                {availableTypes.map(([key, label]) => {
                  const Icon = FIELD_TYPE_ICONS[key] || Type;
                  const colors = FIELD_TYPE_COLORS[key] || FIELD_TYPE_COLORS.text;
                  return (
                    <Button
                      key={key}
                      variant="outline"
                      type="button"
                      onClick={() => {
                        setFieldForm(p => ({ ...p, field_type: key }));
                        setFieldWizardStep("config");
                      }}
                      className={cn(
                        "flex flex-col items-center gap-2.5 p-4 rounded-xl h-auto",
                        "hover:shadow-md hover:scale-[1.03]",
                        "border-border bg-card text-foreground"
                      )}
                    >
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ring-1",
                        colors.bg, colors.ring
                      )}>
                        <Icon className={cn("h-5 w-5", colors.text)} />
                      </div>
                      <span className="text-[11px] font-medium text-center leading-tight text-foreground">{label}</span>
                    </Button>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Step 2: Config Form ── */}
          {fieldWizardStep === "config" && (
            <>
              {/* Back button — always visible so user can change type */}
              <Button variant="ghost"
                type="button"
                onClick={() => setFieldWizardStep("type")}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                {editingField ? "Alterar tipo" : "Voltar"}
              </Button>

              {/* Selected type indicator */}
              <div className="flex justify-center py-1">
                {(() => {
                  const nft = normalizeFieldType(fieldForm.field_type);
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
                    <Input
                      value={fieldForm.title}
                      onChange={e => {
                        const title = e.target.value;
                        const prefix = FIELD_KEY_PREFIXES[fieldForm.field_context] || FIELD_KEY_PREFIXES.projeto;
                        const slug = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
                        setFieldForm(p => ({
                          ...p,
                          title,
                          ...(!editingField && slug ? { field_key: `${prefix}_${slug}` } : {}),
                        }));
                      }}
                      placeholder="Exemplo: Wifi"
                    />
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
                      <Input
                        value={fieldForm.field_key}
                        onChange={e => {
                          const raw = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                          setFieldForm(p => ({ ...p, field_key: raw }));
                          setFieldKeyError(null);
                        }}
                        placeholder={`${FIELD_KEY_PREFIXES[fieldForm.field_context] || "cap"}_nome_do_campo`}
                        className={cn("flex-1 font-mono text-xs h-9", fieldKeyError && "border-destructive")}
                        disabled={!!editingField}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        disabled={!fieldForm.field_key}
                        onClick={() => {
                          navigator.clipboard.writeText(`[${fieldForm.field_key}]`);
                          toast({ title: `[${fieldForm.field_key}] copiado!` });
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {fieldKeyError && (
                      <p className="text-[11px] text-destructive mt-0.5">{fieldKeyError}</p>
                    )}
                  </div>
                </div>

                {/* Type (readonly) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tipo</Label>
                  <Input value={FIELD_TYPE_LABELS[normalizeFieldType(fieldForm.field_type)]} readOnly className="bg-muted/30" />
                </div>

                {/* Options for select/multi_select */}
                {OPTION_TYPES.includes(normalizeFieldType(fieldForm.field_type)) && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Valores possíveis</Label>
                    <Textarea
                      value={optionsText}
                      onChange={e => setOptionsText(e.target.value)}
                      placeholder={"Opção 1\nOpção 2\nOpção 3"}
                      rows={4}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Insira um por linha, por exemplo:<br />
                      <span className="text-foreground/70">Opção 1 · Opção 2 · Opção 3</span>
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
                <IconPicker selected={fieldForm.icon} onSelect={icon => setFieldForm(p => ({ ...p, icon }))} />
                {fieldForm.icon && (
                  <Button variant="ghost" size="sm" onClick={() => setFieldForm(p => ({ ...p, icon: "" }))} className="text-xs text-muted-foreground">
                    Remover ícone (usar padrão do tipo)
                  </Button>
                )}
                </div>
              </div>

              {/* ── Card: Comportamento (PROJETO context) ── */}
              {fieldForm.field_context === "projeto" && (
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
                    <Select
                      value={fieldForm.show_on_create ? "sim" : "nao"}
                      onValueChange={v => setFieldForm(p => ({ ...p, show_on_create: v === "sim" }))}
                    >
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
                        <input type="radio" name="fieldVis" checked={fieldForm.visibilityMode === "all"}
                          onChange={() => setFieldForm(p => ({ ...p, visibilityMode: "all", visible_pipeline_ids: [] }))}
                          className="accent-primary" />
                        Todos
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <input type="radio" name="fieldVis" checked={fieldForm.visibilityMode === "some"}
                          onChange={() => setFieldForm(p => ({ ...p, visibilityMode: "some" }))}
                          className="accent-primary" />
                        Alguns
                      </label>
                    </div>
                  </div>

                  {/* Pipeline selector when "Alguns" */}
                  {fieldForm.visibilityMode === "some" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Funil</Label>
                      <Select onValueChange={v => {
                        if (!fieldForm.visible_pipeline_ids.includes(v)) {
                          setFieldForm(p => ({ ...p, visible_pipeline_ids: [...p.visible_pipeline_ids, v] }));
                        }
                      }}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Selecione uma opção" /></SelectTrigger>
                        <SelectContent>
                          {pipelines.filter(p => !fieldForm.visible_pipeline_ids.includes(p.id)).map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldForm.visible_pipeline_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {fieldForm.visible_pipeline_ids.map(pid => {
                            const p = pipelines.find(pp => pp.id === pid);
                            return p ? (
                              <Badge key={pid} variant="default" className="gap-1 text-xs">
                                {p.name}
                                <button type="button" onClick={() => setFieldForm(prev => ({
                                  ...prev, visible_pipeline_ids: prev.visible_pipeline_ids.filter(x => x !== pid)
                                }))} className="ml-0.5 hover:text-destructive">×</button>
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stage multi-select for important/required */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StageMultiSelect
                      label="Campo importante em etapa do funil:"
                      stages={stages}
                      pipelines={pipelines}
                      selectedIds={fieldForm.important_stage_ids}
                      onChange={ids => setFieldForm(p => ({ ...p, important_stage_ids: ids }))}
                    />
                    <StageMultiSelect
                      label="Campo obrigatório em etapa do funil:"
                      stages={stages}
                      pipelines={pipelines}
                      selectedIds={fieldForm.required_stage_ids}
                      onChange={ids => setFieldForm(p => ({ ...p, required_stage_ids: ids }))}
                    />
                  </div>
                  </div>
                </div>
              )}

              {/* ── Card: Comportamento (PRE/POS DIMENSIONAMENTO context) ── */}
              {(fieldForm.field_context === "pre_dimensionamento" || fieldForm.field_context === "pos_dimensionamento") && (
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
                    <Select
                      value={fieldForm.required_on_proposal ? "sim" : "nao"}
                      onValueChange={v => setFieldForm(p => ({ ...p, required_on_proposal: v === "sim" }))}
                    >
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

          {/* Footers outside scroll area */}
          {fieldWizardStep === "config" && (
              <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
                <Button variant="ghost" onClick={() => setFieldDialogOpen(false)}>Fechar</Button>
                <Button onClick={handleSaveField} disabled={!fieldForm.title.trim() || !fieldForm.field_key.trim() || saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  {editingField ? "Salvar" : "Cadastrar"}
                </Button>
              </DialogFooter>
          )}
          {fieldWizardStep === "type" && (
            <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
              <Button variant="ghost" onClick={() => setFieldDialogOpen(false)}>Fechar</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Tipo de Atividade ═══ */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editingActivity ? "Editar Tipo" : "Criar Tipo de Atividade"}</DialogTitle>
            <DialogDescription>Defina o nome, visibilidade e ícone</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input value={activityForm.title} onChange={e => setActivityForm(p => ({ ...p, title: e.target.value }))} placeholder="Digite o nome do tipo da atividade" />
            </div>

            {/* Visibilidade em funis */}
            <div className="space-y-2">
              <Label className="text-xs text-foreground font-medium">Visibilidade em funis?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input type="radio" name="visMode" checked={activityForm.visibilityMode === "all"}
                    onChange={() => setActivityForm(p => ({ ...p, visibilityMode: "all", pipeline_ids: [] }))}
                    className="accent-primary" />
                  Todos
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input type="radio" name="visMode" checked={activityForm.visibilityMode === "some"}
                    onChange={() => setActivityForm(p => ({ ...p, visibilityMode: "some" }))}
                    className="accent-primary" />
                  Alguns
                </label>
              </div>
            </div>

            {/* Funil selector */}
            {activityForm.visibilityMode === "some" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Funil</Label>
                <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg bg-muted/30 min-h-[38px]">
                  {activityForm.pipeline_ids.map(pid => {
                    const p = pipelines.find(pp => pp.id === pid);
                    return p ? (
                      <Badge key={pid} variant="default" className="gap-1 text-xs">
                        {p.name}
                        <Button variant="ghost" size="icon" onClick={() => setActivityForm(prev => ({
                          ...prev, pipeline_ids: prev.pipeline_ids.filter(x => x !== pid)
                        }))} className="ml-0.5 hover:text-destructive h-auto w-auto p-0">×</Button>
                      </Badge>
                    ) : null;
                  })}
                  {pipelines.filter(p => !activityForm.pipeline_ids.includes(p.id)).length > 0 && (
                    <Select onValueChange={v => setActivityForm(prev => ({
                      ...prev, pipeline_ids: [...prev.pipeline_ids, v]
                    }))}>
                      <SelectTrigger className="h-7 w-auto border-dashed text-xs gap-1">
                        <SelectValue placeholder="+ Adicionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelines.filter(p => !activityForm.pipeline_ids.includes(p.id)).map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}

            {/* Ícone */}
            <div className="space-y-1.5">
              <Label className="text-xs">Ícone</Label>
              <IconPicker selected={activityForm.icon} onSelect={icon => setActivityForm(p => ({ ...p, icon }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActivityDialogOpen(false)}>Fechar</Button>
            <Button onClick={handleSaveActivity} disabled={!activityForm.title.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingActivity ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Motivo de Perda ═══ */}
      <Dialog open={motivoDialogOpen} onOpenChange={setMotivoDialogOpen}>
        <DialogContent className="w-[90vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingMotivo ? "Editar Motivo" : "Novo Motivo de Perda"}</DialogTitle>
            <DialogDescription>Defina o motivo de perda</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo *</Label>
              <Input value={motivoForm.nome} onChange={e => setMotivoForm({ nome: e.target.value })} placeholder="Ex: Preço alto" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMotivoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveMotivo} disabled={!motivoForm.nome.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingMotivo ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Premissas Tab (embedded from PremissasPage) ───
import { TabFinanceiras } from "@/components/admin/premissas/tabs/TabFinanceiras";
import { TabSistemaSolar } from "@/components/admin/premissas/tabs/TabSistemaSolar";
import { TabAreaTelhado } from "@/components/admin/premissas/tabs/TabAreaTelhado";
import { TabValoresPadroes } from "@/components/admin/premissas/tabs/TabValoresPadroes";
import { TabTributacao } from "@/components/admin/premissas/tabs/TabTributacao";
import { PremissasFooter } from "@/components/admin/premissas/PremissasFooter";

function PremissasTabContent({ ctx }: { ctx: ReturnType<typeof useTenantPremises> }) {
  const [subTab, setSubTab] = useState("financeiras");

  const PREMISSA_TABS = [
    { value: "financeiras", label: "Financeiras", icon: DollarSign },
    { value: "sistema-solar", label: "Sistema solar", icon: Calendar },
    { value: "area-telhado", label: "Área útil por tipo de telhado", icon: LayoutGrid },
    { value: "valores-padroes", label: "Valores padrões", icon: Sliders },
    { value: "tributacao", label: "Tributação", icon: Landmark },
  ] as const;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Parâmetros financeiros, técnicos e valores padrões para dimensionamento e propostas.
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        {PREMISSA_TABS.map((t) => {
          const Icon = t.icon;
          return (
             <Button
                key={t.value}
                variant={subTab === t.value ? "secondary" : "outline"}
                size="sm"
                onClick={() => setSubTab(t.value)}
                className="shrink-0 gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </Button>
          );
        })}
      </div>

      {subTab === "financeiras" && <TabFinanceiras premises={ctx.premises} onChange={ctx.setPremises} />}
      {subTab === "sistema-solar" && <TabSistemaSolar premises={ctx.premises} onChange={ctx.setPremises} />}
      {subTab === "area-telhado" && (
        <TabAreaTelhado roofFactors={ctx.roofFactors} onSave={ctx.saveRoofFactors} saving={ctx.saving} />
      )}
      {subTab === "valores-padroes" && <TabValoresPadroes premises={ctx.premises} onChange={ctx.setPremises} />}
      {subTab === "tributacao" && <TabTributacao />}

      {subTab !== "area-telhado" && subTab !== "tributacao" && (
        <PremissasFooter isDirty={ctx.isDirty} saving={ctx.saving} onSave={ctx.save} onCancel={ctx.reset} />
      )}
    </div>
  );
}

// ─── Stage Multi-Select ───
function StageMultiSelect({ label, stages, pipelines, selectedIds, onChange }: {
  label: string;
  stages: StageInfo[];
  pipelines: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const grouped = pipelines.map(p => ({
    ...p,
    stages: stages.filter(s => s.pipeline_id === p.id),
  }));
  const selectedNames = selectedIds.map(id => stages.find(s => s.id === id)?.name || "?");
  const summary = selectedIds.length === 0 ? "Nenhum" : `Múltiplos (${selectedIds.length})`;

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };
  const toggleAll = (checked: boolean) => {
    onChange(checked ? stages.map(s => s.id) : []);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="relative">
        <Button
          variant="outline"
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between h-9 px-3 text-sm"
        >
          <span className="truncate">{summary}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
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
                    <input type="checkbox" checked={selectedIds.includes(s.id)}
                      onChange={() => toggle(s.id)} className="accent-primary rounded" />
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

// ─── Helpers ───
function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SwitchCell({ value, fieldId, column, onUpdate }: { value: boolean; fieldId: string; column: string; onUpdate: () => void }) {
  const toggleMutation = useToggleCustomField();
  const [checked, setChecked] = useState(value);
  useEffect(() => { setChecked(value); }, [value]);
  return (
    <Switch
      checked={checked}
      onCheckedChange={async (v) => {
        setChecked(v);
        try {
          await toggleMutation.mutateAsync({ id: fieldId, column, value: v });
          onUpdate();
        } catch { setChecked(value); }
      }}
      className="scale-75"
    />
  );
}

// ─── Sortable Row for DnD (pos_dimensionamento only) ───
function SortableFieldRow({
  field: f, index: i, contextFilter, pipelines, stages, onEdit, onDelete,
}: {
  field: CustomField; index: number; contextFilter: string;
  pipelines: { id: string; name: string }[];
  stages: { id: string; name: string; pipeline_id: string; position: number }[];
  onEdit: (f: CustomField) => void; onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const toPascal = (s: string) => s.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  const CustomIcon = f.icon ? (icons as any)[toPascal(f.icon)] : null;
  const FallbackIcon = FIELD_TYPE_ICONS[normalizeFieldType(f.field_type)] || Type;
  const RowIcon = CustomIcon || FallbackIcon;

  return (
    <tr ref={setNodeRef} style={style} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
      <td className="px-4 py-2.5">
        <Button variant="ghost" size="sm" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing flex items-center gap-1.5 text-muted-foreground hover:text-foreground h-auto p-0">
          <GripVertical className="h-4 w-4" />
          <span className="text-xs">{i + 1}</span>
        </Button>
      </td>
      <td className="px-4 py-2.5 font-medium">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <RowIcon className="h-3.5 w-3.5 text-primary" />
          </div>
          {f.title}
        </div>
      </td>
      <td className="px-4 py-2.5">
        <Button variant="ghost" size="sm" className="group inline-flex items-center gap-1 h-auto py-0.5 px-1"
          onClick={() => { navigator.clipboard.writeText(`[${f.field_key}]`); toast({ title: `[${f.field_key}] copiado!` }); }}>
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">[{f.field_key}]</code>
          <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Button>
      </td>
      <td className="px-4 py-2.5">
        <Badge variant="outline" className="text-[10px]">{FIELD_TYPE_LABELS[normalizeFieldType(f.field_type)] || f.field_type}</Badge>
      </td>
      <td className="text-center px-2"><SwitchCell value={f.required_on_proposal} fieldId={f.id} column="required_on_proposal" onUpdate={() => {}} /></td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(f)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(f.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Icon Picker ───
import { icons } from "lucide-react";

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
  // Convert kebab to PascalCase for icons lookup
  const toPascal = (s: string) => s.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");

  return (
    <div className="grid grid-cols-10 gap-1.5 p-3 border rounded-xl bg-muted/10 max-h-[160px] overflow-y-auto">
      {ICON_PICKER_LIST.map(name => {
        const Icon = (icons as any)[toPascal(name)];
        if (!Icon) return null;
        const isSelected = selected === name;
        return (
          <Button
            key={name}
            variant="ghost"
            type="button"
            size="icon"
            onClick={() => onSelect(name)}
            className={cn(
              "w-8 h-8 rounded-lg",
              isSelected
                ? "bg-primary/15 text-primary ring-2 ring-primary/30 shadow-sm scale-110"
                : "hover:bg-primary/10 text-muted-foreground hover:text-primary hover:shadow-sm hover:scale-105"
            )}
            title={name}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
