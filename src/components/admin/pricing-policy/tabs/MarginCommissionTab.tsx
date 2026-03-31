import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { toast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Percent, Wallet } from "lucide-react";
import {
  useMarginPlans, useSaveMarginPlan, useDeleteMarginPlan,
  useCommissionPlans, useSaveCommissionPlan, useDeleteCommissionPlan,
  type MarginPlan, type CommissionPlan,
} from "@/hooks/usePricingPolicy";

const COMMISSION_TYPES = [
  { value: "fixed", label: "Valor Fixo" },
  { value: "percentage", label: "Percentual" },
  { value: "dynamic", label: "Dinâmico" },
];

export function MarginCommissionTab() {
  const { data: marginPlans = [], isLoading: loadingMargin } = useMarginPlans();
  const { data: commissionPlans = [], isLoading: loadingCommission } = useCommissionPlans();
  const saveMarginMut = useSaveMarginPlan();
  const deleteMarginMut = useDeleteMarginPlan();
  const saveCommissionMut = useSaveCommissionPlan();
  const deleteCommissionMut = useDeleteCommissionPlan();
  const loading = loadingMargin || loadingCommission;

  // Margin dialog
  const [marginDialog, setMarginDialog] = useState(false);
  const [marginEditId, setMarginEditId] = useState<string | null>(null);
  const [marginForm, setMarginForm] = useState({ name: "", description: "", min_margin_percent: 10, max_margin_percent: 50, default_margin_percent: 25, is_active: true });

  // Commission dialog
  const [commissionDialog, setCommissionDialog] = useState(false);
  const [commissionEditId, setCommissionEditId] = useState<string | null>(null);
  const [commissionForm, setCommissionForm] = useState<{ name: string; description: string; commission_type: string; parameters: Record<string, any>; is_active: boolean }>({ name: "", description: "", commission_type: "percentage", parameters: { percentual: 5 }, is_active: true });

  // ── Margin CRUD ──
  function openMarginCreate() {
    setMarginEditId(null);
    setMarginForm({ name: "", description: "", min_margin_percent: 10, max_margin_percent: 50, default_margin_percent: 25, is_active: true });
    setMarginDialog(true);
  }
  function openMarginEdit(m: MarginPlan) {
    setMarginEditId(m.id);
    setMarginForm({ name: m.name, description: m.description || "", min_margin_percent: m.min_margin_percent, max_margin_percent: m.max_margin_percent, default_margin_percent: m.default_margin_percent, is_active: m.is_active });
    setMarginDialog(true);
  }
  async function saveMargin() {
    const payload = { name: marginForm.name.trim(), description: marginForm.description || null, min_margin_percent: marginForm.min_margin_percent, max_margin_percent: marginForm.max_margin_percent, default_margin_percent: marginForm.default_margin_percent, is_active: marginForm.is_active };
    saveMarginMut.mutate({ id: marginEditId || undefined, data: payload }, {
      onSuccess: () => { toast({ title: marginEditId ? "Plano de margem atualizado" : "Plano de margem criado" }); setMarginDialog(false); },
      onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  }
  function deleteMargin(id: string) {
    deleteMarginMut.mutate(id, {
      onSuccess: () => toast({ title: "Plano removido" }),
      onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  }

  // ── Commission CRUD ──
  function openCommissionCreate() {
    setCommissionEditId(null);
    setCommissionForm({ name: "", description: "", commission_type: "percentage", parameters: { percentual: 5 }, is_active: true });
    setCommissionDialog(true);
  }
  function openCommissionEdit(c: CommissionPlan) {
    setCommissionEditId(c.id);
    setCommissionForm({ name: c.name, description: c.description || "", commission_type: c.commission_type, parameters: c.parameters, is_active: c.is_active });
    setCommissionDialog(true);
  }
  function saveCommission() {
    const payload = { name: commissionForm.name.trim(), description: commissionForm.description || null, commission_type: commissionForm.commission_type, parameters: commissionForm.parameters, is_active: commissionForm.is_active };
    saveCommissionMut.mutate({ id: commissionEditId || undefined, data: payload }, {
      onSuccess: () => { toast({ title: commissionEditId ? "Plano de comissão atualizado" : "Plano de comissão criado" }); setCommissionDialog(false); },
      onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  }
  function deleteCommission(id: string) {
    deleteCommissionMut.mutate(id, {
      onSuccess: () => toast({ title: "Plano removido" }),
      onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  }

  const marginSaving = saveMarginMut.isPending;
  const commissionSaving = saveCommissionMut.isPending;

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ── MARGIN PLANS ── */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" />
              Planos de Margem
            </CardTitle>
            <Button size="sm" className="gap-1.5" onClick={openMarginCreate}>
              <Plus className="h-3.5 w-3.5" /> Novo Plano
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Defina faixas de margem reutilizáveis. Usuários herdam planos — não configurações individuais.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {marginPlans.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhum plano de margem.</div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Margem Mín.</TableHead>
                  <TableHead>Margem Máx.</TableHead>
                  <TableHead>Padrão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marginPlans.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <span className="text-sm font-medium">{m.name}</span>
                      {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                    </TableCell>
                    <TableCell className="text-sm font-mono">{m.min_margin_percent}%</TableCell>
                    <TableCell className="text-sm font-mono">{m.max_margin_percent}%</TableCell>
                    <TableCell className="text-sm font-mono font-semibold">{m.default_margin_percent}%</TableCell>
                    <TableCell><StatusBadge variant={m.is_active ? "success" : "muted"} dot>{m.is_active ? "Ativo" : "Inativo"}</StatusBadge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMarginEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMargin(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── COMMISSION PLANS ── */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Planos de Comissão
            </CardTitle>
            <Button size="sm" className="gap-1.5" onClick={openCommissionCreate}>
              <Plus className="h-3.5 w-3.5" /> Novo Plano
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Regras de comissão atribuíveis a consultores. Suporta valor fixo, percentual ou fórmulas dinâmicas.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {commissionPlans.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhum plano de comissão.</div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Parâmetros</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionPlans.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="text-sm font-medium">{c.name}</span>
                      {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant="info" className="text-[10px]">
                        {COMMISSION_TYPES.find((t) => t.value === c.commission_type)?.label || c.commission_type}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {c.commission_type === "percentage" ? `${c.parameters.rate ?? 0}%` : c.commission_type === "fixed" ? `R$ ${c.parameters.amount ?? 0}` : JSON.stringify(c.parameters).slice(0, 40)}
                    </TableCell>
                    <TableCell><StatusBadge variant={c.is_active ? "success" : "muted"} dot>{c.is_active ? "Ativo" : "Inativo"}</StatusBadge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCommissionEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCommission(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── MARGIN DIALOG ── */}
      <Dialog open={marginDialog} onOpenChange={setMarginDialog}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{marginEditId ? "Editar Plano de Margem" : "Novo Plano de Margem"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Nome</Label><Input value={marginForm.name} onChange={(e) => setMarginForm((f) => ({ ...f, name: e.target.value }))} className="text-sm" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Descrição</Label><Input value={marginForm.description} onChange={(e) => setMarginForm((f) => ({ ...f, description: e.target.value }))} className="text-sm" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Mín. %</Label><Input type="number" step="0.1" value={marginForm.min_margin_percent} onChange={(e) => setMarginForm((f) => ({ ...f, min_margin_percent: parseFloat(e.target.value) || 0 }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Máx. %</Label><Input type="number" step="0.1" value={marginForm.max_margin_percent} onChange={(e) => setMarginForm((f) => ({ ...f, max_margin_percent: parseFloat(e.target.value) || 0 }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Padrão %</Label><Input type="number" step="0.1" value={marginForm.default_margin_percent} onChange={(e) => setMarginForm((f) => ({ ...f, default_margin_percent: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={marginForm.is_active} onCheckedChange={(v) => setMarginForm((f) => ({ ...f, is_active: v }))} /><Label className="text-xs text-muted-foreground">Ativo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMarginDialog(false)}>Cancelar</Button>
            <Button variant="default" onClick={saveMargin} disabled={marginSaving || !marginForm.name.trim()} className="gap-2">{marginSaving && <Loader2 className="h-4 w-4 animate-spin" />}{marginEditId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── COMMISSION DIALOG ── */}
      <Dialog open={commissionDialog} onOpenChange={setCommissionDialog}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{commissionEditId ? "Editar Plano de Comissão" : "Novo Plano de Comissão"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Nome</Label><Input value={commissionForm.name} onChange={(e) => setCommissionForm((f) => ({ ...f, name: e.target.value }))} className="text-sm" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Descrição</Label><Input value={commissionForm.description} onChange={(e) => setCommissionForm((f) => ({ ...f, description: e.target.value }))} className="text-sm" /></div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={commissionForm.commission_type} onValueChange={(v) => setCommissionForm((f) => ({ ...f, commission_type: v, parameters: v === "percentage" ? { percentual: 5 } : v === "fixed" ? { amount: 500 } : {} }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{COMMISSION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {commissionForm.commission_type === "percentage" && (
              <div className="space-y-1.5"><Label className="text-xs">Percentual (%)</Label><Input type="number" step="0.1" value={commissionForm.parameters.percentual ?? 5} onChange={(e) => setCommissionForm((f) => ({ ...f, parameters: { ...f.parameters, percentual: parseFloat(e.target.value) || 0 } }))} /></div>
            )}
            {commissionForm.commission_type === "fixed" && (
              <div className="space-y-1.5"><Label className="text-xs">Valor (R$)</Label><Input type="number" step="0.01" value={commissionForm.parameters.amount ?? 500} onChange={(e) => setCommissionForm((f) => ({ ...f, parameters: { amount: parseFloat(e.target.value) || 0 } }))} /></div>
            )}
            {commissionForm.commission_type === "dynamic" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Parâmetros (JSON)</Label>
                <textarea className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono min-h-[80px]" value={JSON.stringify(commissionForm.parameters, null, 2)} onChange={(e) => { try { setCommissionForm((f) => ({ ...f, parameters: JSON.parse(e.target.value) })); } catch { /* ignore invalid JSON */ } }} />
              </div>
            )}
            <div className="flex items-center gap-2"><Switch checked={commissionForm.is_active} onCheckedChange={(v) => setCommissionForm((f) => ({ ...f, is_active: v }))} /><Label className="text-xs text-muted-foreground">Ativo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCommissionDialog(false)}>Cancelar</Button>
            <Button variant="default" onClick={saveCommission} disabled={commissionSaving || !commissionForm.name.trim()} className="gap-2">{commissionSaving && <Loader2 className="h-4 w-4 animate-spin" />}{commissionEditId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
