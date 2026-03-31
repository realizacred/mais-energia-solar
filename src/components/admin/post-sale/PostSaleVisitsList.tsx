import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePostSaleVisits, useUpdateVisitStatus, PostSaleVisit } from "@/hooks/usePostSale";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, Eye, Plus, Search, X, CalendarClock, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { PostSaleNewVisitDialog } from "./PostSaleNewVisitDialog";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-warning/10 text-warning border-warning/30",
  agendado: "bg-info/10 text-info border-info/30",
  concluido: "bg-success/10 text-success border-success/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

const TIPO_LABELS: Record<string, string> = {
  preventiva: "Preventiva",
  limpeza: "Limpeza",
  suporte: "Suporte",
  vistoria: "Vistoria",
  corretiva: "Corretiva",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function PostSaleVisitsList() {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedVisit, setSelectedVisit] = useState<PostSaleVisit | null>(null);
  const [conclusionNotes, setConclusionNotes] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: visits = [], isLoading } = usePostSaleVisits({
    status: filterStatus === "all" ? undefined : filterStatus,
    tipo: filterTipo === "all" ? undefined : filterTipo,
  });
  const updateStatus = useUpdateVisitStatus();

  const handleConcluir = () => {
    if (!selectedVisit) return;
    updateStatus.mutate(
      { id: selectedVisit.id, status: "concluido", observacoes: conclusionNotes || undefined },
      { onSuccess: () => { setSelectedVisit(null); setConclusionNotes(""); } }
    );
  };

  const getClienteName = (v: PostSaleVisit) =>
    v.cliente?.nome ?? (v as any).nome_avulso ?? "—";

  // KPIs
  const kpis = useMemo(() => {
    const total = visits.length;
    const pendentes = visits.filter(v => v.status === "pendente" || v.status === "agendado").length;
    const concluidos = visits.filter(v => v.status === "concluido").length;
    const atrasados = visits.filter(v => v.data_prevista && v.status !== "concluido" && v.status !== "cancelado" && isPast(new Date(v.data_prevista))).length;
    return { total, pendentes, concluidos, atrasados };
  }, [visits]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search) return visits;
    const q = search.toLowerCase();
    return visits.filter(v => getClienteName(v).toLowerCase().includes(q));
  }, [visits, search]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (search) c++;
    if (filterStatus !== "all") c++;
    if (filterTipo !== "all") c++;
    return c;
  }, [search, filterStatus, filterTipo]);

  const clearFilters = () => { setSearch(""); setFilterStatus("all"); setFilterTipo("all"); };

  // Pagination
  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);
  const safeCurrentPage = Math.min(page, totalPages);
  const paginatedData = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safeCurrentPage, pageSize]);

  useEffect(() => { setPage(1); }, [search, filterStatus, filterTipo, pageSize]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarClock}
        title="Preventivas"
        description={`${visits.length} visitas cadastradas`}
        actions={
          <div className="flex gap-2 items-center">
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="gap-1">{activeFilterCount} filtro(s)</Badge>
            )}
            <Button size="sm" className="h-9 gap-1.5" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" /> Nova Visita
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      {!isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-l-[3px] border-l-primary">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                <CalendarClock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{kpis.total}</p>
                <p className="text-xs text-muted-foreground mt-1">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-warning">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{kpis.pendentes}</p>
                <p className="text-xs text-muted-foreground mt-1">Em andamento</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-success">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{kpis.concluidos}</p>
                <p className="text-xs text-muted-foreground mt-1">Concluídos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-destructive">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{kpis.atrasados}</p>
                <p className="text-xs text-muted-foreground mt-1">Atrasados</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="agendado">Agendado</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={clearFilters}>
              <X className="w-3 h-3" /> Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="py-16">
            <EmptyState icon={Clock} title="Nenhuma visita encontrada" description="Clique em 'Nova Visita' para agendar um serviço." />
          </div>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="uppercase tracking-wide text-xs font-semibold text-muted-foreground">Cliente</TableHead>
                <TableHead className="uppercase tracking-wide text-xs font-semibold text-muted-foreground">Projeto</TableHead>
                <TableHead className="uppercase tracking-wide text-xs font-semibold text-muted-foreground">Tipo</TableHead>
                <TableHead className="uppercase tracking-wide text-xs font-semibold text-muted-foreground">Data prevista</TableHead>
                <TableHead className="uppercase tracking-wide text-xs font-semibold text-muted-foreground">Status</TableHead>
                <TableHead className="uppercase tracking-wide text-xs font-semibold text-muted-foreground text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map(v => {
                const isLate = v.data_prevista && v.status !== "concluido" && v.status !== "cancelado" && isPast(new Date(v.data_prevista));
                return (
                  <TableRow key={v.id} className="hover:bg-muted/30 transition-colors border-b border-border/50">
                    <TableCell className="text-sm font-medium py-3">{getClienteName(v)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground py-3">{v.projeto?.codigo ?? v.projeto?.nome ?? "—"}</TableCell>
                    <TableCell className="py-3"><Badge variant="outline" className="text-xs rounded-full px-2 py-0.5">{TIPO_LABELS[v.tipo] ?? v.tipo}</Badge></TableCell>
                    <TableCell className={`text-sm py-3 ${isLate ? "text-destructive font-medium" : ""}`}>
                      {v.data_prevista ? format(new Date(v.data_prevista), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className={`text-xs rounded-full px-2 py-0.5 ${STATUS_COLORS[v.status] ?? ""}`}>{v.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => navigate(`/admin/pos-venda-visitas/${v.id}`)}>
                          <Eye className="h-3.5 w-3.5" /> Abrir
                        </Button>
                        {(v.status === "pendente" || v.status === "agendado") && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-success" onClick={() => setSelectedVisit(v)}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Exibir</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <span>de {filtered.length} resultados</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={safeCurrentPage <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2 text-xs">{safeCurrentPage} / {totalPages}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={safeCurrentPage >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* New visit dialog */}
      <PostSaleNewVisitDialog open={showNew} onOpenChange={setShowNew} />

      {/* Conclusion dialog */}
      <Dialog open={!!selectedVisit} onOpenChange={(o) => !o && setSelectedVisit(null)}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Concluir visita</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Cliente: <strong>{selectedVisit ? getClienteName(selectedVisit) : ""}</strong>
            </p>
            <Textarea
              placeholder="Observações da visita..."
              value={conclusionNotes}
              onChange={e => setConclusionNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedVisit(null)}>Cancelar</Button>
            <Button onClick={handleConcluir} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? "Salvando..." : "Concluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PostSaleVisitsList;
