/**
 * PlanoServicoManager — CRUD page for service plans.
 * §26 header, §4 table, §25 modal, §12 skeleton.
 */
import { useState } from "react";
import { usePlanosServico, useSavePlanoServico, useDeletePlanoServico, type PlanoServico } from "@/hooks/usePlanosServico";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CreditCard, Plus, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/formatters/index";

const TIPOS = [
  { value: "monitoramento", label: "Monitoramento" },
  { value: "manutencao", label: "Manutenção" },
  { value: "consultoria", label: "Consultoria" },
  { value: "outro", label: "Outro" },
];

export default function PlanoServicoManager() {
  const { toast } = useToast();
  const { data: planos = [], isLoading } = usePlanosServico();
  const savePlano = useSavePlanoServico();
  const deletePlano = useDeletePlanoServico();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlanoServico | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", valor: "", tipo: "monitoramento", ativo: true });

  function handleNew() {
    setEditing(null);
    setForm({ nome: "", descricao: "", valor: "", tipo: "monitoramento", ativo: true });
    setFormOpen(true);
  }

  function handleEdit(p: PlanoServico) {
    setEditing(p);
    setForm({ nome: p.nome, descricao: p.descricao || "", valor: String(p.valor), tipo: p.tipo, ativo: p.ativo });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    const valor = parseFloat(form.valor);
    if (isNaN(valor) || valor <= 0) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    try {
      await savePlano.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        valor,
        tipo: form.tipo,
        ativo: form.ativo,
      });
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
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {planos.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{p.nome}</p>
                      {p.descricao && <p className="text-xs text-muted-foreground truncate max-w-[250px]">{p.descricao}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">{p.tipo}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatBRL(p.valor)}</TableCell>
                  <TableCell>
                    <Badge variant={p.ativo ? "default" : "secondary"} className="text-xs">
                      {p.ativo ? "Ativo" : "Inativo"}
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
                        <DropdownMenuItem onClick={() => handleEdit(p)}>
                          <Pencil className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Modal §25 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {editing ? "Editar Plano" : "Novo Plano"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure nome, valor e tipo do plano de serviço
              </p>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome <span className="text-destructive">*</span></Label>
                <Input value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Monitoramento Pro" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} placeholder="Descrição do plano..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor (R$) <span className="text-destructive">*</span></Label>
                  <Input type="number" step="0.01" min="0" value={form.valor} onChange={(e) => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="49.90" />
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
          </ScrollArea>

          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={savePlano.isPending}>Cancelar</Button>
            <Button onClick={handleSave} disabled={savePlano.isPending}>
              {savePlano.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {savePlano.isPending ? "Salvando..." : editing ? "Salvar" : "Criar Plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
