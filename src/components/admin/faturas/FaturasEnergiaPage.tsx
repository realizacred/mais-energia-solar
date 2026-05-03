/**
 * FaturasEnergiaPage — Central de Faturas de Energia.
 * Consolidated view of all invoices with filters, upload, Gmail integration.
 */
import { useState, useEffect, useRef } from "react";
import { formatBRL, formatNumberBR, formatBRLCompact } from "@/lib/formatters";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStartInvoiceImport } from "@/hooks/useInvoiceImport";
import { useInvoicesList, useInvoiceKPIs } from "@/hooks/useInvoicesList";
import { GmailAccountsSection } from "./GmailAccountsSection";
import { invoiceService } from "@/services/invoiceService";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ImportJobsPanel } from "./ImportJobsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mail, CheckCircle, XCircle, Copy, Loader2, FileText, Building2,
  Upload, Search, MoreHorizontal, Trash2, ExternalLink, AlertTriangle,
  ChevronLeft, ChevronRight, FileSearch, Users, Zap, Sun,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/dateUtils";

const STALE = 1000 * 60 * 5;

const MONTH_LABELS = [
  "", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const STATUS_MAP: Record<string, string> = {
  received: "Recebida",
  processed: "Processada",
  pending: "Pendente",
  pending_review: "Em revisão",
  error: "Erro",
  valid: "Válida",
  divergent: "Divergente",
};

const STATUS_CLASSES: Record<string, string> = {
  received: "bg-info/10 text-info border-info/20",
  processed: "bg-success/10 text-success border-success/20",
  valid: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  pending_review: "bg-warning/10 text-warning border-warning/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  divergent: "bg-destructive/10 text-destructive border-destructive/20",
};

const GD_LABELS: Record<string, string> = {
  geradora: "Geradora",
  beneficiaria: "Beneficiária",
  nenhum: "Consumo",
};

const GD_CLASSES: Record<string, string> = {
  geradora: "bg-success/10 text-success border-success/20",
  beneficiaria: "bg-primary/10 text-primary border-primary/20",
};

export default function FaturasEnergiaPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  // disconnecting state removed — now in GmailAccountsSection
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const importMutation = useStartInvoiceImport();

  // Filters
  const [filterUC, setFilterUC] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterCliente, setFilterCliente] = useState("all");
  const [filterPapelGD, setFilterPapelGD] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(0);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [filterUC, filterStatus, filterYear, filterCliente, filterPapelGD, searchText]);

  // Gmail redirect toast
  useEffect(() => {
    const gmailParam = searchParams.get("gmail");
    if (gmailParam === "conectado") {
      toast({ title: "Gmail conectado com sucesso!" });
      qc.invalidateQueries({ queryKey: ["gmail_accounts"] });
    } else if (gmailParam === "erro") {
      toast({ title: "Erro ao conectar Gmail", description: searchParams.get("reason") || "Tente novamente", variant: "destructive" });
    }
  }, [searchParams]);

  // UCs for filter
  const { data: ucs = [] } = useQuery({
    queryKey: ["ucs_for_faturas_central"],
    queryFn: async () => {
      const { data } = await supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc, concessionaria_nome, cliente_id, papel_gd")
        .eq("is_archived", false)
        .order("nome");
      return data || [];
    },
    staleTime: STALE,
  });




  const { data: clientesList = [] } = useQuery({
    queryKey: ["clientes_for_faturas_filter"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    staleTime: STALE,
  });

  // Paginated invoices
  const filters = {
    unit_id: filterUC !== "all" ? filterUC : undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
    reference_year: filterYear !== "all" ? Number(filterYear) : undefined,
    search: searchText || undefined,
    cliente_id: filterCliente !== "all" ? filterCliente : undefined,
    papel_gd: filterPapelGD !== "all" ? filterPapelGD : undefined,
  };
  const { data: invoicesResult, isLoading: loadingInvoices } = useInvoicesList(filters, page);
  const invoices = invoicesResult?.data || [];
  const totalCount = invoicesResult?.totalCount || 0;
  const pageSize = invoicesResult?.pageSize || 50;
  const totalPages = Math.ceil(totalCount / pageSize);

  // KPIs
  const { data: kpis } = useInvoiceKPIs();

  // Years for filter
  const { data: years = [] } = useQuery({
    queryKey: ["invoice_years"],
    queryFn: async () => {
      const { data } = await supabase
        .from("unit_invoices")
        .select("reference_year")
        .order("reference_year", { ascending: false });
      const unique = [...new Set((data || []).map((d: any) => d.reference_year))];
      return unique as number[];
    },
    staleTime: STALE,
  });

  // Delete mutation
  const deleteMut = useMutation({
    mutationFn: (id: string) => invoiceService.delete(id),
    onSuccess: () => {
      toast({ title: "Fatura excluída" });
      qc.invalidateQueries({ queryKey: ["central_invoices"] });
      qc.invalidateQueries({ queryKey: ["unit_invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice_kpis"] });
      setDeleteId(null);
    },
    onError: (err: any) => toast({ title: "Erro", description: err?.message, variant: "destructive" }),
  });

  async function handleUploadPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    const fileArray = Array.from(files).filter((f) => f.type === "application/pdf");
    if (fileArray.length === 0) {
      toast({ title: "Apenas arquivos PDF são aceitos", variant: "destructive" });
      return;
    }
    try {
      const result = await importMutation.mutateAsync({ files: fileArray });
      const parts: string[] = [];
      if (result.success > 0) parts.push(`${result.success} importada(s)`);
      if (result.duplicate > 0) parts.push(`${result.duplicate} duplicada(s)`);
      if (result.errors > 0) parts.push(`${result.errors} erro(s)`);
      toast({
        title: parts.join(", ") || "Importação concluída",
        description: result.firstError || undefined,
        variant: result.errors > 0 && result.success === 0 ? "destructive" : undefined,
      });
      qc.invalidateQueries({ queryKey: ["invoice_kpis"] });
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err?.message, variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Central de Faturas"
        description="Gestão e importação inteligente de faturas"
        actions={
          <Link to="/admin/faturas-energia/revisao">
            <Button variant="outline" size="sm">
              <FileSearch className="w-4 h-4 mr-1" /> Revisão
            </Button>
          </Link>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{kpis?.totalCount ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Total faturas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-success bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{kpis?.monthImported ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Importadas (mês)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{kpis?.monthDuplicate ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Duplicadas (mês)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-destructive bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{kpis?.monthErrors ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Erros (mês)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-info bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {formatBRLCompact(kpis?.totalValor ?? 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Valor total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Jobs Panel */}
      <ImportJobsPanel />

      {/* Gmail Accounts Section */}
      <GmailAccountsSection />

      {/* Filters + Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" /> Faturas
            {totalCount > 0 && (
              <span className="text-xs font-normal text-muted-foreground">({totalCount})</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleUploadPdf} multiple />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending}>
              {importMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              Importar PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Buscar por UC, código ou concessionária..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="h-9"
              />
            </div>
            <Select value={filterCliente} onValueChange={setFilterCliente}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clientesList.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPapelGD} onValueChange={setFilterPapelGD}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Tipo GD" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="geradora">Geradora</SelectItem>
                <SelectItem value="beneficiaria">Beneficiária</SelectItem>
                <SelectItem value="nenhum">Consumo puro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterUC} onValueChange={setFilterUC}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="UC" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as UCs</SelectItem>
                {ucs.map((uc: any) => (
                  <SelectItem key={uc.id} value={uc.id}>{uc.codigo_uc} — {uc.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="received">Recebida</SelectItem>
                <SelectItem value="processed">Processada</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="pending_review">Em revisão</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[110px] h-9"><SelectValue placeholder="Ano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {years.map((y: number) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loadingInvoices ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma fatura encontrada</p>
              <p className="text-xs text-muted-foreground mt-1">Importe PDFs ou conecte o Gmail para receber faturas automaticamente</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-xs font-semibold text-foreground">Cliente</TableHead>
                      <TableHead className="text-xs font-semibold text-foreground">UC</TableHead>
                      <TableHead className="text-xs font-semibold text-foreground">Tipo</TableHead>
                      <TableHead className="text-xs font-semibold text-foreground">Concessionária</TableHead>
                      <TableHead className="text-xs font-semibold text-foreground">Referência</TableHead>
                      <TableHead className="text-xs font-semibold text-foreground text-right">Valor</TableHead>
                      <TableHead className="text-xs font-semibold text-foreground text-right">Consumo</TableHead>
                      <TableHead className="text-xs font-semibold text-foreground">Vencimento</TableHead>
                      <TableHead className="text-xs font-semibold text-foreground">Status</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv: any) => {
                      const papelGd = inv.units_consumidoras?.papel_gd;
                      const clienteNome = inv.units_consumidoras?.clientes?.nome;
                      const statusLabel = STATUS_MAP[inv.status] || inv.status || "pendente";
                      const statusClass = STATUS_CLASSES[inv.status] || "";
                      const gdLabel = GD_LABELS[papelGd] || "—";
                      const gdClass = GD_CLASSES[papelGd] || "";

                      return (
                        <TableRow key={inv.id} className="hover:bg-muted/30">
                          <TableCell className="text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[180px]">{clienteNome || "Sem cliente"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="font-medium text-foreground block truncate max-w-[200px]">{inv.units_consumidoras?.nome || "—"}</span>
                            <span className="text-xs text-muted-foreground font-mono">{inv.units_consumidoras?.codigo_uc}</span>
                          </TableCell>
                          <TableCell>
                            {papelGd && papelGd !== "nenhum" ? (
                              <Badge variant="outline" className={`text-xs ${gdClass}`}>
                                {papelGd === "geradora" && <Sun className="w-3 h-3 mr-1" />}
                                {papelGd === "beneficiaria" && <Zap className="w-3 h-3 mr-1" />}
                                {gdLabel}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Consumo</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{inv.units_consumidoras?.concessionaria_nome || "—"}</TableCell>
                          <TableCell className="text-sm font-medium">
                            {MONTH_LABELS[inv.reference_month] || inv.reference_month}/{inv.reference_year}
                          </TableCell>
                          <TableCell className="text-sm text-right font-mono">
                            {inv.total_amount != null ? formatBRL(Number(inv.total_amount)) : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-right font-mono">
                            {inv.energy_consumed_kwh != null ? `${formatNumberBR(Number(inv.energy_consumed_kwh))} kWh` : "—"}
                          </TableCell>
                          <TableCell className="text-sm">{inv.due_date ? formatDate(inv.due_date) : "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${statusClass}`}>
                              {statusLabel}
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
                              {inv.pdf_file_url && (
                                <DropdownMenuItem onClick={async () => {
                                  const { data } = await supabase.storage.from("faturas-energia").createSignedUrl(inv.pdf_file_url!, 60);
                                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                }}>
                                  <ExternalLink className="w-4 h-4 mr-2" /> Ver PDF
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(inv.id)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      );
                    })}

                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Página {page + 1} de {totalPages} ({totalCount} faturas)
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fatura?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é permanente e não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
            >
              {deleteMut.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
