/**
 * UCsListPage — Main list page for Unidades Consumidoras.
 * GD Geradora UCs show as expandable parent rows with beneficiaries nested below.
 */
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { unitService, type UCRecord } from "@/services/unitService";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Archive, Edit, Building2, AlertTriangle, ChevronLeft, ChevronRight, Zap, ShieldAlert, CheckCircle2, ArchiveIcon, ChevronDown, ChevronRight as ChevronRightIcon, Sun, Users, CornerDownRight, GitBranch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UCFormDialog } from "./UCFormDialog";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { GDConsolidadoTab } from "./GDConsolidadoTab";

const UC_TYPE_LABELS: Record<string, string> = {
  consumo: "Beneficiária",
  gd_geradora: "GD Geradora",
  mista: "Mista",
  beneficiaria: "Beneficiária",
};

type QuickFilter = "all" | "no_concessionaria" | "no_billing" | "archived";

const PAGE_SIZE = 25;

/** Fetch GD groups with their beneficiaries for tree view */
function useGdGroupsTree() {
  return useQuery({
    queryKey: ["gd_groups_tree"],
    queryFn: async () => {
      const { data: groups, error: gErr } = await supabase
        .from("gd_groups")
        .select("id, nome, uc_geradora_id, status")
        .eq("status", "active");
      if (gErr) throw gErr;

      const { data: bens, error: bErr } = await supabase
        .from("gd_group_beneficiaries")
        .select("gd_group_id, uc_beneficiaria_id, allocation_percent, is_active")
        .eq("is_active", true);
      if (bErr) throw bErr;

      // Map: generatorUcId -> { groupName, beneficiaryUcIds[] }
      const tree = new Map<string, { groupId: string; groupName: string; beneficiaries: Array<{ ucId: string; percent: number }> }>();
      for (const g of (groups || [])) {
        tree.set(g.uc_geradora_id, {
          groupId: g.id,
          groupName: g.nome,
          beneficiaries: [],
        });
      }
      for (const b of (bens || [])) {
        const group = [...tree.values()].find(t => t.groupId === b.gd_group_id);
        if (group) {
          group.beneficiaries.push({ ucId: b.uc_beneficiaria_id, percent: Number(b.allocation_percent) });
        }
      }
      return tree;
    },
    staleTime: 1000 * 60 * 5,
  });
}

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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: allUcs = [], isLoading, error } = useQuery({
    queryKey: ["units_consumidoras", tipoFilter, search],
    queryFn: () => unitService.list({
      tipo_uc: tipoFilter !== "all" ? tipoFilter : undefined,
      search: search || undefined,
    }),
    staleTime: 1000 * 60 * 5,
  });

  const { data: gdTree } = useGdGroupsTree();

  const counts = useMemo(() => {
    const active = allUcs.filter(u => !u.is_archived);
    return {
      all: active.length,
      no_concessionaria: active.filter(u => !u.concessionaria_id && !u.concessionaria_nome).length,
      no_billing: 0,
      archived: allUcs.filter(u => u.is_archived).length,
    };
  }, [allUcs]);

  const filteredUcs = useMemo(() => {
    let result = allUcs;
    switch (quickFilter) {
      case "no_concessionaria":
        result = result.filter(u => !u.is_archived && (!u.concessionaria_id && !u.concessionaria_nome));
        break;
      case "no_billing":
        result = result.filter(u => !u.is_archived);
        break;
      case "archived":
        result = result.filter(u => u.is_archived);
        break;
      default:
        result = result.filter(u => !u.is_archived);
    }
    return result;
  }, [allUcs, quickFilter]);

  // Build ordered list: GD Geradora rows first, then non-GD UCs
  // Beneficiary UCs that belong to a group are hidden from top-level and shown nested
  const { topLevelUcs, beneficiaryMap, ucMap } = useMemo(() => {
    const ucMap = new Map(filteredUcs.map(u => [u.id, u]));
    const beneficiaryUcIds = new Set<string>();

    if (gdTree) {
      for (const [, group] of gdTree) {
        for (const b of group.beneficiaries) {
          beneficiaryUcIds.add(b.ucId);
        }
      }
    }

    // Top-level: all UCs except those that are beneficiaries of a group
    const topLevel = filteredUcs.filter(u => !beneficiaryUcIds.has(u.id));

    // Sort: GD Geradoras first, then the rest
    topLevel.sort((a, b) => {
      const aIsGd = gdTree?.has(a.id) ? 0 : 1;
      const bIsGd = gdTree?.has(b.id) ? 0 : 1;
      if (aIsGd !== bIsGd) return aIsGd - bIsGd;
      return a.nome.localeCompare(b.nome);
    });

    // Build beneficiary map for quick lookup
    const benMap = new Map<string, Array<{ uc: UCRecord; percent: number }>>();
    if (gdTree) {
      for (const [generatorId, group] of gdTree) {
        const bens: Array<{ uc: UCRecord; percent: number }> = [];
        for (const b of group.beneficiaries) {
          const uc = ucMap.get(b.ucId);
          if (uc) bens.push({ uc, percent: b.percent });
        }
        if (bens.length > 0) benMap.set(generatorId, bens);
      }
    }

    return { topLevelUcs: topLevel, beneficiaryMap: benMap, ucMap };
  }, [filteredUcs, gdTree]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(topLevelUcs.length / PAGE_SIZE)), [topLevelUcs.length]);
  const safeCurrentPage = Math.min(page, totalPages);
  const pagedUcs = useMemo(() => topLevelUcs.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE), [topLevelUcs, safeCurrentPage]);

  useEffect(() => setPage(1), [quickFilter, tipoFilter, search]);

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

  function toggleGroup(ucId: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(ucId)) next.delete(ucId);
      else next.add(ucId);
      return next;
    });
  }

  const filterTabs: { key: QuickFilter; label: string; count: number; icon: any }[] = [
    { key: "all", label: "Ativas", count: counts.all, icon: CheckCircle2 },
    { key: "no_concessionaria", label: "Sem Concessionária", count: counts.no_concessionaria, icon: ShieldAlert },
    { key: "no_billing", label: "Sem Credenciais", count: counts.no_billing, icon: AlertTriangle },
    { key: "archived", label: "Arquivadas", count: counts.archived, icon: ArchiveIcon },
  ];

  const kpiCards = [
    { label: "Total Ativas", value: counts.all, icon: Building2, borderCls: "border-l-primary", bgCls: "bg-primary/10", textCls: "text-primary" },
    { label: "Sem Concessionária", value: counts.no_concessionaria, icon: ShieldAlert, borderCls: "border-l-warning", bgCls: "bg-warning/10", textCls: "text-warning" },
    { label: "Sem Credenciais", value: counts.no_billing, icon: AlertTriangle, borderCls: "border-l-destructive", bgCls: "bg-destructive/10", textCls: "text-destructive" },
    { label: "Arquivadas", value: counts.archived, icon: ArchiveIcon, borderCls: "border-l-muted-foreground/40", bgCls: "bg-muted", textCls: "text-muted-foreground" },
  ];

  const isGdGenerator = (ucId: string) => gdTree?.has(ucId) ?? false;
  const hasBeneficiaries = (ucId: string) => (beneficiaryMap.get(ucId)?.length ?? 0) > 0;

  function renderUCRow(uc: UCRecord, isChild = false, percent?: number) {
    const isGenerator = isGdGenerator(uc.id);
    const hasBens = hasBeneficiaries(uc.id);
    const isExpanded = expandedGroups.has(uc.id);

    return (
      <TableRow
        key={uc.id}
        className={cn(
          "group hover:bg-muted/30 cursor-pointer transition-colors",
          isChild && "bg-muted/20",
          isGenerator && "border-l-2 border-l-primary/40"
        )}
        onClick={() => navigate(`/admin/ucs/${uc.id}`)}
      >
        <TableCell className="font-medium text-foreground">
          <div className="flex items-center gap-2">
            {isGenerator && hasBens && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => { e.stopPropagation(); toggleGroup(uc.id); }}
              >
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  : <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
                }
              </Button>
            )}
            {isChild && (
              <CornerDownRight className="w-4 h-4 text-muted-foreground/50 shrink-0 ml-2" />
            )}
            {!isGenerator && !isChild && <div className="w-6 shrink-0" />}
            <span className={cn(isChild && "text-sm")}>{uc.nome}</span>
          </div>
        </TableCell>
        <TableCell className="font-mono text-xs text-muted-foreground">{uc.codigo_uc}</TableCell>
        <TableCell className="text-sm text-foreground">{uc.concessionaria_nome || <span className="text-muted-foreground/50 italic">Não definida</span>}</TableCell>
        <TableCell>
          {isGenerator ? (
            <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
              <Sun className="w-3 h-3 mr-1" /> Geradora
            </Badge>
          ) : isChild ? (
            <Badge variant="outline" className="text-xs">
              <Users className="w-3 h-3 mr-1" /> Beneficiária
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              {UC_TYPE_LABELS[uc.tipo_uc] || uc.tipo_uc}
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {isChild && percent != null ? (
            <span className="font-mono">{percent.toFixed(2)}%</span>
          ) : (
            <>
              {uc.classificacao_grupo || "—"}{uc.classificacao_subgrupo ? ` - ${uc.classificacao_subgrupo}` : ""}
            </>
          )}
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
    );
  }

  return (
    <motion.div
      className="p-4 md:p-6 space-y-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* §26 Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Unidades Consumidoras</h1>
            <p className="text-sm text-muted-foreground">Gerencie UCs, faturas, medidores e vínculos com usinas</p>
          </div>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Adicionar Unidade
        </Button>
      </div>

      <Tabs defaultValue="lista" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lista" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Lista de UCs
          </TabsTrigger>
          <TabsTrigger value="gd" className="gap-1.5">
            <GitBranch className="w-3.5 h-3.5" /> GD Consolidado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-4 mt-0">

      {/* §27 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((kpi, i) => (
          <motion.div key={kpi.label} custom={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.35 }}>
            <Card className={cn("border-l-[3px] bg-card shadow-sm hover:shadow-md transition-shadow", kpi.borderCls)}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", kpi.bgCls)}>
                  <kpi.icon className={cn("w-5 h-5", kpi.textCls)} />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{isLoading ? "—" : kpi.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
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
            <Button
              key={tab.key}
              variant={quickFilter === tab.key ? "outline" : "ghost"}
              size="sm"
              onClick={() => setQuickFilter(tab.key)}
              className={cn(
                "text-xs gap-1.5",
                quickFilter === tab.key
                  ? "bg-primary/10 text-primary border-primary hover:bg-primary/15"
                  : "text-muted-foreground"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              <Badge variant="outline" className={cn(
                "ml-1 text-[10px] h-5 px-1.5",
                quickFilter === tab.key ? "border-primary/30 text-primary" : ""
              )}>
                {isLoading ? "…" : tab.count}
              </Badge>
            </Button>
          ))}
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Tipo de UC" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="beneficiaria">Beneficiária</SelectItem>
            <SelectItem value="gd_geradora">GD Geradora</SelectItem>
            <SelectItem value="mista">Mista</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* §4 Table with GD tree */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
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
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground">Denominação</TableHead>
                  <TableHead className="font-semibold text-foreground">Contrato</TableHead>
                  <TableHead className="font-semibold text-foreground">Concessionária</TableHead>
                  <TableHead className="font-semibold text-foreground">Tipo</TableHead>
                  <TableHead className="font-semibold text-foreground">Classificação</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedUcs.map((uc) => {
                  const isGenerator = isGdGenerator(uc.id);
                  const isExpanded = expandedGroups.has(uc.id);
                  const bens = beneficiaryMap.get(uc.id) || [];

                  return (
                    <AnimatePresence key={uc.id}>
                      {renderUCRow(uc)}
                      {isGenerator && isExpanded && bens.map(({ uc: benUc, percent }) => (
                        <motion.tr
                          key={`ben-${benUc.id}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="hover:bg-muted/30 cursor-pointer transition-colors bg-muted/20"
                          onClick={() => navigate(`/admin/ucs/${benUc.id}`)}
                        >
                          <TableCell className="font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              <div className="w-6 shrink-0" />
                              <CornerDownRight className="w-4 h-4 text-muted-foreground/50 shrink-0 ml-2" />
                              <span className="text-sm">{benUc.nome}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{benUc.codigo_uc}</TableCell>
                          <TableCell className="text-sm text-foreground">{benUc.concessionaria_nome || <span className="text-muted-foreground/50 italic">Não definida</span>}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              <Users className="w-3 h-3 mr-1" /> Beneficiária
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <span className="font-mono">{percent.toFixed(2)}%</span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge variant={benUc.is_archived ? "muted" : benUc.status === "active" ? "success" : "warning"} dot>
                              {benUc.is_archived ? "Arquivada" : benUc.status === "active" ? "Ativa" : benUc.status}
                            </StatusBadge>
                          </TableCell>
                          <TableCell />
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
              <span className="text-xs">
                {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, topLevelUcs.length)} de {topLevelUcs.length}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "ghost"}
                    size="icon"
                    className="h-7 w-7 text-xs"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
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
        </TabsContent>

        <TabsContent value="gd" className="mt-0">
          <GDConsolidadoTab />
        </TabsContent>
      </Tabs>

      <UCFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingUC={editingUC}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["units_consumidoras"] });
          setDialogOpen(false);
        }}
      />
    </motion.div>
  );
}
