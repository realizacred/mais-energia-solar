/**
 * PlanoServicoManager — CRUD page for service plans with feature checklist.
 * §26 header, §4 table, §25 modal, §12 skeleton.
 */
import { useState, useEffect } from "react";
import { usePlanosServico, useSavePlanoServico, useDeletePlanoServico, type PlanoServico } from "@/hooks/usePlanosServico";
import { usePlanoFeatures, useSavePlanoFeatures } from "@/hooks/usePlanoFeatures";
import { PLAN_FEATURE_CATALOG, CATEGORY_LABELS, getFeaturesByCategory } from "@/lib/planoFeatureCatalog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CreditCard, Plus, MoreHorizontal, Pencil, Trash2, Loader2, Monitor, Bell, FileBarChart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/formatters/index";

const TIPOS = [
  { value: "monitoramento", label: "Monitoramento" },
  { value: "manutencao", label: "Manutenção" },
  { value: "consultoria", label: "Consultoria" },
  { value: "outro", label: "Outro" },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  portal: <Monitor className="w-4 h-4" />,
  automacao: <Bell className="w-4 h-4" />,
  relatorio: <FileBarChart className="w-4 h-4" />,
};

export default function PlanoServicoManager() {
  const { toast } = useToast();
  const { data: planos = [], isLoading } = usePlanosServico();
  const savePlano = useSavePlanoServico();
  const deletePlano = useDeletePlanoServico();
  const saveFeatures = useSavePlanoFeatures();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlanoServico | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", valor: "", tipo: "monitoramento", ativo: true });
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());

  // Load features when editing
  const { data: existingFeatures = [] } = usePlanoFeatures(editing?.id ?? null);

  useEffect(() => {
    if (editing && existingFeatures.length > 0) {
      setSelectedFeatures(new Set(existingFeatures.filter(f => f.enabled).map(f => f.feature_key)));
    }
  }, [editing, existingFeatures]);

  function handleNew() {
    setEditing(null);
    setForm({ nome: "", descricao: "", valor: "", tipo: "monitoramento", ativo: true });
    setSelectedFeatures(new Set(PLAN_FEATURE_CATALOG.map(f => f.key))); // All enabled by default
    setFormOpen(true);
  }

  function handleEdit(p: PlanoServico) {
    setEditing(p);
    setForm({ nome: p.nome, descricao: p.descricao || "", valor: String(p.valor), tipo: p.tipo, ativo: p.ativo });
    // Features will load via useEffect
    setFormOpen(true);
  }

  function toggleFeature(key: string) {
    setSelectedFeatures(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCategory(category: string) {
    const catKeys = PLAN_FEATURE_CATALOG.filter(f => f.category === category).map(f => f.key);
    const allSelected = catKeys.every(k => selectedFeatures.has(k));
    setSelectedFeatures(prev => {
      const next = new Set(prev);
      catKeys.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    const valor = parseFloat(form.valor);
    if (isNaN(valor) || valor <= 0) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    try {
      const result = await savePlano.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        valor,
        tipo: form.tipo,
        ativo: form.ativo,
      });

      // Save features
      const planoId = editing?.id || (result as any)?.id;
      if (planoId) {
        await saveFeatures.mutateAsync({
          planoId,
          enabledKeys: Array.from(selectedFeatures),
        });
      }

      toast({ title: editing ? "Plano atualizado" : "Plano criado" });
      setFormOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePlano.mutateAsync(id);
      toast({ title: "Plano removido" });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err?.message, variant: "destructive" });
    }
  }

  const featuresByCategory = getFeaturesByCategory();

  return (
    <div className="space-y-6">
      {/* Header §26 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Planos de Serviço</h1>
            <p className="text-sm text-muted-foreground">Configure os planos disponíveis para clientes</p>
          </div>
        </div>
        <Button size="sm" onClick={handleNew}>
          <Plus className="w-4 h-4 mr-1" /> Novo Plano
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : planos.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <CreditCard className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground">Nenhum plano cadastrado</p>
          <p className="text-sm text-muted-foreground">Crie um plano para vincular às UCs e cobrar clientes</p>
          <Button size="sm" onClick={handleNew}><Plus className="w-4 h-4 mr-1" /> Criar Plano</Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Nome</TableHead>
                <TableHead className="font-semibold text-foreground">Tipo</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Valor</TableHead>
                <TableHead className="font-semibold text-foreground">Features</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {planos.map((p) => (
                <PlanoRow key={p.id} plano={p} onEdit={handleEdit} onDelete={handleDelete} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Modal §25 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {editing ? "Editar Plano" : "Novo Plano"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure nome, valor e funcionalidades incluídas
              </p>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-5">
              {/* Basic fields */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome <span className="text-destructive">*</span></Label>
                  <Input value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Monitoramento Pro" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} placeholder="Descrição do plano..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor (R$) <span className="text-destructive">*</span></Label>
                    <CurrencyInput value={Number(form.valor) || 0} onChange={(v) => setForm(f => ({ ...f, valor: String(v) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm(f => ({ ...f, tipo: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Plano ativo</Label>
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm(f => ({ ...f, ativo: v }))} />
                </div>
              </div>

              <Separator />

              {/* Feature checklist */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Funcionalidades incluídas</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Selecione o que o cliente terá acesso neste plano
                  </p>
                </div>

                {Object.entries(featuresByCategory).map(([category, features]) => {
                  const catKeys = features.map(f => f.key);
                  const allSelected = catKeys.every(k => selectedFeatures.has(k));
                  const someSelected = catKeys.some(k => selectedFeatures.has(k));

                  return (
                    <div key={category} className="rounded-lg border border-border overflow-hidden">
                      {/* Category header */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                        onClick={() => toggleCategory(category)}
                      >
                        <Checkbox
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onCheckedChange={() => toggleCategory(category)}
                          className="shrink-0"
                        />
                        <div className="flex items-center gap-2 text-foreground">
                          {CATEGORY_ICONS[category]}
                          <span className="text-sm font-medium">{CATEGORY_LABELS[category]}</span>
                        </div>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {catKeys.filter(k => selectedFeatures.has(k)).length}/{catKeys.length}
                        </Badge>
                      </div>
                      {/* Feature items */}
                      <div className="divide-y divide-border">
                        {features.map(f => (
                          <label
                            key={f.key}
                            className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                          >
                            <Checkbox
                              checked={selectedFeatures.has(f.key)}
                              onCheckedChange={() => toggleFeature(f.key)}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground">{f.label}</p>
                              <p className="text-xs text-muted-foreground">{f.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <div className="flex-1 text-xs text-muted-foreground">
              {selectedFeatures.size} de {PLAN_FEATURE_CATALOG.length} funcionalidades
            </div>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={savePlano.isPending}>Cancelar</Button>
            <Button onClick={handleSave} disabled={savePlano.isPending || saveFeatures.isPending}>
              {(savePlano.isPending || saveFeatures.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {savePlano.isPending ? "Salvando..." : editing ? "Salvar" : "Criar Plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Row component to show feature count per plan */
function PlanoRow({ plano, onEdit, onDelete }: { plano: PlanoServico; onEdit: (p: PlanoServico) => void; onDelete: (id: string) => void }) {
  const { data: features = [] } = usePlanoFeatures(plano.id);
  const enabledCount = features.filter(f => f.enabled).length;

  return (
    <TableRow className="hover:bg-muted/30 transition-colors">
      <TableCell>
        <div>
          <p className="font-medium text-foreground">{plano.nome}</p>
          {plano.descricao && <p className="text-xs text-muted-foreground truncate max-w-[250px]">{plano.descricao}</p>}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs capitalize">{plano.tipo}</Badge>
      </TableCell>
      <TableCell className="text-right font-mono text-sm">{formatBRL(plano.valor)}</TableCell>
      <TableCell>
        {enabledCount > 0 ? (
          <Badge variant="outline" className="text-xs">
            {enabledCount}/{PLAN_FEATURE_CATALOG.length}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Não configurado</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={plano.ativo ? "default" : "secondary"} className="text-xs">
          {plano.ativo ? "Ativo" : "Inativo"}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(plano)}>
              <Pencil className="w-4 h-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(plano.id)}>
              <Trash2 className="w-4 h-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
