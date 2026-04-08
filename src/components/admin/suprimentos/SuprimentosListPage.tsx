import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Plus, Search, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrdensCompra, OrdemCompraStatus } from "@/hooks/useOrdensCompra";
import { useFornecedoresNomes } from "@/hooks/useFornecedoresNomes";
import { NovaOrdemDialog } from "./NovaOrdemDialog";
import { formatBRL } from "@/lib/formatters";

const STATUS_LABELS: Record<OrdemCompraStatus, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  confirmada: "Confirmada",
  em_transito: "Em trânsito",
  recebida_parcial: "Recebida parcial",
  recebida: "Recebida",
  cancelada: "Cancelada",
};

const STATUS_COLORS: Record<OrdemCompraStatus, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  enviada: "bg-info/10 text-info border-info/20",
  confirmada: "bg-secondary/10 text-secondary border-secondary/20",
  em_transito: "bg-warning/10 text-warning border-warning/20",
  recebida_parcial: "bg-warning/10 text-warning border-warning/20",
  recebida: "bg-success/10 text-success border-success/20",
  cancelada: "bg-destructive/10 text-destructive border-destructive/20",
};

interface SuprimentosListPageProps {
  projetoId?: string;
}

export function SuprimentosListPage({ projetoId }: SuprimentosListPageProps) {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fornecedorFilter, setFornecedorFilter] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const [novaOrdemOpen, setNovaOrdemOpen] = useState(false);

  const filtros = {
    ...(statusFilter !== "all" ? { status: statusFilter as OrdemCompraStatus } : {}),
    ...(fornecedorFilter !== "all" ? { fornecedor_id: fornecedorFilter } : {}),
    ...(projetoId ? { projeto_id: projetoId } : {}),
    ...(busca ? { busca } : {}),
  };

  const { data: ordens, isLoading } = useOrdensCompra(filtros);
  const { data: fornecedores = [] } = useFornecedoresNomes();

  return (
    <div className="space-y-6">
      {/* Header */}
      {!projetoId && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Suprimentos</h1>
              <p className="text-sm text-muted-foreground">Ordens de compra e acompanhamento de entregas</p>
            </div>
          </div>
          <Button onClick={() => setNovaOrdemOpen(true)} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> Nova ordem
          </Button>
        </div>
      )}

      {projetoId && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Ordens de compra deste projeto</p>
          <Button size="sm" onClick={() => setNovaOrdemOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova ordem
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nº pedido..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!projetoId && (
          <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fornecedores</SelectItem>
              {fornecedores.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold text-foreground">Nº Pedido</TableHead>
              {!projetoId && <TableHead className="font-semibold text-foreground">Projeto</TableHead>}
              <TableHead className="font-semibold text-foreground">Fornecedor</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="font-semibold text-foreground">Previsão</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  {!projetoId && <TableCell><Skeleton className="h-4 w-32" /></TableCell>}
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))
            ) : !ordens?.length ? (
              <TableRow>
                <TableCell colSpan={projetoId ? 5 : 6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Nenhuma ordem de compra encontrada</p>
                    <Button variant="outline" size="sm" onClick={() => setNovaOrdemOpen(true)} className="mt-2 gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Criar primeira ordem
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              ordens.map((o) => (
                <TableRow
                  key={o.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/admin/suprimentos/${o.id}`)}
                >
                  <TableCell className="font-medium text-foreground">
                    {o.numero_pedido || "—"}
                  </TableCell>
                  {!projetoId && (
                    <TableCell className="text-sm text-muted-foreground">
                      {o.projeto_codigo || o.projeto_nome || "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-sm text-foreground">
                    {o.fornecedor_nome || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {o.data_previsao_entrega
                      ? new Date(o.data_previsao_entrega + "T12:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-foreground">
                    {formatBRL(o.valor_total || 0)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <NovaOrdemDialog
        open={novaOrdemOpen}
        onOpenChange={setNovaOrdemOpen}
        defaultProjetoId={projetoId}
      />
    </div>
  );
}

export default SuprimentosListPage;
