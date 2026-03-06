/**
 * UCInvoicesTab — Invoices list for a UC with upload support.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoiceService, type UnitInvoice } from "@/services/invoiceService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText } from "lucide-react";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Props {
  unitId: string;
}

export function UCInvoicesTab({ unitId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    reference_month: new Date().getMonth() + 1,
    reference_year: new Date().getFullYear(),
    total_amount: "",
    energy_consumed_kwh: "",
    energy_injected_kwh: "",
    due_date: "",
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["unit_invoices", unitId],
    queryFn: () => invoiceService.listByUnit(unitId),
  });

  const createMut = useMutation({
    mutationFn: () => invoiceService.create({
      unit_id: unitId,
      reference_month: form.reference_month,
      reference_year: form.reference_year,
      total_amount: form.total_amount ? parseFloat(form.total_amount) : null,
      energy_consumed_kwh: form.energy_consumed_kwh ? parseFloat(form.energy_consumed_kwh) : null,
      energy_injected_kwh: form.energy_injected_kwh ? parseFloat(form.energy_injected_kwh) : null,
      due_date: form.due_date || null,
      source: "manual",
    } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unit_invoices", unitId] });
      setDialogOpen(false);
      toast({ title: "Fatura registrada" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err?.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Faturas</h3>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-1" /> Registrar Fatura</Button>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : invoices.length === 0 ? (
        <EmptyState icon="FileText" title="Nenhuma fatura" description="Registre manualmente ou configure o recebimento por e-mail." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Consumo (kWh)</TableHead>
                <TableHead>Injeção (kWh)</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{MONTHS[inv.reference_month - 1]}/{inv.reference_year}</TableCell>
                  <TableCell className="text-sm">{inv.due_date ? new Date(inv.due_date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell className="text-sm">{inv.total_amount != null ? `R$ ${inv.total_amount.toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-sm">{inv.energy_consumed_kwh != null ? `${inv.energy_consumed_kwh.toFixed(1)}` : "—"}</TableCell>
                  <TableCell className="text-sm">{inv.energy_injected_kwh != null ? `${inv.energy_injected_kwh.toFixed(1)}` : "—"}</TableCell>
                  <TableCell><StatusBadge variant="muted">{inv.source || "manual"}</StatusBadge></TableCell>
                  <TableCell><StatusBadge variant={inv.status === "processed" ? "success" : "warning"} dot>{inv.status}</StatusBadge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Fatura</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Mês</Label><Input type="number" min={1} max={12} value={form.reference_month} onChange={(e) => setForm(f => ({ ...f, reference_month: parseInt(e.target.value) || 1 }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Ano</Label><Input type="number" value={form.reference_year} onChange={(e) => setForm(f => ({ ...f, reference_year: parseInt(e.target.value) || 2024 }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Valor (R$)</Label><Input type="number" step="0.01" value={form.total_amount} onChange={(e) => setForm(f => ({ ...f, total_amount: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Vencimento</Label><Input type="date" value={form.due_date} onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Consumo (kWh)</Label><Input type="number" step="0.1" value={form.energy_consumed_kwh} onChange={(e) => setForm(f => ({ ...f, energy_consumed_kwh: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Injeção (kWh)</Label><Input type="number" step="0.1" value={form.energy_injected_kwh} onChange={(e) => setForm(f => ({ ...f, energy_injected_kwh: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>{createMut.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
