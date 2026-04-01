import { useState, useEffect } from "react";
import { ReceiptText, Plus, Search, Loader2, Send, Eye, XCircle, Download, RefreshCw, FileText } from "lucide-react";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  useFiscalInvoices,
  useFiscalMunicipalServices,
  useFiscalSettings,
  useFiscalInvoiceEvents,
  useCreateFiscalInvoice,
} from "@/hooks/useFiscalEmissao";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  validating: { label: "Validando", color: "bg-info/10 text-info" },
  scheduled: { label: "Agendada", color: "bg-warning/10 text-warning" },
  synchronized: { label: "Sincronizada", color: "bg-info/10 text-info" },
  authorized: { label: "Autorizada", color: "bg-success/10 text-success" },
  processing_cancellation: { label: "Cancelando", color: "bg-warning/10 text-warning" },
  canceled: { label: "Cancelada", color: "bg-destructive/10 text-destructive" },
  cancellation_denied: { label: "Cancel. Negado", color: "bg-destructive/10 text-destructive" },
  error: { label: "Erro", color: "bg-destructive/10 text-destructive" },
};

export function FiscalEmissao() {
  const { data: invoices = [], isLoading: loading } = useFiscalInvoices();
  const { data: services = [] } = useFiscalMunicipalServices();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);

  const filtered = invoices.filter(inv =>
    !search || inv.service_description?.toLowerCase().includes(search.toLowerCase()) ||
    inv.invoice_number?.includes(search) || inv.municipal_service_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <SectionCard icon={ReceiptText} title="Notas Fiscais de Serviço" description="Crie, agende e acompanhe suas NFS-e"
        actions={<Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" />Nova NFS-e</Button>}
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por descrição, número..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={ReceiptText} title="Nenhuma nota fiscal" description="Clique em 'Nova NFS-e' para criar sua primeira nota." />
          ) : (
            <div className="space-y-2">
              {filtered.map(inv => {
                const st = STATUS_LABELS[inv.status] || STATUS_LABELS.draft;
                return (
                  <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setShowDetail(inv)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inv.service_description || "Sem descrição"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">R$ {Number(inv.value).toFixed(2)}</span>
                        {inv.invoice_number && <span className="text-xs text-muted-foreground">Nº {inv.invoice_number}</span>}
                        <span className="text-xs text-muted-foreground">{format(new Date(inv.created_at), "dd/MM/yyyy")}</span>
                      </div>
                    </div>
                    <Badge className={cn("text-[10px]", st.color)}>{st.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>

      {showCreate && <CreateInvoiceDialog services={services} open={showCreate} onClose={() => setShowCreate(false)} />}
      {showDetail && <InvoiceDetailDialog invoice={showDetail} open={!!showDetail} onClose={() => setShowDetail(null)} />}
    </div>
  );
}

// ── Create Invoice Dialog ──
function CreateInvoiceDialog({ services, open, onClose }: { services: any[]; open: boolean; onClose: () => void }) {
  const { data: defaults } = useFiscalSettings();
  const createMutation = useCreateFiscalInvoice();
  const [form, setForm] = useState({
    service_description: "",
    observations: "",
    value: "",
    deductions: "",
    effective_date: new Date().toISOString().split("T")[0],
    municipal_service_id: "",
    municipal_service_code: "",
    municipal_service_name: "",
    taxes: { retainIss: false, iss: 0, cofins: 0, csll: 0, inss: 0, ir: 0, pis: 0 },
  });

  // Apply defaults when loaded
  useEffect(() => {
    if (defaults) {
      setForm(prev => ({
        ...prev,
        service_description: defaults.default_service_description || "",
        observations: defaults.default_observations || "",
        taxes: (defaults.default_taxes as any) || prev.taxes,
      }));
    }
  }, [defaults]);

  const handleServiceSelect = (svcId: string) => {
    const svc = services.find(s => s.id === svcId);
    if (svc) {
      setForm(prev => ({
        ...prev,
        municipal_service_id: svc.asaas_service_id || "",
        municipal_service_code: svc.service_code || "",
        municipal_service_name: svc.service_name || "",
      }));
    }
  };

  const handleSave = async () => {
    if (!form.service_description || !form.value) { toast.error("Descrição e valor são obrigatórios"); return; }
    try {
      await createMutation.mutateAsync({
        service_description: form.service_description,
        observations: form.observations || null,
        value: parseFloat(form.value),
        deductions: form.deductions ? parseFloat(form.deductions) : 0,
        effective_date: form.effective_date,
        municipal_service_id: form.municipal_service_id || null,
        municipal_service_code: form.municipal_service_code || null,
        municipal_service_name: form.municipal_service_name || null,
        taxes: form.taxes,
      });
      toast.success("Rascunho criado!");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <FormModalTemplate
      open={open}
      onOpenChange={v => !v && onClose()}
      title="Nova NFS-e"
      icon={FileText}
      subtitle="Emita documentos fiscais"
      submitLabel="Criar Rascunho"
      onSubmit={handleSave}
      saving={createMutation.isPending}
    >
          <div className="space-y-2">
            <Label>Serviço Municipal</Label>
            <Select onValueChange={handleServiceSelect}>
              <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
              <SelectContent>
                {services.map(s => <SelectItem key={s.id} value={s.id}>{s.service_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição do Serviço *</Label>
            <Textarea value={form.service_description} onChange={e => setForm(p => ({ ...p, service_description: e.target.value }))} rows={3} />
          </div>
          <FormGrid>
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Deduções (R$)</Label>
              <Input type="number" step="0.01" value={form.deductions} onChange={e => setForm(p => ({ ...p, deductions: e.target.value }))} />
            </div>
          </FormGrid>
          <div className="space-y-2">
            <Label>Data Efetiva</Label>
            <DateInput value={form.effective_date} onChange={v => setForm(p => ({ ...p, effective_date: v }))} />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} rows={2} />
          </div>
    </FormModalTemplate>
  );
}

// ── Invoice Detail Dialog ──
function InvoiceDetailDialog({ invoice, open, onClose }: { invoice: any; open: boolean; onClose: () => void }) {
  const [scheduling, setScheduling] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const { data: events = [] } = useFiscalInvoiceEvents(invoice?.id || null);

  const handleSchedule = async () => {
    setScheduling(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiscal-invoice-schedule", { body: { invoice_id: invoice.id } });
      if (error) throw error;
      if (data.success) {
        toast.success("Nota agendada com sucesso!");
        onClose();
      } else {
        toast.error(data.error || "Erro ao agendar");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setScheduling(false);
    }
  };

  const handleCancel = async () => {
    setCanceling(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiscal-invoice-cancel", { body: { invoice_id: invoice.id } });
      if (error) throw error;
      if (data.success) {
        toast.success("Cancelamento solicitado!");
        onClose();
      } else {
        toast.error(data.error || "Erro ao cancelar");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCanceling(false);
    }
  };

  const st = STATUS_LABELS[invoice?.status] || STATUS_LABELS.draft;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            NFS-e {invoice?.invoice_number ? `#${invoice.invoice_number}` : "(rascunho)"}
            <Badge className={cn("text-[10px]", st.color)}>{st.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground text-xs">Valor</span><p className="font-semibold">R$ {Number(invoice?.value || 0).toFixed(2)}</p></div>
            <div><span className="text-muted-foreground text-xs">Data Efetiva</span><p className="font-medium">{invoice?.effective_date}</p></div>
          </div>

          <div className="text-sm">
            <span className="text-muted-foreground text-xs">Descrição</span>
            <p className="mt-0.5">{invoice?.service_description || "-"}</p>
          </div>

          {invoice?.municipal_service_name && (
            <div className="text-sm">
              <span className="text-muted-foreground text-xs">Serviço Municipal</span>
              <p className="mt-0.5">{invoice.municipal_service_name}</p>
            </div>
          )}

          {invoice?.error_message && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <p className="text-xs text-destructive font-medium">Erro: {invoice.error_message}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {invoice?.status === "draft" && (
              <Button size="sm" onClick={handleSchedule} disabled={scheduling} className="gap-1.5">
                {scheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Agendar no Asaas
              </Button>
            )}
            {invoice?.status === "error" && (
              <Button size="sm" onClick={handleSchedule} disabled={scheduling} className="gap-1.5">
                {scheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Tentar Novamente
              </Button>
            )}
            {(invoice?.status === "scheduled" || invoice?.status === "synchronized" || invoice?.status === "authorized") && (
              <Button size="sm" variant="ghost" onClick={handleCancel} disabled={canceling} className="gap-1.5">
                {canceling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Cancelar Nota
              </Button>
            )}
            {invoice?.pdf_url && (
              <Button size="sm" variant="outline" asChild className="gap-1.5">
                <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" />PDF</a>
              </Button>
            )}
            {invoice?.xml_url && (
              <Button size="sm" variant="outline" asChild className="gap-1.5">
                <a href={invoice.xml_url} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" />XML</a>
              </Button>
            )}
          </div>

          {/* Timeline */}
          {events.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Linha do Tempo</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {events.map(ev => (
                  <div key={ev.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/30 text-xs">
                    <Badge variant="outline" className="text-[9px] shrink-0">{ev.event_source}</Badge>
                    <span className="font-medium">{ev.event_type}</span>
                    <span className="text-muted-foreground ml-auto">{format(new Date(ev.created_at), "dd/MM HH:mm")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}