import { useState, useMemo } from "react";
import { Plus, ArrowUpCircle, ArrowDownCircle, Pencil, Trash2, ExternalLink, ArrowLeftRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { TablePagination } from "@/components/ui-kit/TablePagination";
import { formatBRL } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  useLancamentos,
  useDeleteLancamento,
  LancamentoFinanceiro,
  LancamentoFiltros,
  CATEGORIAS_RECEITA,
  CATEGORIAS_DESPESA,
} from "@/hooks/useLancamentosFinanceiros";
import { LancamentoDialog } from "./LancamentoDialog";
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

const ALL_CATEGORIAS = [...CATEGORIAS_RECEITA, ...CATEGORIAS_DESPESA];

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

export default function LancamentosPage() {
  const { start, end } = useMemo(getMonthRange, []);
  const [filtros, setFiltros] = useState<LancamentoFiltros>({
    tipo: "todos",
    dataInicio: start,
    dataFim: end,
    status: "todos",
  });

  const { data: lancamentos = [], isLoading } = useLancamentos(filtros);
  const deleteMutation = useDeleteLancamento(filtros);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LancamentoFinanceiro | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const paginatedData = useMemo(() => {
    const from = (page - 1) * pageSize;
    return lancamentos.slice(from, from + pageSize);
  }, [lancamentos, page, pageSize]);

  // Totals
  const totalReceitas = useMemo(
    () => lancamentos.filter((l) => l.tipo === "receita" && l.status !== "cancelado").reduce((s, l) => s + Number(l.valor), 0),
    [lancamentos]
  );
  const totalDespesas = useMemo(
    () => lancamentos.filter((l) => l.tipo === "despesa" && l.status !== "cancelado").reduce((s, l) => s + Number(l.valor), 0),
    [lancamentos]
  );
  const saldo = totalReceitas - totalDespesas;

  const categoriaLabel = (val: string) => ALL_CATEGORIAS.find((c) => c.value === val)?.label || val;

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Lançamentos Financeiros</h1>
            <p className="text-sm text-muted-foreground">Receitas e despesas avulsas</p>
          </div>
        </div>
        <Button onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Lançamento
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-[3px] border-l-success bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-success/10 shrink-0">
              <ArrowUpCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{formatBRL(totalReceitas)}</p>
              <p className="text-sm text-muted-foreground mt-1">Receitas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-destructive bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-destructive/10 shrink-0">
              <ArrowDownCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{formatBRL(totalDespesas)}</p>
              <p className="text-sm text-muted-foreground mt-1">Despesas</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("border-l-[3px] bg-card shadow-sm", saldo >= 0 ? "border-l-primary" : "border-l-destructive")}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", saldo >= 0 ? "bg-primary/10" : "bg-destructive/10")}>
              <ArrowLeftRight className={cn("w-5 h-5", saldo >= 0 ? "text-primary" : "text-destructive")} />
            </div>
            <div>
              <p className={cn("text-2xl font-bold tracking-tight leading-none", saldo >= 0 ? "text-foreground" : "text-destructive")}>{formatBRL(saldo)}</p>
              <p className="text-sm text-muted-foreground mt-1">Saldo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={filtros.tipo || "todos"} onValueChange={(v) => { setFiltros((f) => ({ ...f, tipo: v })); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="receita">Receitas</SelectItem>
            <SelectItem value="despesa">Despesas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtros.status || "todos"} onValueChange={(v) => { setFiltros((f) => ({ ...f, status: v })); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="confirmado">Confirmado</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={filtros.dataInicio || ""}
          onChange={(e) => { setFiltros((f) => ({ ...f, dataInicio: e.target.value })); setPage(1); }}
          className="w-full sm:w-[160px]"
        />
        <Input
          type="date"
          value={filtros.dataFim || ""}
          onChange={(e) => { setFiltros((f) => ({ ...f, dataFim: e.target.value })); setPage(1); }}
          className="w-full sm:w-[160px]"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold text-foreground">Data</TableHead>
              <TableHead className="font-semibold text-foreground">Tipo</TableHead>
              <TableHead className="font-semibold text-foreground">Categoria</TableHead>
              <TableHead className="font-semibold text-foreground">Descrição</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Valor</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum lançamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-foreground whitespace-nowrap">
                    {new Date(item.data_lancamento + "T12:00:00").toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs",
                      item.tipo === "receita"
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    )}>
                      {item.tipo === "receita" ? "Receita" : "Despesa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground">{categoriaLabel(item.categoria)}</TableCell>
                  <TableCell className="text-foreground max-w-[200px] truncate">{item.descricao}</TableCell>
                  <TableCell className={cn("text-right font-mono text-sm",
                    item.tipo === "receita" ? "text-success" : "text-destructive"
                  )}>
                    {formatBRL(Number(item.valor))}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs",
                      item.status === "confirmado" ? "bg-success/10 text-success border-success/20" :
                      item.status === "pendente" ? "bg-warning/10 text-warning border-warning/20" :
                      "bg-muted text-muted-foreground border-border"
                    )}>
                      {item.status === "confirmado" ? "Confirmado" : item.status === "pendente" ? "Pendente" : "Cancelado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.comprovante_url && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={item.comprovante_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => { setEditingItem(item); setDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        totalItems={lancamentos.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[20, 50, 100]}
      />

      {/* Dialog */}
      <LancamentoDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingItem(null); }}
        lancamento={editingItem}
        filtrosAtuais={filtros}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
