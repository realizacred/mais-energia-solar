/**
 * UCInvoicesTab — Invoices list for a UC with manual registration, PDF upload, and expandable detail rows.
 */
import { useState, useRef } from "react";
import { formatDecimalBR, formatBRL } from "@/lib/formatters";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoiceService, type UnitInvoice, type BandeiraTarifaria } from "@/services/invoiceService";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/storagePaths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Upload, Mail, ExternalLink, Eye, Loader2, Trash2, MoreHorizontal, ChevronDown, ChevronRight, RefreshCw, Bug, AlertTriangle, CheckCircle2, XCircle, Pencil } from "lucide-react";
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
import { invalidateUcQueries } from "@/lib/invalidateUcQueries";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { InvoiceMeterValidation } from "./InvoiceMeterValidation";

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

const MESES_REFERENCIA_MAP: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

function getReferenceFromParsed(parsed: Record<string, any> | null | undefined) {
  const mesReferencia = parsed?.mes_referencia;

  if (typeof mesReferencia !== "string") {
    return { month: null, year: null };
  }

  const normalized = mesReferencia.trim().toLowerCase();
  const numericMatch = normalized.match(/(\d{1,2})\D+(\d{4})/);
  if (numericMatch) {
    return {
      month: Number(numericMatch[1]),
      year: Number(numericMatch[2]),
    };
  }

  const yearMatch = normalized.match(/(20\d{2})/);
  const monthEntry = Object.entries(MESES_REFERENCIA_MAP).find(([label]) => normalized.includes(label));

  return {
    month: monthEntry?.[1] ?? null,
    year: yearMatch ? Number(yearMatch[1]) : null,
  };
}

function findRecentlySavedInvoice(invoices: UnitInvoice[], parsed: Record<string, any> | null | undefined) {
  const { month, year } = getReferenceFromParsed(parsed);
  const now = Date.now();

  return invoices.find((invoice) => {
    const createdAt = new Date(invoice.created_at).getTime();
    const createdRecently = Number.isFinite(createdAt) && now - createdAt < 10 * 60 * 1000;

    if (!createdRecently) return false;
    if (month && year) {
      return invoice.reference_month === month && invoice.reference_year === year;
    }

    return invoice.source === "import" || invoice.source === "upload";
  }) ?? null;
}

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

function InvoiceDetailPanel({ invoice, raw, unitId }: { invoice: UnitInvoice; raw: Record<string, any> | null; unitId: string }) {
  const fmtNum = (v: number | null | undefined, suffix = "") => v != null ? `${formatDecimalBR(v, 1)}${suffix}` : null;
  const fmtBRL = (v: number | null | undefined) => v != null ? formatBRL(v) : null;

  return (
    <div className="px-6 py-4 space-y-4">
      {/* Partial parsing warning */}
      {invoice.parsing_status === "partial" && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div className="text-xs text-warning space-y-0.5">
            <p className="font-medium">Extração parcial</p>
            <p>Alguns campos não foram extraídos corretamente. {invoice.parsing_error_reason || "Os dados abaixo podem estar incompletos."}</p>
          </div>
        </div>
      )}

      {/* Failed parsing warning */}
      {invoice.parsing_status === "failed" && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-xs text-destructive space-y-0.5">
            <p className="font-medium">Falha na extração</p>
            <p>{invoice.parsing_error_reason || "Não foi possível extrair os dados desta fatura. Tente reprocessar."}</p>
          </div>
        </div>
      )}

      {/* Manual assignment warning */}
      {invoice.needs_manual_assignment && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div className="text-xs text-warning space-y-0.5">
            <p className="font-medium">Atribuição pendente</p>
            <p>Esta fatura não foi associada automaticamente à UC. Confirme se os dados estão corretos.</p>
          </div>
        </div>
      )}

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

      {/* Cross-validation: Invoice vs Meter */}
      <Separator />
      <InvoiceMeterValidation
        unitId={unitId}
        referenceMonth={invoice.reference_month}
        referenceYear={invoice.reference_year}
      />
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
    invalidateUcQueries(qc, unitId);
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<UnitInvoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
    icms_percentual: "",
    pis_valor: "",
    cofins_valor: "",
    tarifa_energia_kwh: "",
    tarifa_fio_b_kwh: "",
    proxima_leitura_data: "",
    extracted_json: "",
  });

  const isEditing = !!editingInvoice;

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

  const isFormValid = form.reference_month >= 1 && form.reference_month <= 12 && form.reference_year >= 2000 && !!form.total_amount;

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Partial<UnitInvoice> = {
        reference_month: form.reference_month,
        reference_year: form.reference_year,
        total_amount: parseNum(form.total_amount),
        energy_consumed_kwh: parseNum(form.energy_consumed_kwh),
        energy_injected_kwh: parseNum(form.energy_injected_kwh),
        compensated_kwh: parseNum(form.compensated_kwh),
        previous_balance_kwh: parseNum(form.previous_balance_kwh),
        current_balance_kwh: parseNum(form.current_balance_kwh),
        due_date: form.due_date || null,
        demanda_contratada_kw: parseNum(form.demanda_contratada_kw),
        demanda_medida_kw: parseNum(form.demanda_medida_kw),
        ultrapassagem_kw: parseNum(form.ultrapassagem_kw),
        multa_ultrapassagem: parseNum(form.multa_ultrapassagem),
        bandeira_tarifaria: (form.bandeira_tarifaria || null) as BandeiraTarifaria | null,
        raw_extraction: {
          ...(editingInvoice?.raw_extraction || {}),
          ...(form.extracted_json ? JSON.parse(form.extracted_json) : {}),
          icms_percentual: parseNum(form.icms_percentual),
          pis_valor: parseNum(form.pis_valor),
          cofins_valor: parseNum(form.cofins_valor),
          tarifa_energia_kwh: parseNum(form.tarifa_energia_kwh),
          tarifa_fio_b_kwh: parseNum(form.tarifa_fio_b_kwh),
          proxima_leitura_data: form.proxima_leitura_data || null,
        },
      };

      if (editingInvoice) {
        return invoiceService.update(editingInvoice.id, payload);
      } else {
        let pdfUrl: string | null = null;
        if (form.pdf_file) {
          pdfUrl = await uploadPdf(form.pdf_file);
        }
        return invoiceService.create({
          ...payload,
          unit_id: unitId,
          pdf_file_url: pdfUrl,
          source: "manual",
        } as any);
      }
    },
    onSuccess: () => {
      invalidateAllUcQueries();
      setDialogOpen(false);
      setEditingInvoice(null);
      resetForm();
      toast({ title: isEditing ? "Fatura atualizada com sucesso" : "Fatura registrada com sucesso" });
    },
    onError: (err: any) => toast({ title: isEditing ? "Erro ao atualizar fatura" : "Erro ao registrar fatura", description: err?.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => invoiceService.delete(id),
    onSuccess: async () => {
      // Check if there are remaining invoices; if none, reset proxima_leitura_data
      const remaining = invoices.filter((inv) => inv.id !== deleteTarget);
      if (remaining.length === 0) {
        await supabase
          .from("units_consumidoras" as any)
          .update({ proxima_leitura_data: null } as any)
          .eq("id", unitId);
      }
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

      const response = await invokeEdgeFunction<any>("process-fatura-pdf", {
        body: {
          pdf_storage_path: pdfStoragePath,
          unit_id: unitId,
          source: "import",
        },
        headers: { "x-client-timeout": "120" },
      });

      const edgeData = response?.data ?? response;
      const parsed = edgeData?.parsed ?? null;
      let savedInvoiceId = edgeData?.invoice_id ?? edgeData?.invoice?.id ?? null;

      if (!savedInvoiceId) {
        invalidateAllUcQueries();
        const refreshedInvoices = await qc.fetchQuery({
          queryKey: ["unit_invoices", unitId],
          queryFn: () => invoiceService.listByUnit(unitId),
          staleTime: 0,
        });
        savedInvoiceId = findRecentlySavedInvoice(refreshedInvoices, parsed)?.id ?? null;
      }

      if (!savedInvoiceId) {
        throw new Error("Os dados foram extraídos, mas a fatura não foi salva.");
      }

      setUploadProgress(90);
      setUploadStep("Finalizando...");

      const fieldsExtracted = parsed
        ? [parsed.consumo_kwh && "consumo", parsed.valor_total && "valor", parsed.vencimento && "vencimento", parsed.saldo_gd && "saldo GD"].filter(Boolean)
        : [];
      const extractionStatus = edgeData?.extraction_status;

      setUploadProgress(100);
      setUploadStep("Concluído!");
      invalidateAllUcQueries();

      if (extractionStatus === "partial" || extractionStatus === "failed") {
        toast({
          title: "Fatura salva em revisão",
          description: "Os dados foram extraídos e a fatura foi registrada para revisão técnica.",
        });
      } else if (fieldsExtracted.length > 0) {
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
      icms_percentual: "",
      pis_valor: "",
      cofins_valor: "",
      tarifa_energia_kwh: "",
      tarifa_fio_b_kwh: "",
      proxima_leitura_data: "",
      extracted_json: "",
    });
  };

  const openEditDialog = (inv: UnitInvoice) => {
    const raw = (inv.raw_extraction || {}) as Record<string, any>;
    setEditingInvoice(inv);
    setForm({
      reference_month: inv.reference_month,
      reference_year: inv.reference_year,
      total_amount: inv.total_amount != null ? String(inv.total_amount) : "",
      energy_consumed_kwh: inv.energy_consumed_kwh != null ? String(inv.energy_consumed_kwh) : "",
      energy_injected_kwh: inv.energy_injected_kwh != null ? String(inv.energy_injected_kwh) : "",
      compensated_kwh: inv.compensated_kwh != null ? String(inv.compensated_kwh) : "",
      previous_balance_kwh: inv.previous_balance_kwh != null ? String(inv.previous_balance_kwh) : "",
      current_balance_kwh: inv.current_balance_kwh != null ? String(inv.current_balance_kwh) : "",
      due_date: inv.due_date || "",
      pdf_file: null,
      demanda_contratada_kw: inv.demanda_contratada_kw != null ? String(inv.demanda_contratada_kw) : "",
      demanda_medida_kw: inv.demanda_medida_kw != null ? String(inv.demanda_medida_kw) : "",
      ultrapassagem_kw: inv.ultrapassagem_kw != null ? String(inv.ultrapassagem_kw) : "",
      multa_ultrapassagem: inv.multa_ultrapassagem != null ? String(inv.multa_ultrapassagem) : "",
      bandeira_tarifaria: inv.bandeira_tarifaria || "",
      icms_percentual: raw.icms_percentual != null ? String(raw.icms_percentual) : "",
      pis_valor: raw.pis_valor != null ? String(raw.pis_valor) : "",
      cofins_valor: raw.cofins_valor != null ? String(raw.cofins_valor) : "",
      tarifa_energia_kwh: raw.tarifa_energia_kwh != null ? String(raw.tarifa_energia_kwh) : "",
      tarifa_fio_b_kwh: raw.tarifa_fio_b_kwh != null ? String(raw.tarifa_fio_b_kwh) : "",
      proxima_leitura_data: raw.proxima_leitura_data || "",
      extracted_json: JSON.stringify(raw, null, 2),
    });
    setDialogOpen(true);
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
        const updatedInvoice = result?.data?.invoice as Partial<UnitInvoice> | undefined;

        if (updatedInvoice?.id) {
          qc.setQueryData<UnitInvoice[]>(["unit_invoices", unitId], (current = []) =>
            current.map((invoice) =>
              invoice.id === updatedInvoice.id
                ? ({ ...invoice, ...updatedInvoice } as UnitInvoice)
                : invoice
            )
          );

          if (debugInvoice?.id === updatedInvoice.id) {
            setDebugInvoice((current) =>
              current ? ({ ...current, ...updatedInvoice } as UnitInvoice) : current
            );
          }
        }

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
    pending_review: "Em revisão",
    validated: "Validada",
    failed: "Falhou",
    incomplete: "Incompleta",
    divergent: "Divergente",
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
          <Button size="sm" onClick={() => { resetForm(); setEditingInvoice(null); setDialogOpen(true); }}>
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

      {/* Status filter — filters by parsing_status (success/partial/failed) */}
      {invoices.length > 0 && (() => {
        const counts = {
          all: invoices.length,
          success: invoices.filter(i => i.parsing_status === "success").length,
          partial: invoices.filter(i => i.parsing_status === "partial").length,
          failed: invoices.filter(i => i.parsing_status === "failed").length,
          pending_review: invoices.filter(i => i.status === "pending_review" || i.needs_manual_assignment).length,
        };
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { key: "all", label: "Todos", color: "" },
              { key: "success", label: "Processadas", color: "text-success" },
              { key: "partial", label: "Parciais", color: "text-warning" },
              { key: "failed", label: "Erros", color: "text-destructive" },
              { key: "pending_review", label: "Em revisão", color: "text-muted-foreground" },
            ] as const).map(f => (
              <Button
                key={f.key}
                variant={statusFilter === f.key ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setStatusFilter(f.key)}
              >
                <span className={statusFilter !== f.key ? f.color : ""}>{f.label}</span>
                {counts[f.key] > 0 && (
                  <span className="ml-1 opacity-70">({counts[f.key]})</span>
                )}
              </Button>
            ))}
          </div>
        );
      })()}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhuma fatura" description="Registre manualmente, importe um PDF ou configure o recebimento por e-mail." />
      ) : (() => {
        const filteredInvoices = statusFilter === "all"
          ? invoices
          : statusFilter === "pending_review"
            ? invoices.filter(i => i.status === "pending_review" || i.needs_manual_assignment)
            : invoices.filter(i => i.parsing_status === statusFilter);
        return filteredInvoices.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhuma fatura neste filtro" description="Altere o filtro acima para ver outras faturas." />
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
              {filteredInvoices.map((inv) => {
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
                          {inv.needs_manual_assignment && (
                            <Badge variant="outline" className="text-[10px] ml-1 bg-warning/10 text-warning border-warning/20">
                              Atribuição pendente
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : "—"}</TableCell>
                      <TableCell className="text-sm text-right font-mono">{inv.total_amount != null ? formatBRL(inv.total_amount) : "—"}</TableCell>
                      <TableCell className="text-sm text-right">{inv.energy_consumed_kwh != null ? `${formatDecimalBR(inv.energy_consumed_kwh, 1)} kWh` : "—"}</TableCell>
                      <TableCell className="text-sm text-right">{inv.energy_injected_kwh != null ? `${formatDecimalBR(inv.energy_injected_kwh, 1)} kWh` : "—"}</TableCell>
                      <TableCell className="text-sm text-right">{inv.current_balance_kwh != null ? `${formatDecimalBR(inv.current_balance_kwh, 1)} kWh` : "—"}</TableCell>
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
                        <div className="flex items-center gap-1 flex-wrap">
                          <StatusBadge variant={inv.status === "processed" ? "success" : inv.status === "error" ? "destructive" : "warning"} dot>
                            {STATUS_LABELS[inv.status] || inv.status}
                          </StatusBadge>
                          {inv.parsing_status === "partial" && (
                            <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">
                              Parcial
                            </Badge>
                          )}
                          {inv.parsing_status === "failed" && (
                            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {/* Reprocess button — visible when parsing failed or partial */}
                          {(inv.parsing_status === "failed" || inv.parsing_status === "partial") && (
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
                                <DropdownMenuItem onClick={async () => {
                                  const { data } = await supabase.storage.from("faturas-energia").createSignedUrl(inv.pdf_file_url!, 60);
                                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                }}>
                                  <Eye className="w-4 h-4 mr-2" /> Ver PDF
                                </DropdownMenuItem>
                              )}
                              {/* Edit invoice */}
                              <DropdownMenuItem onClick={() => openEditDialog(inv)}>
                                <Pencil className="w-4 h-4 mr-2" /> Editar
                              </DropdownMenuItem>
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
                          <InvoiceDetailPanel invoice={inv} raw={raw} unitId={unitId} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
        );
      })()}

      {/* Register/Edit invoice dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingInvoice(null); }}>
        <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {isEditing ? "Editar Fatura" : "Nova Fatura"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEditing ? "Altere os dados da fatura selecionada" : "Preencha os dados da conta de energia manualmente"}
              </p>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            {/* Referência */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Mês <span className="text-destructive">*</span></Label>
                <Input type="number" min={1} max={12} value={form.reference_month} onChange={(e) => setForm(f => ({ ...f, reference_month: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ano <span className="text-destructive">*</span></Label>
                <Input type="number" value={form.reference_year} onChange={(e) => setForm(f => ({ ...f, reference_year: parseInt(e.target.value) || 2024 }))} />
              </div>
            </div>

            {/* Valor, Vencimento, Bandeira */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$) <span className="text-destructive">*</span></Label>
                <CurrencyInput value={Number(form.total_amount) || 0} onChange={(v) => setForm(f => ({ ...f, total_amount: String(v) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento</Label>
                <DateInput value={form.due_date} onChange={(v) => setForm(f => ({ ...f, due_date: v }))} />
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

            <Separator />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tributos e tarifas</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">ICMS (%)</Label>
                <Input type="number" step="0.01" value={form.icms_percentual} onChange={(e) => setForm(f => ({ ...f, icms_percentual: e.target.value }))} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">PIS (R$)</Label>
                <CurrencyInput value={Number(form.pis_valor) || 0} onChange={(v) => setForm(f => ({ ...f, pis_valor: String(v) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">COFINS (R$)</Label>
                <CurrencyInput value={Number(form.cofins_valor) || 0} onChange={(v) => setForm(f => ({ ...f, cofins_valor: String(v) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tarifa Energia</Label>
                <Input type="number" step="0.000001" value={form.tarifa_energia_kwh} onChange={(e) => setForm(f => ({ ...f, tarifa_energia_kwh: e.target.value }))} placeholder="0,000000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">TUSD/Fio B</Label>
                <Input type="number" step="0.000001" value={form.tarifa_fio_b_kwh} onChange={(e) => setForm(f => ({ ...f, tarifa_fio_b_kwh: e.target.value }))} placeholder="0,000000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Próxima leitura</Label>
                <Input value={form.proxima_leitura_data} onChange={(e) => setForm(f => ({ ...f, proxima_leitura_data: e.target.value }))} placeholder="dd/mm/aaaa" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">JSON de dados extraídos</Label>
              <Textarea
                value={form.extracted_json}
                onChange={(e) => setForm(f => ({ ...f, extracted_json: e.target.value }))}
                className="min-h-[180px] font-mono text-xs"
                placeholder='{"icms_percentual":18}'
              />
            </div>

            {/* PDF upload — only for creation */}
            {!isEditing && (
              <div className="space-y-1">
                <Label className="text-xs">PDF da Fatura (opcional)</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setForm(f => ({ ...f, pdf_file: e.target.files?.[0] || null }))}
                  className="text-sm file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="ghost" onClick={() => { setDialogOpen(false); setEditingInvoice(null); }} disabled={saveMut.isPending}>Cancelar</Button>
            <Button onClick={() => {
              if (!isFormValid) {
                toast({ title: "Preencha os campos obrigatórios", description: "Mês, ano e valor total são obrigatórios.", variant: "destructive" });
                return;
              }
              const amount = parseFloat(form.total_amount);
              if (isNaN(amount) || amount <= 0) {
                toast({ title: "Valor inválido", description: "O valor total deve ser maior que zero.", variant: "destructive" });
                return;
              }
              saveMut.mutate();
            }} disabled={saveMut.isPending}>
              {saveMut.isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debug parsing modal */}
      <Dialog open={!!debugInvoice} onOpenChange={(open) => !open && setDebugInvoice(null)}>
        <DialogContent className="w-[90vw] max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bug className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">Debug do Parsing</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Detalhes da extração determinística — {debugInvoice?.parser_version ? `Parser v${debugInvoice.parser_version}` : "Versão desconhecida"}
              </p>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            {debugInvoice && (() => {
              const raw = debugInvoice.raw_extraction as Record<string, any> | null;
              if (!raw) return <p className="text-sm text-muted-foreground">Sem dados de extração disponíveis.</p>;

              const FIELD_LABELS: Record<string, string> = {
                concessionaria_nome: "Concessionária",
                numero_uc: "Nº UC",
                mes_referencia: "Referência",
                vencimento: "Vencimento",
                valor_total: "Valor Total",
                consumo_kwh: "Consumo (kWh)",
                energia_injetada_kwh: "Injeção (kWh)",
                energia_compensada_kwh: "Compensado (kWh)",
                saldo_gd_acumulado: "Saldo GD Acumulado",
                saldo_gd: "Saldo GD",
                leitura_anterior_03: "Leitura Anterior 03",
                leitura_atual_03: "Leitura Atual 03",
                leitura_anterior_103: "Leitura Anterior 103",
                leitura_atual_103: "Leitura Atual 103",
                proxima_leitura_data: "Próxima Leitura",
                tipo_ligacao: "Tipo Ligação",
                classe_consumo: "Classe",
                categoria_gd: "Categoria GD",
                bandeira_tarifaria: "Bandeira",
                tarifa_energia_kwh: "Tarifa Energia",
                tarifa_fio_b_kwh: "TUSD/Fio B",
                icms_percentual: "ICMS %",
                pis_valor: "PIS",
                cofins_valor: "COFINS",
                demanda_contratada_kw: "Demanda Contratada",
              };

              const importantFields = Object.keys(FIELD_LABELS);
              const foundFields = importantFields.filter(f => raw[f] != null && raw[f] !== "");
              const missingFields = importantFields.filter(f => raw[f] == null || raw[f] === "");
              const validations = (raw.validations || []) as Array<{ rule: string; passed: boolean; detail: string }>;
              const fieldResults = (raw.field_results || {}) as Record<string, { value: any; source: string; validated?: boolean; note?: string }>;

              return (
                <>
                  {/* Parsing status */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="text-xs space-y-1 flex-1">
                      <p><strong>Status:</strong> {debugInvoice.parsing_status || "—"}</p>
                      <p><strong>Parser:</strong> {raw.parser_used || "?"} v{raw.parser_version || "?"}</p>
                      <p><strong>Confiança:</strong> {raw.confidence != null ? `${raw.confidence}%` : "—"}</p>
                      {debugInvoice.parsing_error_reason && (
                        <p className="text-destructive"><strong>Erro:</strong> {debugInvoice.parsing_error_reason}</p>
                      )}
                    </div>
                  </div>

                  {/* Found fields */}
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      Campos encontrados ({foundFields.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {foundFields.map(f => (
                        <div key={f} className="text-xs p-2 rounded bg-success/5 border border-success/10">
                          <span className="text-muted-foreground">{FIELD_LABELS[f]}:</span>{" "}
                          <span className="font-medium text-foreground">{String(raw[f])}</span>
                          {fieldResults[f]?.source && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Fonte: {fieldResults[f].source}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Missing fields */}
                  {missingFields.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5 text-destructive" />
                        Campos não encontrados ({missingFields.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {missingFields.map(f => (
                          <span key={f} className="text-[11px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                            {FIELD_LABELS[f]}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Validations */}
                  {validations.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-2">Validações Cruzadas</p>
                      <div className="space-y-1">
                        {validations.map((v, i) => (
                          <div key={i} className={`flex items-center gap-2 text-xs p-2 rounded ${v.passed ? "bg-success/5" : "bg-destructive/5"}`}>
                            {v.passed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                            )}
                            <span className="font-medium text-foreground">{v.rule}</span>
                            <span className="text-muted-foreground flex-1">{v.detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            {debugInvoice?.pdf_file_url && (
              <Button
                variant="outline"
                size="sm"
                disabled={reprocessingId === debugInvoice.id}
                onClick={() => { handleReprocess(debugInvoice.id); setDebugInvoice(null); }}
              >
                <RefreshCw className="w-4 h-4 mr-1" /> Reprocessar
              </Button>
            )}
            <Button variant="ghost" onClick={() => setDebugInvoice(null)}>Fechar</Button>
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
