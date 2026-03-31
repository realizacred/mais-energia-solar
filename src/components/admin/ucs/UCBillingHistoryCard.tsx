/**
 * UCBillingHistoryCard — Shows billing history for a UC + manual charge.
 * §4 table, §27 empty state, §16 queries in hooks.
 */
import { useState } from "react";
import { useUcCobrancas, useCreateUcCobranca, type UcCobrancaRow } from "@/hooks/useUcBilling";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Receipt, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/formatters/index";
import { formatDateShort } from "@/lib/dateUtils";

interface Props {
  unitId: string;
  clienteId: string | null;
  tenantId: string;
  valorMensalidade: number | null;
  diaVencimento: number | null;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "outline" },
  pago: { label: "Pago", variant: "default" },
  atrasado: { label: "Atrasado", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "secondary" },
};

export function UCBillingHistoryCard({ unitId, clienteId, tenantId, valorMensalidade, diaVencimento }: Props) {
  const { toast } = useToast();
  const { data: cobrancas = [], isLoading } = useUcCobrancas(unitId);
  const createMut = useCreateUcCobranca();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    valor: valorMensalidade ? String(valorMensalidade) : "",
    descricao: "",
    dia_vencimento: diaVencimento ? String(diaVencimento) : "10",
  });

  function handleOpenNew() {
    const now = new Date();
    const mesRef = now.toLocaleString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
    setForm({
      valor: valorMensalidade ? String(valorMensalidade) : "",
      descricao: `Mensalidade — ${mesRef}`,
      dia_vencimento: diaVencimento ? String(diaVencimento) : "10",
    });
    setModalOpen(true);
  }

  async function handleCreate() {
    const valor = parseFloat(form.valor);
    if (isNaN(valor) || valor <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    if (!clienteId) {
      toast({ title: "Cliente não vinculado", description: "Esta UC não possui um cliente associado. Vincule um cliente antes de lançar cobrança.", variant: "destructive" });
      return;
    }
    try {
      await createMut.mutateAsync({
        tenant_id: tenantId,
        cliente_id: clienteId,
        unit_id: unitId,
        valor,
        descricao: form.descricao || "Cobrança manual",
        dia_vencimento: parseInt(form.dia_vencimento, 10) || 10,
      });
      toast({ title: "Cobrança lançada" });
      setModalOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" /> Histórico de Cobranças
            </CardTitle>
            <Button size="sm" variant="outline" onClick={handleOpenNew}>
              <Plus className="w-4 h-4 mr-1" /> Lançar cobrança
            </Button>
          </div>
          <CardDescription>Cobranças vinculadas a esta UC</CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : cobrancas.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma cobrança registrada para esta UC</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Descrição</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Valor</TableHead>
                    <TableHead className="font-semibold text-foreground">Vencimento</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cobrancas.map((c) => {
                    const parcela = c.parcelas?.[0];
                    const st = STATUS_MAP[c.status] || STATUS_MAP.pendente;
                    return (
                      <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-sm text-foreground">{c.descricao || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatBRL(c.valor_total)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {parcela?.data_vencimento ? formatDateShort(parcela.data_vencimento) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal lançar cobrança */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Lançar Cobrança Manual
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cria recebimento + parcela para esta UC
              </p>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Mensalidade — março/2026"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.valor}
                    onChange={(e) => setForm(f => ({ ...f, valor: e.target.value }))}
                    placeholder="49.90"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dia vencimento</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={form.dia_vencimento}
                    onChange={(e) => setForm(f => ({ ...f, dia_vencimento: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={createMut.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {createMut.isPending ? "Lançando..." : "Lançar Cobrança"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
