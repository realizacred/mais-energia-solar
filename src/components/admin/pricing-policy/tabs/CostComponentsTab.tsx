import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Layers, GripVertical, Lock, Package, Wrench, Truck, Building2, Receipt, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface CostComponent {
  id: string;
  category: string;
  name: string;
  calculation_strategy: string;
  parameters: Record<string, any>;
  display_order: number;
  is_active: boolean;
  description: string | null;
}

interface Props {
  versionId: string;
  isReadOnly: boolean;
}

const STRATEGIES = [
  { value: "fixed_amount", label: "Valor Fixo", hint: "Valor absoluto em R$" },
  { value: "cost_per_kwp", label: "R$/kWp", hint: "Custo proporcional à potência" },
  { value: "cost_per_kva", label: "R$/kVA", hint: "Custo proporcional à potência aparente" },
  { value: "cost_per_km", label: "R$/km", hint: "Custo proporcional à distância" },
  { value: "percentage_of_cost", label: "% do Custo", hint: "Percentual sobre custo base" },
  { value: "composite", label: "Composto", hint: "Múltiplas fórmulas combinadas" },
  { value: "rule_based", label: "Condicional", hint: "Regras avançadas com condições" },
];

const CATEGORIES = [
  "Equipamentos",
  "Serviços",
  "Logística",
  "Administrativo",
  "Impostos",
  "Seguros",
  "Outros",
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Equipamentos: Package,
  Serviços: Wrench,
  Logística: Truck,
  Administrativo: Building2,
  Impostos: Receipt,
  Seguros: ShieldCheck,
};

function getStrategyStyle(strategy: string) {
  switch (strategy) {
    case "cost_per_kwp":
    case "cost_per_kva":
    case "cost_per_km":
      return "bg-info/10 text-info border-info/20";
    case "fixed_amount":
      return "bg-secondary/10 text-secondary border-secondary/20";
    case "percentage_of_cost":
      return "bg-primary/10 text-primary border-primary/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

const EMPTY_FORM: Omit<CostComponent, "id"> = {
  category: "Equipamentos",
  name: "",
  calculation_strategy: "fixed_amount",
  parameters: {},
  display_order: 0,
  is_active: true,
  description: null,
};

export function CostComponentsTab({ versionId, isReadOnly }: Props) {
  const [components, setComponents] = useState<CostComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadComponents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pricing_cost_components")
      .select("id, category, name, calculation_strategy, parameters, display_order, is_active, description")
      .eq("version_id", versionId)
      .order("display_order", { ascending: true });

    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setComponents((data as unknown as CostComponent[]) || []);
    setLoading(false);
  }, [versionId]);

  useEffect(() => { loadComponents(); }, [loadComponents]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, display_order: components.length });
    setDialogOpen(true);
  }

  function openEdit(c: CostComponent) {
    setEditingId(c.id);
    setForm({
      category: c.category,
      name: c.name,
      calculation_strategy: c.calculation_strategy,
      parameters: c.parameters,
      display_order: c.display_order,
      is_active: c.is_active,
      description: c.description,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);

    const payload = {
      version_id: versionId,
      category: form.category,
      name: form.name.trim(),
      calculation_strategy: form.calculation_strategy,
      parameters: form.parameters,
      display_order: form.display_order,
      is_active: form.is_active,
      description: form.description || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("pricing_cost_components")
        .update(payload as any)
        .eq("id", editingId);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Componente atualizado" });
    } else {
      const { error } = await supabase
        .from("pricing_cost_components")
        .insert(payload as any);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Componente adicionado" });
    }

    setSaving(false);
    setDialogOpen(false);
    loadComponents();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("pricing_cost_components").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Componente removido" });
      loadComponents();
    }
  }

  function renderParameterFields() {
    const strategy = form.calculation_strategy;

    if (strategy === "fixed_amount") {
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">Valor (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.parameters.amount ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, parameters: { ...f.parameters, amount: parseFloat(e.target.value) || 0 } }))}
          />
        </div>
      );
    }

    if (["cost_per_kwp", "cost_per_kva", "cost_per_km"].includes(strategy)) {
      const unit = strategy === "cost_per_kwp" ? "R$/kWp" : strategy === "cost_per_kva" ? "R$/kVA" : "R$/km";
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">Valor unitário ({unit})</Label>
          <Input
            type="number"
            step="0.01"
            value={form.parameters.unit_cost ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, parameters: { ...f.parameters, unit_cost: parseFloat(e.target.value) || 0 } }))}
          />
        </div>
      );
    }

    if (strategy === "percentage_of_cost") {
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">Percentual (%)</Label>
          <Input
            type="number"
            step="0.1"
            value={form.parameters.percentage ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, parameters: { ...f.parameters, percentage: parseFloat(e.target.value) || 0 } }))}
          />
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        <Label className="text-xs">Parâmetros (JSON)</Label>
        <textarea
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono min-h-[80px]"
          value={JSON.stringify(form.parameters, null, 2)}
          onChange={(e) => {
            try {
              setForm((f) => ({ ...f, parameters: JSON.parse(e.target.value) }));
            } catch { /* ignore parse errors while typing */ }
          }}
        />
      </div>
    );
  }

  // Group by category
  const grouped = components.reduce<Record<string, CostComponent[]>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  // Maintain category order
  const orderedCategories = CATEGORIES.filter((cat) => grouped[cat]);
  // Add any categories not in the predefined list
  Object.keys(grouped).forEach((cat) => {
    if (!orderedCategories.includes(cat)) orderedCategories.push(cat);
  });

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Componentes de Custo</h3>
          <span className="text-xs text-muted-foreground">({components.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {isReadOnly && (
            <StatusBadge variant="muted" dot>
              <Lock className="h-3 w-3" /> Somente leitura
            </StatusBadge>
          )}
          {!isReadOnly && (
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {orderedCategories.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum componente de custo configurado para esta versão.
          </CardContent>
        </Card>
      ) : (
        /* Dense list inside single card */
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-0">
            {/* Column headers */}
            <div className="grid grid-cols-12 gap-4 items-center px-4 py-2.5 border-b border-border bg-muted/30">
              <div className="col-span-5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Componente
              </div>
              <div className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Estratégia
              </div>
              <div className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Parâmetros
              </div>
              <div className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </div>
              <div className="col-span-1" />
            </div>

            {orderedCategories.map((category) => {
              const items = grouped[category];
              const CategoryIcon = CATEGORY_ICONS[category] || Layers;

              return (
                <div key={category}>
                  {/* Category header */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/20 border-b border-border/50">
                    <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      {category}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">({items.length})</span>
                  </div>

                  {/* Items */}
                  {items.map((c, idx) => {
                    const strat = STRATEGIES.find((s) => s.value === c.calculation_strategy);
                    const isLast = idx === items.length - 1;

                    return (
                      <div
                        key={c.id}
                        className={cn(
                          "grid grid-cols-12 gap-4 items-center px-4 py-3 transition-colors hover:bg-muted/10",
                          !isLast && "border-b border-border/30",
                          !c.is_active && "opacity-50"
                        )}
                      >
                        {/* Component name + description (col-span-5) */}
                        <div className="col-span-5 flex items-center gap-3 min-w-0">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 cursor-grab" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                            {c.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{c.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Strategy badge (col-span-2) */}
                        <div className="col-span-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-medium px-2 py-0.5 whitespace-nowrap",
                              getStrategyStyle(c.calculation_strategy)
                            )}
                          >
                            {strat?.label || c.calculation_strategy}
                          </Badge>
                        </div>

                        {/* Parameters (col-span-2) */}
                        <div className="col-span-2">
                          <span className="text-sm font-mono text-foreground">
                            {formatParams(c.calculation_strategy, c.parameters)}
                          </span>
                        </div>

                        {/* Status (col-span-2) */}
                        <div className="col-span-2">
                          <StatusBadge variant={c.is_active ? "success" : "muted"} dot>
                            {c.is_active ? "Ativo" : "Inativo"}
                          </StatusBadge>
                        </div>

                        {/* Actions (col-span-1) */}
                        <div className="col-span-1 flex justify-end gap-0.5">
                          {!isReadOnly && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Componente" : "Novo Componente de Custo"}</DialogTitle>
            <DialogDescription>
              Configure a estratégia de cálculo. O motor de precificação consumirá esses parâmetros.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Mão de obra elétrica"
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Estratégia de Cálculo</Label>
              <Select value={form.calculation_strategy} onValueChange={(v) => setForm((f) => ({ ...f, calculation_strategy: v, parameters: {} }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <div>
                        <span>{s.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">— {s.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {renderParameterFields()}

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input
                value={form.description || ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))}
                placeholder="Nota interna sobre este componente"
                className="text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label className="text-xs text-muted-foreground">Componente ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatParams(strategy: string, params: Record<string, any>): string {
  if (strategy === "fixed_amount") return `R$ ${(params.amount ?? 0).toLocaleString("pt-BR")}`;
  if (strategy === "cost_per_kwp") return `${params.unit_cost ?? 0} R$/kWp`;
  if (strategy === "cost_per_kva") return `${params.unit_cost ?? 0} R$/kVA`;
  if (strategy === "cost_per_km") return `${params.unit_cost ?? 0} R$/km`;
  if (strategy === "percentage_of_cost") return `${params.percentage ?? 0}%`;
  return JSON.stringify(params).slice(0, 50);
}
