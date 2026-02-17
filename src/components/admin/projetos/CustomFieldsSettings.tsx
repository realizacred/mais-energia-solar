import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMotivosPerda } from "@/hooks/useDistribution";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Save, Loader2, LayoutGrid, ListOrdered
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  number: "Número",
  date: "Data",
  select: "Seleção",
  boolean: "Sim/Não",
  currency: "Moeda",
  textarea: "Texto longo",
};

const CONTEXT_LABELS: Record<string, string> = {
  projeto: "Projetos",
  pre_dimensionamento: "Pré-dimensionamento",
  pos_dimensionamento: "Pós-dimensionamento",
};

export function CustomFieldsSettings() {
  const [activeTab, setActiveTab] = useState("campos");
  const [fields, setFields] = useState<CustomField[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityType | null>(null);
  const [motivoDialogOpen, setMotivoDialogOpen] = useState(false);
  const [editingMotivo, setEditingMotivo] = useState<MotivoPerda | null>(null);
  const [saving, setSaving] = useState(false);
  const [contextFilter, setContextFilter] = useState("projeto");

  // ─── Use canonical hook for motivos_perda (SSOT) ───
  const { motivos, loading: motivosLoading, upsert: upsertMotivo, remove: removeMotivo } = useMotivosPerda();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fieldsRes, actTypesRes] = await Promise.all([
        supabase.from("deal_custom_fields").select("*").order("ordem"),
        supabase.from("deal_activity_types").select("*").order("ordem"),
      ]);
      if (fieldsRes.data) setFields(fieldsRes.data as any);
      if (actTypesRes.data) setActivityTypes(actTypesRes.data as any);
    } catch (err: any) {
      toast({ title: "Erro ao carregar", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Custom Field CRUD ───
  const [fieldForm, setFieldForm] = useState({
    title: "", field_key: "", field_type: "text", field_context: "projeto",
    show_on_create: false, required_on_create: false,
    visible_on_funnel: false, important_on_funnel: false,
    required_on_funnel: false, required_on_proposal: false,
  });

  const openFieldDialog = (field?: CustomField) => {
    if (field) {
      setEditingField(field);
      setFieldForm({
        title: field.title, field_key: field.field_key, field_type: field.field_type,
        field_context: field.field_context,
        show_on_create: field.show_on_create, required_on_create: field.required_on_create,
        visible_on_funnel: field.visible_on_funnel, important_on_funnel: field.important_on_funnel,
        required_on_funnel: field.required_on_funnel, required_on_proposal: field.required_on_proposal,
      });
    } else {
      setEditingField(null);
      setFieldForm({
        title: "", field_key: "", field_type: "text", field_context: contextFilter,
        show_on_create: false, required_on_create: false,
        visible_on_funnel: false, important_on_funnel: false,
        required_on_funnel: false, required_on_proposal: false,
      });
    }
    setFieldDialogOpen(true);
  };

  const handleSaveField = async () => {
    if (!fieldForm.title.trim() || !fieldForm.field_key.trim()) return;
    setSaving(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").limit(1).single();
      const payload = { ...fieldForm, tenant_id: (profile as any)?.tenant_id };

      if (editingField) {
        const { error } = await supabase.from("deal_custom_fields").update(payload).eq("id", editingField.id);
        if (error) throw error;
        toast({ title: "Campo atualizado" });
      } else {
        const { error } = await supabase.from("deal_custom_fields").insert(payload as any);
        if (error) throw error;
        toast({ title: "Campo criado" });
      }
      setFieldDialogOpen(false);
      loadAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDeleteField = async (id: string) => {
    try {
      await supabase.from("deal_custom_fields").delete().eq("id", id);
      setFields(prev => prev.filter(f => f.id !== id));
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
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);

  // Load pipelines for the funnel selector
  useEffect(() => {
    supabase.from("pipelines").select("id, name").order("created_at").then(({ data }) => {
      if (data) setPipelines(data);
    });
  }, []);

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
      const { data: profile } = await supabase.from("profiles").select("tenant_id").limit(1).single();
      const payload = {
        title: activityForm.title,
        visible_on_funnel: activityForm.visible_on_funnel,
        icon: activityForm.icon || "circle-dot",
        pipeline_ids: activityForm.visibilityMode === "all" ? [] : activityForm.pipeline_ids,
        tenant_id: (profile as any)?.tenant_id,
      };
      if (editingActivity) {
        await supabase.from("deal_activity_types").update(payload as any).eq("id", editingActivity.id);
        toast({ title: "Tipo atualizado" });
      } else {
        await supabase.from("deal_activity_types").insert(payload as any);
        toast({ title: "Tipo criado" });
      }
      setActivityDialogOpen(false);
      loadAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDeleteActivity = async (id: string) => {
    try {
      await supabase.from("deal_activity_types").delete().eq("id", id);
      setActivityTypes(prev => prev.filter(a => a.id !== id));
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
    removeMotivo(id);
  };

  const filteredFields = fields.filter(f => f.field_context === contextFilter);

  if (loading || motivosLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Opções Customizáveis
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Personalize campos, tipos de atividade e motivos de perda do seu CRM
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campos" className="gap-1.5">
            <LayoutGrid className="h-4 w-4" />Campos Customizados
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
              <button
                key={key}
                onClick={() => setContextFilter(key)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                  contextFilter === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
            <div className="flex-1" />
            <Button size="sm" onClick={() => openFieldDialog()} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Novo Campo
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {filteredFields.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <LayoutGrid className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm font-medium">Nenhum campo customizado</p>
                  <p className="text-xs mt-1">Crie campos para personalizar seus {CONTEXT_LABELS[contextFilter].toLowerCase()}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
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
                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground">Funil</th>
                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground">Importante</th>
                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground">Obrig. funil</th>
                          </>
                        )}
                        {(contextFilter === "pre_dimensionamento" || contextFilter === "pos_dimensionamento") && (
                          <th className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground">Obrig. proposta</th>
                        )}
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFields.map((f, i) => (
                        <tr key={f.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                              <span className="text-xs text-muted-foreground">{i + 1}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-medium">{f.title}</td>
                          <td className="px-4 py-2.5"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{f.field_key}</code></td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className="text-[10px]">{FIELD_TYPE_LABELS[f.field_type] || f.field_type}</Badge>
                          </td>
                          {contextFilter === "projeto" && (
                            <>
                              <td className="text-center px-2"><SwitchCell value={f.show_on_create} fieldId={f.id} column="show_on_create" onUpdate={loadAll} /></td>
                              <td className="text-center px-2"><SwitchCell value={f.required_on_create} fieldId={f.id} column="required_on_create" onUpdate={loadAll} /></td>
                              <td className="text-center px-2"><SwitchCell value={f.visible_on_funnel} fieldId={f.id} column="visible_on_funnel" onUpdate={loadAll} /></td>
                              <td className="text-center px-2"><SwitchCell value={f.important_on_funnel} fieldId={f.id} column="important_on_funnel" onUpdate={loadAll} /></td>
                              <td className="text-center px-2"><SwitchCell value={f.required_on_funnel} fieldId={f.id} column="required_on_funnel" onUpdate={loadAll} /></td>
                            </>
                          )}
                          {(contextFilter === "pre_dimensionamento" || contextFilter === "pos_dimensionamento") && (
                            <td className="text-center px-2"><SwitchCell value={f.required_on_proposal} fieldId={f.id} column="required_on_proposal" onUpdate={loadAll} /></td>
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
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: Tipos de Atividades ═══ */}
        <TabsContent value="atividades" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Configure os tipos de atividade disponíveis nos projetos</p>
            <Button size="sm" onClick={() => openActivityDialog()} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Novo Tipo
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {activityTypes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Zap className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm font-medium">Nenhum tipo de atividade customizado</p>
                  <p className="text-xs mt-1">Os tipos padrão do sistema serão usados</p>
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
                          <div className="flex items-center gap-1.5">
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                            <span className="text-xs text-muted-foreground">{i + 1}</span>
                          </div>
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
      </Tabs>

      {/* ═══ Dialog: Campo Customizado ═══ */}
      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingField ? "Editar Campo" : "Novo Campo Customizado"}</DialogTitle>
            <DialogDescription>Configure as propriedades do campo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Título *</Label>
                <Input value={fieldForm.title} onChange={e => setFieldForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Potência desejada" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Chave (identificador) *</Label>
                <Input value={fieldForm.field_key} onChange={e => setFieldForm(p => ({ ...p, field_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))} placeholder="Ex: potencia_desejada" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={fieldForm.field_type} onValueChange={v => setFieldForm(p => ({ ...p, field_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contexto</Label>
                <Select value={fieldForm.field_context} onValueChange={v => setFieldForm(p => ({ ...p, field_context: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTEXT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {fieldForm.field_context === "projeto" && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  <SwitchRow label="Mostrar em novo projeto" checked={fieldForm.show_on_create} onChange={v => setFieldForm(p => ({ ...p, show_on_create: v }))} />
                  <SwitchRow label="Obrigatório ao criar" checked={fieldForm.required_on_create} onChange={v => setFieldForm(p => ({ ...p, required_on_create: v }))} />
                  <SwitchRow label="Visível nos funis" checked={fieldForm.visible_on_funnel} onChange={v => setFieldForm(p => ({ ...p, visible_on_funnel: v }))} />
                  <SwitchRow label="Importante no funil" checked={fieldForm.important_on_funnel} onChange={v => setFieldForm(p => ({ ...p, important_on_funnel: v }))} />
                  <SwitchRow label="Obrigatório no funil" checked={fieldForm.required_on_funnel} onChange={v => setFieldForm(p => ({ ...p, required_on_funnel: v }))} />
                </div>
              </>
            )}
            {(fieldForm.field_context === "pre_dimensionamento" || fieldForm.field_context === "pos_dimensionamento") && (
              <>
                <Separator />
                <SwitchRow label="Obrigatório na proposta" checked={fieldForm.required_on_proposal} onChange={v => setFieldForm(p => ({ ...p, required_on_proposal: v }))} />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveField} disabled={!fieldForm.title.trim() || !fieldForm.field_key.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingField ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Tipo de Atividade ═══ */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="sm:max-w-md">
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
              <Label className="text-xs text-primary font-medium">Visibilidade em funis?</Label>
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
                        <button onClick={() => setActivityForm(prev => ({
                          ...prev, pipeline_ids: prev.pipeline_ids.filter(x => x !== pid)
                        }))} className="ml-0.5 hover:text-destructive">×</button>
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
            <Button variant="outline" onClick={() => setActivityDialogOpen(false)}>Fechar</Button>
            <Button onClick={handleSaveActivity} disabled={!activityForm.title.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingActivity ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog: Motivo de Perda ═══ */}
      <Dialog open={motivoDialogOpen} onOpenChange={setMotivoDialogOpen}>
        <DialogContent className="sm:max-w-sm">
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
            <Button variant="outline" onClick={() => setMotivoDialogOpen(false)}>Cancelar</Button>
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
  const [checked, setChecked] = useState(value);
  return (
    <Switch
      checked={checked}
      onCheckedChange={async (v) => {
        setChecked(v);
        try {
          await supabase.from("deal_custom_fields").update({ [column]: v } as any).eq("id", fieldId);
        } catch { setChecked(value); }
      }}
      className="scale-75"
    />
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
    <div className="grid grid-cols-10 gap-1 p-2 border rounded-lg bg-muted/20 max-h-[140px] overflow-y-auto">
      {ICON_PICKER_LIST.map(name => {
        const Icon = (icons as any)[toPascal(name)];
        if (!Icon) return null;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onSelect(name)}
            className={cn(
              "w-8 h-8 rounded-md flex items-center justify-center transition-all",
              selected === name
                ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
            title={name}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
