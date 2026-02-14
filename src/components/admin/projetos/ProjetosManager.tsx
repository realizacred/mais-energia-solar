import { useState, useMemo } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useProjetoPipeline } from "@/hooks/useProjetoPipeline";
import { PageHeader, LoadingState } from "@/components/ui-kit";
import { ProjetoFunilSelector } from "./ProjetoFunilSelector";
import { ProjetoFilters } from "./ProjetoFilters";
import { ProjetoKanban } from "./ProjetoKanban";
import { ProjetoListView } from "./ProjetoListView";

export function ProjetosManager() {
  const {
    funis, etapas, projetos, loading,
    selectedFunilId, setSelectedFunilId,
    selectedFunilEtapas, projetosByEtapa,
    consultoresFilter,
    createFunil, renameFunil, toggleFunilAtivo, reorderFunis,
    moveProjetoToEtapa,
  } = useProjetoPipeline();

  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("todos");
  const [filterConsultor, setFilterConsultor] = useState("todos");

  const visibleEtapas = useMemo(() => {
    if (filterCategoria === "todos") return selectedFunilEtapas;
    return selectedFunilEtapas.filter(e => e.categoria === filterCategoria);
  }, [selectedFunilEtapas, filterCategoria]);

  const filteredProjetos = useMemo(() => {
    return projetos.filter(p => {
      if (selectedFunilId && p.funil_id !== selectedFunilId && p.funil_id !== null) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches = (p.cliente?.nome || "").toLowerCase().includes(q) ||
          (p.codigo || "").toLowerCase().includes(q) ||
          (p.consultor?.nome || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (filterCategoria !== "todos") {
        const etapa = etapas.find(e => e.id === p.etapa_id);
        if (!etapa || etapa.categoria !== filterCategoria) return false;
      }
      if (filterConsultor !== "todos" && p.consultor_id !== filterConsultor) return false;
      return true;
    });
  }, [projetos, selectedFunilId, searchTerm, filterCategoria, filterConsultor, etapas]);

  const filteredByEtapa = useMemo(() => {
    const map = new Map<string | null, typeof filteredProjetos>();
    filteredProjetos.forEach(p => {
      const key = p.etapa_id || null;
      const arr = map.get(key) || [];
      arr.push(p);
      map.set(key, arr);
    });
    return map;
  }, [filteredProjetos]);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterCategoria("todos");
    setFilterConsultor("todos");
  };

  // Summary stats
  const totalValue = useMemo(() => {
    return filteredProjetos.reduce((sum, p) => sum + (p.valor_total || 0), 0);
  }, [filteredProjetos]);

  const formatBRL = (v: number) => {
    if (!v) return "R$ 0";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
  };

  if (loading) return <LoadingState message="Carregando projetos..." />;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <PageHeader
          icon={FolderKanban}
          title="Projetos"
          description="Pipeline de vendas e gestão de projetos"
        />
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Projeto
        </Button>
      </div>

      {/* Funnel tabs */}
      <div className="rounded-xl border border-border/60 bg-card">
        <div className="px-4 py-2.5">
          <ProjetoFunilSelector
            funis={funis}
            selectedId={selectedFunilId}
            onSelect={setSelectedFunilId}
            onCreate={createFunil}
            onRename={renameFunil}
            onToggleAtivo={toggleFunilAtivo}
            onReorder={reorderFunis}
          />
        </div>

        <Separator />

        {/* Toolbar */}
        <div className="px-4 py-2.5">
          <ProjetoFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterCategoria={filterCategoria}
            onFilterCategoriaChange={setFilterCategoria}
            filterConsultor={filterConsultor}
            onFilterConsultorChange={setFilterConsultor}
            consultores={consultoresFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onClearFilters={clearFilters}
          />
        </div>

        {/* Stats bar */}
        <div className="px-4 pb-3 flex items-center gap-3">
          <Badge variant="secondary" className="text-xs font-normal">
            {filteredProjetos.length} projetos
          </Badge>
          {totalValue > 0 && (
            <span className="text-xs text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{formatBRL(totalValue)}</span>
            </span>
          )}
          {visibleEtapas.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {visibleEtapas.length} etapas
            </span>
          )}
        </div>
      </div>

      {/* Kanban / List */}
      {viewMode === "kanban" ? (
        <ProjetoKanban
          etapas={visibleEtapas}
          projetosByEtapa={filteredByEtapa}
          onMoveProjeto={moveProjetoToEtapa}
        />
      ) : (
        <ProjetoListView
          projetos={filteredProjetos}
          etapas={selectedFunilEtapas}
        />
      )}
    </div>
  );
}
