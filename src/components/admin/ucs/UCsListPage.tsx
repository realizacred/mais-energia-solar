/**
 * UCsListPage — Main list page for Unidades Consumidoras.
 * Improved with filter tabs + badge counts, pagination, and better UX.
 */
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { unitService, type UCRecord } from "@/services/unitService";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Archive, Edit, Building2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UCFormDialog } from "./UCFormDialog";
import { cn } from "@/lib/utils";

const UC_TYPE_LABELS: Record<string, string> = {
  consumo: "Consumo",
  gd_geradora: "GD Geradora",
  beneficiaria: "Beneficiária",
};

const UC_TYPE_COLORS: Record<string, "default" | "success" | "info"> = {
  consumo: "default",
  gd_geradora: "success",
  beneficiaria: "info",
};

type QuickFilter = "all" | "no_concessionaria" | "no_billing" | "archived";

const PAGE_SIZE = 25;

export default function UCsListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUC, setEditingUC] = useState<UCRecord | null>(null);
  const [page, setPage] = useState(1);

  // Fetch all UCs (without archive filter — we compute tabs client-side)
  const { data: allUcs = [], isLoading, error } = useQuery({
    queryKey: ["units_consumidoras", tipoFilter, search],
    queryFn: () => unitService.list({
      tipo_uc: tipoFilter !== "all" ? tipoFilter : undefined,
      search: search || undefined,
    }),
  });

  // Compute filter counts
  const counts = useMemo(() => {
    const active = allUcs.filter(u => !u.is_archived);
    return {
      all: active.length,
      no_concessionaria: active.filter(u => !u.concessionaria_id && !u.concessionaria_nome).length,
      no_billing: active.filter(u => !u.concessionaria_nome).length, // proxy for missing billing config
      archived: allUcs.filter(u => u.is_archived).length,
    };
  }, [allUcs]);

  // Apply quick filter
  const filteredUcs = useMemo(() => {
    let result = allUcs;
    switch (quickFilter) {
      case "no_concessionaria":
        result = result.filter(u => !u.is_archived && (!u.concessionaria_id && !u.concessionaria_nome));
        break;
      case "no_billing":
        result = result.filter(u => !u.is_archived && !u.concessionaria_nome);
        break;
      case "archived":
        result = result.filter(u => u.is_archived);
        break;
      default:
        result = result.filter(u => !u.is_archived);
    }
    return result;
  }, [allUcs, quickFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredUcs.length / PAGE_SIZE));
  const pagedUcs = filteredUcs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  useMemo(() => setPage(1), [quickFilter, tipoFilter, search]);

  const archiveMut = useMutation({
    mutationFn: (id: string) => unitService.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units_consumidoras"] });
      toast({ title: "UC arquivada com sucesso" });
    },
  });

  function handleEdit(uc: UCRecord) {
    setEditingUC(uc);
    setDialogOpen(true);
  }

  function handleCreate() {
    setEditingUC(null);
    setDialogOpen(true);
  }

  const filterTabs: { key: QuickFilter; label: string; count: number; variant: string }[] = [
    { key: "all", label: "Todos", count: counts.all, variant: "bg-primary text-primary-foreground" },
    { key: "no_concessionaria", label: "Concessionárias Ausentes", count: counts.no_concessionaria, variant: "bg-warning text-warning-foreground" },
    { key: "no_billing", label: "Credenciais Ausentes", count: counts.no_billing, variant: "bg-destructive text-destructive-foreground" },
    { key: "archived", label: "Arquivadas", count: counts.archived, variant: "bg-success text-success-foreground" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Unidades Consumidoras"
        description="Gerencie UCs, faturas, medidores e vínculos com usinas"
        actions={
          <Button onClick={handleCreate} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Adicionar Unidade
          </Button>
        }
      />

      <SectionCard>
        {/* Search + Quick Filters */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="denominação, contrato..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {filterTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setQuickFilter(tab.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                    quickFilter === tab.key
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {tab.label}
                  <span className={cn(
                    "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold",
                    quickFilter === tab.key ? tab.variant : "bg-muted text-muted-foreground"
                  )}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {/* Type filter */}
          <div className="flex items-center gap-2">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Tipo de UC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="consumo">Consumo</SelectItem>
                <SelectItem value="gd_geradora">GD Geradora</SelectItem>
                <SelectItem value="beneficiaria">Beneficiária</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Erro ao carregar" description={String(error)} />
        ) : filteredUcs.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={quickFilter === "all" ? "Nenhuma UC cadastrada" : "Nenhuma UC neste filtro"}
            description={quickFilter === "all" ? "Cadastre sua primeira unidade consumidora para começar a gerenciar faturas e medidores." : "Não há UCs correspondentes ao filtro selecionado."}
            action={quickFilter === "all" ? { label: "Nova UC", onClick: handleCreate, icon: Plus } : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Denominação</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Concessionária</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedUcs.map((uc) => (
                    <TableRow key={uc.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/ucs/${uc.id}`)}>
                      <TableCell className="font-medium text-primary">{uc.nome}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{uc.codigo_uc}</TableCell>
                      <TableCell className="text-sm">{uc.concessionaria_nome || <span className="text-muted-foreground/50 italic">Não definida</span>}</TableCell>
                      <TableCell>
                        <Badge variant={UC_TYPE_COLORS[uc.tipo_uc] || "default"} className="text-xs">
                          {UC_TYPE_LABELS[uc.tipo_uc] || uc.tipo_uc}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {uc.classificacao_grupo || "—"}{uc.classificacao_subgrupo ? ` - ${uc.classificacao_subgrupo}` : ""}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={uc.is_archived ? "muted" : uc.status === "active" ? "success" : "warning"} dot>
                          {uc.is_archived ? "Arquivada" : uc.status === "active" ? "Ativa" : uc.status}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(uc)} title="Editar">
                            <Edit className="w-4 h-4" />
                          </Button>
                          {!uc.is_archived && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => archiveMut.mutate(uc.id)} title="Arquivar">
                              <Archive className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4 text-sm text-muted-foreground">
                <span className="text-xs">
                  {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, filteredUcs.length)} de {filteredUcs.length}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={cn(
                        "h-7 w-7 rounded text-xs font-medium transition-colors",
                        page === pageNum ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                {totalPages > 5 && <span>...</span>}
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </SectionCard>

      <UCFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingUC={editingUC}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["units_consumidoras"] });
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
