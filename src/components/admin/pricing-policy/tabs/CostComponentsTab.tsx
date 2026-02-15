import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Layers, GripVertical, Lock } from "lucide-react";

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

    // composite / rule_based — JSON editor
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

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Componentes de Custo</h3>
          <span className="text-xs text-muted-foreground">({components.length})</span>
        </div>
        {!isReadOnly && (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        )}
        {isReadOnly && (
          <StatusBadge variant="muted" dot>
            <Lock className="h-3 w-3" /> Somente leitura
          </StatusBadge>
        )}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum componente de custo configurado para esta versão.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <Card key={category} className="border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {category}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Componente</TableHead>
                    <TableHead>Estratégia</TableHead>
                    <TableHead>Parâmetros</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    {!isReadOnly && <TableHead className="w-20"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => {
                    const strat = STRATEGIES.find((s) => s.value === c.calculation_strategy);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-muted-foreground/40">
                          <GripVertical className="h-3.5 w-3.5" />
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="text-sm font-medium">{c.name}</span>
                            {c.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant="info" className="text-[10px]">
                            {strat?.label || c.calculation_strategy}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground max-w-[200px] truncate">
                          {formatParams(c.calculation_strategy, c.parameters)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={c.is_active ? "success" : "muted"} dot>
                            {c.is_active ? "Ativo" : "Inativo"}
                          </StatusBadge>
                        </TableCell>
                        {!isReadOnly && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
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
  if (strategy === "fixed_amount") return `R$ ${params.amount ?? 0}`;
  if (strategy === "cost_per_kwp") return `${params.unit_cost ?? 0} R$/kWp`;
  if (strategy === "cost_per_kva") return `${params.unit_cost ?? 0} R$/kVA`;
  if (strategy === "cost_per_km") return `${params.unit_cost ?? 0} R$/km`;
  if (strategy === "percentage_of_cost") return `${params.percentage ?? 0}%`;
  return JSON.stringify(params).slice(0, 50);
}
