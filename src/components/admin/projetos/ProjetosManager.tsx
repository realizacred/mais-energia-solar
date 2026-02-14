import { useState, useMemo } from "react";
import { FolderKanban, Plus, Zap, DollarSign, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useProjetoPipeline } from "@/hooks/useProjetoPipeline";
import { PageHeader, LoadingState } from "@/components/ui-kit";
import { ProjetoFunilSelector } from "./ProjetoFunilSelector";
import { ProjetoFilters } from "./ProjetoFilters";
import { ProjetoKanbanOwner } from "./ProjetoKanbanOwner";
import { ProjetoListView } from "./ProjetoListView";
import { ProjetoEtapaManager } from "./ProjetoEtapaManager";

export function ProjetosManager() {
  const {
    funis, etapas, etiquetas, projetos, consultores, loading,
    selectedFunilId, setSelectedFunilId,
    filters, applyFilters,
    selectedFunilEtapas, consultorColumns,
    consultoresFilter,
    createFunil, renameFunil, toggleFunilAtivo, reorderFunis,
    createEtapa, renameEtapa, updateEtapaCor, updateEtapaCategoria, reorderEtapas, deleteEtapa,
    moveProjetoToConsultor,
  } = useProjetoPipeline();

  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");

  const handleFilterChange = (key: string, value: any) => {
    if (key === "funilId") {
      setSelectedFunilId(value === "todos" ? null : value);
      applyFilters({ funilId: value === "todos" ? null : value });
    } else if (key === "consultorId") {
      applyFilters({ consultorId: value });
    } else if (key === "status") {
      applyFilters({ status: value });
    } else if (key === "etiquetaIds") {
      applyFilters({ etiquetaIds: value });
    } else if (key === "search") {
      applyFilters({ search: value });
    }
  };

  const clearFilters = () => {
    applyFilters({ funilId: null, consultorId: "todos", status: "todos", etiquetaIds: [], search: "" });
    setSelectedFunilId(null);
  };

  const totalValue = useMemo(() => {
    return projetos.reduce((sum, p) => sum + (p.valor_total || 0), 0);
  }, [projetos]);

  const totalKwp = useMemo(() => {
    return projetos.reduce((sum, p) => sum + (p.potencia_kwp || 0), 0);
  }, [projetos]);

  const formatBRL = (v: number) => {
    if (!v) return "R$ 0";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
  };

  const selectedFunil = funis.find(f => f.id === selectedFunilId);

  if (loading) return <LoadingState message="Carregando projetos..." />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        icon={FolderKanban}
        title="Projetos"
        description="Pipeline de vendas e gestão de projetos"
      />

      {/* Main container */}
      <div className="rounded-xl border border-border/60 bg-card">
        {/* Funnel tabs */}
        <div className="px-4 py-2.5 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <ProjetoFunilSelector
              funis={funis}
              selectedId={selectedFunilId}
              onSelect={(id) => {
                setSelectedFunilId(id);
                applyFilters({ funilId: id });
              }}
              onCreate={createFunil}
              onRename={renameFunil}
              onToggleAtivo={toggleFunilAtivo}
              onReorder={reorderFunis}
            />
          </div>

          {selectedFunil && (
            <ProjetoEtapaManager
              funilId={selectedFunil.id}
              funilNome={selectedFunil.nome}
              etapas={selectedFunilEtapas}
              onCreate={createEtapa}
              onRename={renameEtapa}
              onUpdateCor={updateEtapaCor}
              onUpdateCategoria={updateEtapaCategoria}
              onReorder={reorderEtapas}
              onDelete={deleteEtapa}
            />
          )}
        </div>

        <Separator />

        {/* Filters */}
        <div className="px-4 py-2.5">
          <ProjetoFilters
            searchTerm={filters.search}
            onSearchChange={(v) => handleFilterChange("search", v)}
            funis={funis}
            filterFunil={filters.funilId || "todos"}
            onFilterFunilChange={(v) => handleFilterChange("funilId", v)}
            filterConsultor={filters.consultorId}
            onFilterConsultorChange={(v) => handleFilterChange("consultorId", v)}
            consultores={consultoresFilter}
            filterStatus={filters.status}
            onFilterStatusChange={(v) => handleFilterChange("status", v)}
            etiquetas={etiquetas}
            filterEtiquetas={filters.etiquetaIds}
            onFilterEtiquetasChange={(ids) => handleFilterChange("etiquetaIds", ids)}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onClearFilters={clearFilters}
          />
        </div>

        {/* Summary bar */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{projetos.length}</span>
              <span className="text-xs text-muted-foreground">projetos</span>
            </div>
            {totalValue > 0 && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-success" />
                <span className="text-sm font-semibold text-foreground">{formatBRL(totalValue)}</span>
              </div>
            )}
            {totalKwp > 0 && (
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-warning" />
                <span className="text-sm font-semibold text-foreground">{totalKwp.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWp</span>
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              {consultorColumns.length} responsáveis
            </span>
          </div>
        </div>
      </div>

      {/* Kanban / List */}
      {viewMode === "kanban" ? (
        <ProjetoKanbanOwner
          columns={consultorColumns}
          onMoveProjeto={moveProjetoToConsultor}
        />
      ) : (
        <ProjetoListView
          projetos={projetos}
          etapas={selectedFunilEtapas}
        />
      )}
    </div>
  );
}
