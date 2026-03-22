/**
 * UCInvoicesTab — Invoices list for a UC with manual registration, PDF upload, and expandable detail rows.
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoiceService, type UnitInvoice, type BandeiraTarifaria } from "@/services/invoiceService";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/storagePaths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Upload, Mail, ExternalLink, Eye, Loader2, Trash2, MoreHorizontal, ChevronDown, ChevronRight, RefreshCw, Bug, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";
import { uploadInvoiceTempPdf } from "@/services/invoiceUploadService";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const BANDEIRA_LABELS: Record<string, string> = {
  verde: "Verde",
  amarela: "Amarela",
  vermelha_1: "Vermelha 1",
  vermelha_2: "Vermelha 2",
};

const BANDEIRA_COLORS: Record<string, string> = {
  verde: "border-success text-success",
  amarela: "border-warning text-warning",
  vermelha_1: "border-destructive text-destructive",
  vermelha_2: "border-destructive text-destructive",
};

/** Detail fields label */
function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value != null && value !== "" ? String(value) : "—";
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-foreground">{display}</p>
    </div>
  );
}

function InvoiceDetailPanel({ invoice, raw }: { invoice: UnitInvoice; raw: Record<string, any> | null }) {
  const fmtNum = (v: number | null | undefined, suffix = "") => v != null ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${suffix}` : null;
  const fmtBRL = (v: number | null | undefined) => v != null ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;

  return (
    <div className="px-6 py-4 space-y-4">
      {/* Leituras */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2">Leituras do Medidor</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <DetailField label="Leitura Anterior 03" value={fmtNum(raw?.leitura_anterior_03)} />
          <DetailField label="Leitura Atual 03" value={fmtNum(raw?.leitura_atual_03)} />
          <DetailField label="Consumo (kWh)" value={fmtNum(invoice.energy_consumed_kwh, " kWh")} />
          <DetailField label="Leitura Anterior 103" value={fmtNum(raw?.leitura_anterior_103)} />
          <DetailField label="Leitura Atual 103" value={fmtNum(raw?.leitura_atual_103)} />
          <DetailField label="Injeção (kWh)" value={fmtNum(invoice.energy_injected_kwh, " kWh")} />
        </div>
      </div>

      <Separator />

      {/* Energia e Saldo */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2">Energia e Créditos</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <DetailField label="Compensado (kWh)" value={fmtNum(invoice.compensated_kwh, " kWh")} />
          <DetailField label="Saldo Anterior (kWh)" value={fmtNum(invoice.previous_balance_kwh, " kWh")} />
          <DetailField label="Saldo Atual (kWh)" value={fmtNum(invoice.current_balance_kwh, " kWh")} />
          <DetailField label="Saldo GD Acumulado" value={fmtNum(raw?.saldo_gd_acumulado, " kWh")} />
          <DetailField label="Categoria GD" value={raw?.categoria_gd} />
          <DetailField label="Confiança da extração" value={raw?.confidence != null ? `${raw.confidence}%` : null} />
        </div>
      </div>

      <Separator />

      {/* Financeiro */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2">Financeiro</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <DetailField label="Valor Total" value={fmtBRL(invoice.total_amount)} />
          <DetailField label="Tarifa Energia" value={raw?.tarifa_energia_kwh != null ? `R$ ${raw.tarifa_energia_kwh}` : null} />
          <DetailField label="TUSD/Fio B" value={raw?.tarifa_fio_b_kwh != null ? `R$ ${raw.tarifa_fio_b_kwh}` : null} />
          <DetailField label="ICMS" value={raw?.icms_percentual != null ? `${raw.icms_percentual}%` : null} />
          <DetailField label="PIS" value={fmtBRL(raw?.pis_valor)} />
          <DetailField label="COFINS" value={fmtBRL(raw?.cofins_valor)} />
        </div>
      </div>

      <Separator />

      {/* Dados da UC */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2">Dados Extraídos</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <DetailField label="Concessionária" value={raw?.concessionaria_nome} />
          <DetailField label="Nº UC" value={raw?.numero_uc} />
          <DetailField label="Classe" value={raw?.classe_consumo} />
          <DetailField label="Tipo Ligação" value={raw?.tipo_ligacao} />
          <DetailField label="Próxima Leitura" value={raw?.proxima_leitura_data} />
          <DetailField label="Suporte de IA" value={raw?.ai_fallback_used ? "Sim" : "Não"} />
        </div>
      </div>

      {/* Demanda (if applicable) */}
      {(invoice.demanda_contratada_kw || invoice.demanda_medida_kw) && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Demanda (Grupo A)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DetailField label="Contratada" value={fmtNum(invoice.demanda_contratada_kw, " kW")} />
              <DetailField label="Medida" value={fmtNum(invoice.demanda_medida_kw, " kW")} />
              <DetailField label="Ultrapassagem" value={fmtNum(invoice.ultrapassagem_kw, " kW")} />
              <DetailField label="Multa" value={fmtBRL(invoice.multa_ultrapassagem)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface Props {
  unitId: string;
}

export function UCInvoicesTab({ unitId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  /** Invalidate all UC-related queries for instant updates across tabs */
  const invalidateAllUcQueries = () => {
    qc.invalidateQueries({ queryKey: ["unit_invoices", unitId] });
    qc.invalidateQueries({ queryKey: ["uc_overview_invoices", unitId] });
    qc.invalidateQueries({ queryKey: ["uc_overview_credit_sum", unitId] });
    qc.invalidateQueries({ queryKey: ["uc_overview_timeline", unitId] });
    qc.invalidateQueries({ queryKey: ["uc_proxima_leitura", unitId] });
    qc.invalidateQueries({ queryKey: ["uc_energia_resumo", unitId] });
    qc.invalidateQueries({ queryKey: ["uc_detail", unitId] });
    qc.invalidateQueries({ queryKey: ["gd_monthly_snapshot"] });
    qc.invalidateQueries({ queryKey: ["gd_credit_balances"] });
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [debugInvoice, setDebugInvoice] = useState<UnitInvoice | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    reference_month: new Date().getMonth() + 1,
    reference_year: new Date().getFullYear(),
    total_amount: "",
    energy_consumed_kwh: "",
    energy_injected_kwh: "",
    compensated_kwh: "",
    previous_balance_kwh: "",
    current_balance_kwh: "",
    due_date: "",
    pdf_file: null as File | null,
    demanda_contratada_kw: "",
    demanda_medida_kw: "",
    ultrapassagem_kw: "",
    multa_ultrapassagem: "",
    bandeira_tarifaria: "" as string,
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["unit_invoices", unitId],
    queryFn: () => invoiceService.listByUnit(unitId),
    staleTime: 1000 * 60 * 5,
  });

  const uploadPdf = async (file: File): Promise<string | null> => {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) throw new Error("Tenant não encontrado");
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${tenantId}/${form.reference_year}/${String(form.reference_month).padStart(2, "0")}/${unitId}.${ext}`;
    const { error } = await supabase.storage.from("faturas-energia").upload(path, file, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) throw error;
    const { data: signedData } = await supabase.storage.from("faturas-energia").createSignedUrl(path, 86400);
    return signedData?.signedUrl || null;
  };

  const parseNum = (v: string) => v ? parseFloat(v) : null;

  const createMut = useMutation({
    mutationFn: async () => {
      let pdfUrl: string | null = null;
      if (form.pdf_file) {
        pdfUrl = await uploadPdf(form.pdf_file);
      }
      return invoiceService.create({
        unit_id: unitId,
        reference_month: form.reference_month,
        reference_year: form.reference_year,
        total_amount: parseNum(form.total_amount),
        energy_consumed_kwh: parseNum(form.energy_consumed_kwh),
        energy_injected_kwh: parseNum(form.energy_injected_kwh),
        compensated_kwh: parseNum(form.compensated_kwh),
        previous_balance_kwh: parseNum(form.previous_balance_kwh),
        current_balance_kwh: parseNum(form.current_balance_kwh),
        due_date: form.due_date || null,
        pdf_file_url: pdfUrl,
        source: "manual",
        demanda_contratada_kw: parseNum(form.demanda_contratada_kw),
        demanda_medida_kw: parseNum(form.demanda_medida_kw),
        ultrapassagem_kw: parseNum(form.ultrapassagem_kw),
        multa_ultrapassagem: parseNum(form.multa_ultrapassagem),
        bandeira_tarifaria: (form.bandeira_tarifaria || null) as BandeiraTarifaria | null,
      } as any);
    },
    onSuccess: () => {
      invalidateAllUcQueries();
      setDialogOpen(false);
      resetForm();
      toast({ title: "Fatura registrada com sucesso" });
    },
    onError: (err: any) => toast({ title: "Erro ao registrar fatura", description: err?.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => invoiceService.delete(id),
    onSuccess: () => {
      invalidateAllUcQueries();
      toast({ title: "Fatura excluída com sucesso" });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast({ title: "Erro ao excluir fatura", description: err?.message, variant: "destructive" }),
  });

  const handleFileUploadOnly = async (file: File) => {
    setUploading(true);
    setUploadProgress(10);
    setUploadStep("Enviando PDF...");
    try {
      const pdfStoragePath = await uploadInvoiceTempPdf(file);

      setUploadProgress(45);
      setUploadStep("Extraindo dados da fatura...");

      const data = await invokeEdgeFunction<any>("process-fatura-pdf", {
        body: {
          pdf_storage_path: pdfStoragePath,
          unit_id: unitId,
          source: "import",
        },
        headers: { "x-client-timeout": "120" },
      });

      if (!data?.data?.invoice_id) {
        throw new Error("Os dados foram extraídos, mas a fatura não foi salva.");
      }

      setUploadProgress(90);
      setUploadStep("Finalizando...");

      const parsed = data?.data?.parsed;
      const fieldsExtracted = parsed
        ? [parsed.consumo_kwh && "consumo", parsed.valor_total && "valor", parsed.vencimento && "vencimento", parsed.saldo_gd && "saldo GD"].filter(Boolean)
        : [];

      setUploadProgress(100);
      setUploadStep("Concluído!");
      invalidateAllUcQueries();

      if (fieldsExtracted.length > 0) {
        toast({ title: "Fatura importada e processada", description: `Dados extraídos: ${fieldsExtracted.join(", ")}` });
      } else {
        toast({ title: "PDF importado", description: "Não foi possível extrair dados automaticamente. Verifique se o PDF não é uma imagem escaneada." });
      }
    } catch (err: any) {
      console.error("[UCInvoicesTab] Erro no processamento:", err);
      toast({ title: "Erro ao processar fatura", description: err?.message, variant: "destructive" });
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        setUploadStep("");
      }, 1200);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const resetForm = () => {
    setForm({
      reference_month: new Date().getMonth() + 1,
      reference_year: new Date().getFullYear(),
      total_amount: "",
      energy_consumed_kwh: "",
      energy_injected_kwh: "",
      compensated_kwh: "",
      previous_balance_kwh: "",
      current_balance_kwh: "",
      due_date: "",
      pdf_file: null,
      demanda_contratada_kw: "",
      demanda_medida_kw: "",
      ultrapassagem_kw: "",
      multa_ultrapassagem: "",
      bandeira_tarifaria: "",
    });
  };

  const handleReprocess = async (invoiceId: string) => {
    setReprocessingId(invoiceId);
    try {
      const result = await invokeEdgeFunction<any>("process-fatura-pdf", {
        body: {
          force_reprocess: true,
          invoice_id: invoiceId,
        },
      });
      if (result?.success) {
        toast({ title: "Fatura reprocessada", description: `Parser v${result.data?.parser_version || '?'} — dados atualizados.` });
        invalidateAllUcQueries();
      } else {
        toast({ title: "Reprocessamento falhou", description: result?.error || "Erro desconhecido", variant: "destructive" });
        invalidateAllUcQueries();
      }
    } catch (err: any) {
      toast({ title: "Erro ao reprocessar", description: err?.message, variant: "destructive" });
      invalidateAllUcQueries();
    } finally {
      setReprocessingId(null);
    }
  };

  const SOURCE_LABELS: Record<string, string> = {
    manual: "Manual",
    email: "E-mail",
    gmail: "Gmail",
    import: "Importação PDF",
    upload: "Upload",
  };

  const STATUS_LABELS: Record<string, string> = {
    pending: "Pendente",
    processed: "Processada",
    received: "Recebida",
    error: "Erro",
  };

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-medium text-foreground">Faturas</h3>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const MAX_SIZE_MB = 10;
                if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                  toast({ title: `Arquivo muito grande (máx ${MAX_SIZE_MB}MB)`, description: "Reduza o tamanho do PDF antes de importar.", variant: "destructive" });
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  return;
                }
                handleFileUploadOnly(file);
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-4 h-4 mr-1" />
            {uploading ? "Enviando..." : "Importar PDF"}
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Registrar Fatura
          </Button>
        </div>
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
            <div className="flex-1 space-y-1.5">
              <p className="text-xs font-medium text-foreground">{uploadStep}</p>
              <Progress value={uploadProgress} className="h-2" />
            </div>
            <span className="text-xs text-muted-foreground font-mono">{uploadProgress}%</span>
          </CardContent>
        </Card>
      )}

      {/* Info card about automatic email */}
      <Card className="border-info/20 bg-info/5">
        <CardContent className="flex items-start gap-3 py-3 px-4">
          <Mail className="w-4 h-4 text-info shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1 flex-1">
            <p>
              <strong>Recebimento automático:</strong> Configure o e-mail da concessionária na aba{" "}
              <strong>Configurações</strong> para receber faturas automaticamente.
              Ou acesse a{" "}
              <Link to="/admin/faturas-energia" className="text-primary underline inline-flex items-center gap-0.5">
                Central de Faturas <ExternalLink className="w-3 h-3" />
              </Link>{" "}
              para configurar a integração Gmail.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhuma fatura" description="Registre manualmente, importe um PDF ou configure o recebimento por e-mail." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Referência</TableHead>
                <TableHead className="font-semibold text-foreground">Vencimento</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Valor</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Consumo</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Injeção</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Saldo</TableHead>
                <TableHead className="font-semibold text-foreground">Bandeira</TableHead>
                <TableHead className="font-semibold text-foreground">Fonte</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const isExpanded = expandedId === inv.id;
                const raw = inv.raw_extraction as Record<string, any> | null;
                return (
                  <>
                    <TableRow
                      key={inv.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                    >
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                          {MONTHS[inv.reference_month - 1]}/{inv.reference_year}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : "—"}</TableCell>
                      <TableCell className="text-sm text-right font-mono">{inv.total_amount != null ? `R$ ${inv.total_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</TableCell>
                      <TableCell className="text-sm text-right">{inv.energy_consumed_kwh != null ? `${inv.energy_consumed_kwh.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh` : "—"}</TableCell>
                      <TableCell className="text-sm text-right">{inv.energy_injected_kwh != null ? `${inv.energy_injected_kwh.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh` : "—"}</TableCell>
                      <TableCell className="text-sm text-right">{inv.current_balance_kwh != null ? `${inv.current_balance_kwh.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh` : "—"}</TableCell>
                      <TableCell>
                        {inv.bandeira_tarifaria ? (
                          <StatusBadge variant="muted" className={BANDEIRA_COLORS[inv.bandeira_tarifaria] || ""}>
                            {BANDEIRA_LABELS[inv.bandeira_tarifaria] || inv.bandeira_tarifaria}
                          </StatusBadge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant="muted">{SOURCE_LABELS[inv.source || "manual"] || inv.source}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <StatusBadge variant={inv.status === "processed" ? "success" : inv.status === "error" ? "destructive" : "warning"} dot>
                            {STATUS_LABELS[inv.status] || inv.status}
                          </StatusBadge>
                          {inv.parsing_status === "failed" && (
                            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {/* Reprocess button — visible when parsing failed */}
                          {inv.parsing_status === "failed" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={reprocessingId === inv.id}
                              onClick={() => handleReprocess(inv.id)}
                              title="Reprocessar fatura"
                            >
                              {reprocessingId === inv.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                              ) : (
                                <RefreshCw className="w-4 h-4 text-primary" />
                              )}
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {inv.pdf_file_url && (
                                <DropdownMenuItem asChild>
                                  <a href={inv.pdf_file_url} target="_blank" rel="noopener noreferrer">
                                    <Eye className="w-4 h-4 mr-2" /> Ver PDF
                                  </a>
                                </DropdownMenuItem>
                              )}
                              {/* Debug parsing */}
                              {inv.raw_extraction && (
                                <DropdownMenuItem onClick={() => setDebugInvoice(inv)}>
                                  <Bug className="w-4 h-4 mr-2" /> Ver debug
                                </DropdownMenuItem>
                              )}
                              {/* Reprocess in menu */}
                              {inv.pdf_file_url && (
                                <DropdownMenuItem
                                  disabled={reprocessingId === inv.id}
                                  onClick={() => handleReprocess(inv.id)}
                                >
                                  <RefreshCw className="w-4 h-4 mr-2" /> Reprocessar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(inv.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${inv.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={10} className="p-0">
                          <InvoiceDetailPanel invoice={inv} raw={raw} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Register invoice dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">Registrar Fatura</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Preencha os dados da conta de energia manualmente</p>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            {/* Referência */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Mês</Label>
                <Input type="number" min={1} max={12} value={form.reference_month} onChange={(e) => setForm(f => ({ ...f, reference_month: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ano</Label>
                <Input type="number" value={form.reference_year} onChange={(e) => setForm(f => ({ ...f, reference_year: parseInt(e.target.value) || 2024 }))} />
              </div>
            </div>

            {/* Valor, Vencimento, Bandeira */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.total_amount} onChange={(e) => setForm(f => ({ ...f, total_amount: e.target.value }))} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bandeira Tarifária</Label>
                <Select value={form.bandeira_tarifaria} onValueChange={(v) => setForm(f => ({ ...f, bandeira_tarifaria: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verde">🟢 Verde</SelectItem>
                    <SelectItem value="amarela">🟡 Amarela</SelectItem>
                    <SelectItem value="vermelha_1">🔴 Vermelha 1</SelectItem>
                    <SelectItem value="vermelha_2">🔴 Vermelha 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Energia */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Consumo (kWh)</Label>
                <Input type="number" step="0.1" value={form.energy_consumed_kwh} onChange={(e) => setForm(f => ({ ...f, energy_consumed_kwh: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Injeção (kWh)</Label>
                <Input type="number" step="0.1" value={form.energy_injected_kwh} onChange={(e) => setForm(f => ({ ...f, energy_injected_kwh: e.target.value }))} placeholder="0" />
              </div>
            </div>

            {/* Compensação e Saldo */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Compensado (kWh)</Label>
                <Input type="number" step="0.1" value={form.compensated_kwh} onChange={(e) => setForm(f => ({ ...f, compensated_kwh: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Saldo anterior (kWh)</Label>
                <Input type="number" step="0.1" value={form.previous_balance_kwh} onChange={(e) => setForm(f => ({ ...f, previous_balance_kwh: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Saldo atual (kWh)</Label>
                <Input type="number" step="0.1" value={form.current_balance_kwh} onChange={(e) => setForm(f => ({ ...f, current_balance_kwh: e.target.value }))} placeholder="0" />
              </div>
            </div>

            {/* Demanda (Grupo A) */}
            <Separator />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Demanda (Grupo A)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Contratada (kW)</Label>
                <Input type="number" step="0.1" value={form.demanda_contratada_kw} onChange={(e) => setForm(f => ({ ...f, demanda_contratada_kw: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Medida (kW)</Label>
                <Input type="number" step="0.1" value={form.demanda_medida_kw} onChange={(e) => setForm(f => ({ ...f, demanda_medida_kw: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ultrapassagem (kW)</Label>
                <Input type="number" step="0.1" value={form.ultrapassagem_kw} onChange={(e) => setForm(f => ({ ...f, ultrapassagem_kw: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Multa (R$)</Label>
                <Input type="number" step="0.01" value={form.multa_ultrapassagem} onChange={(e) => setForm(f => ({ ...f, multa_ultrapassagem: e.target.value }))} placeholder="0,00" />
              </div>
            </div>

            {/* PDF upload */}
            <div className="space-y-1">
              <Label className="text-xs">PDF da Fatura (opcional)</Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => setForm(f => ({ ...f, pdf_file: e.target.files?.[0] || null }))}
                className="text-sm file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={createMut.isPending}>Cancelar</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fatura?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A fatura será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget)}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}