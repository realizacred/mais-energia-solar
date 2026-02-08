import { useState } from "react";
import {
  FileText, Plus, Search, Eye, Trash2, Loader2, Zap, DollarSign,
  SunMedium, MoreHorizontal,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePropostas, type Proposta } from "@/hooks/usePropostas";
import { NovaPropostaDialog } from "./propostas/NovaPropostaDialog";
import { PropostaDetailDialog } from "./propostas/PropostaDetailDialog";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  enviada: { label: "Enviada", color: "bg-info/15 text-info" },
  visualizada: { label: "Visualizada", color: "bg-warning/15 text-warning" },
  aceita: { label: "Aceita", color: "bg-success/15 text-success" },
  recusada: { label: "Recusada", color: "bg-destructive/15 text-destructive" },
  expirada: { label: "Expirada", color: "bg-muted text-muted-foreground" },
};

function formatCurrency(value: number | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function PropostasManager() {
  const {
    propostas, loading, creating, createProposta, deleteProposta, updateStatus,
  } = usePropostas();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailProposta, setDetailProposta] = useState<Proposta | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Filter
  const filtered = propostas.filter((p) => {
    const matchesSearch =
      !search ||
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.cliente_nome?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: propostas.length,
    enviadas: propostas.filter((p) => p.status === "enviada").length,
    aceitas: propostas.filter((p) => p.status === "aceita").length,
    valorTotal: propostas
      .filter((p) => p.status === "aceita")
      .reduce((acc, p) => acc + (p.preco_total || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Propostas Comerciais</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie propostas enviadas aos clientes
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova Proposta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-info">
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center shrink-0">
              <SunMedium className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.enviadas}</p>
              <p className="text-xs text-muted-foreground">Enviadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-success">
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.aceitas}</p>
              <p className="text-xs text-muted-foreground">Aceitas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-warning">
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</p>
              <p className="text-xs text-muted-foreground">Valor Aceitas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou cliente..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_MAP).map(([key, val]) => (
              <SelectItem key={key} value={key}>
                {val.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <FileText className="h-7 w-7 opacity-30" />
              </div>
              <p className="font-medium">
                {propostas.length === 0
                  ? "Nenhuma proposta cadastrada"
                  : "Nenhuma proposta encontrada"}
              </p>
              <p className="text-sm mt-1">
                {propostas.length === 0
                  ? "Clique em \"Nova Proposta\" para criar a primeira."
                  : "Tente alterar os filtros de busca."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="premium-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Proposta</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Potência</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const status = STATUS_MAP[p.status] || STATUS_MAP.rascunho;
                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer"
                        onClick={() => setDetailProposta(p)}
                      >
                        <TableCell>
                          <p className="font-medium truncate max-w-[200px]">
                            {p.nome}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm truncate max-w-[150px]">
                            {p.cliente_nome || "—"}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.vendedor?.nome || "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {p.potencia_kwp ? `${p.potencia_kwp} kWp` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(p.preco_total)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`${status.color} border-0 text-[11px]`}
                          >
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(p.created_at), "dd/MM/yy", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailProposta(p);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              {p.link_pdf && (
                                <DropdownMenuItem asChild>
                                  <a
                                    href={p.link_pdf}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Abrir PDF
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteId(p.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
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
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <NovaPropostaDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={createProposta}
        creating={creating}
      />

      <PropostaDetailDialog
        proposta={detailProposta}
        open={!!detailProposta}
        onOpenChange={(open) => !open && setDetailProposta(null)}
        onStatusChange={updateStatus}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A proposta e todos os dados
              relacionados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteProposta(deleteId);
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
