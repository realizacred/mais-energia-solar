import { useState, useMemo } from "react";
import { FolderKanban } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    createFunil, renameFunil,
    moveProjetoToEtapa,
  } = useProjetoPipeline();

  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("todos");
  const [filterConsultor, setFilterConsultor] = useState("todos");

  // Filter etapas by categoria
  const visibleEtapas = useMemo(() => {
    if (filterCategoria === "todos") return selectedFunilEtapas;
    return selectedFunilEtapas.filter(e => e.categoria === filterCategoria);
  }, [selectedFunilEtapas, filterCategoria]);

  // Filter projetos
  const filteredProjetos = useMemo(() => {
    return projetos.filter(p => {
      // Funil filter
      if (selectedFunilId && p.funil_id !== selectedFunilId && p.funil_id !== null) return false;

      // Search
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches = (p.cliente?.nome || "").toLowerCase().includes(q) ||
          (p.codigo || "").toLowerCase().includes(q) ||
          (p.consultor?.nome || "").toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Categoria filter
      if (filterCategoria !== "todos") {
        const etapa = etapas.find(e => e.id === p.etapa_id);
        if (!etapa || etapa.categoria !== filterCategoria) return false;
      }

      // Consultor filter
      if (filterConsultor !== "todos" && p.consultor_id !== filterConsultor) return false;

      return true;
    });
  }, [projetos, selectedFunilId, searchTerm, filterCategoria, filterConsultor, etapas]);

  // projetosByEtapa filtered for kanban
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

  if (loading) return <LoadingState message="Carregando projetos..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FolderKanban}
        title="Projetos"
        description="Gerencie seus projetos no funil de vendas"
      />

      {/* Funil selector */}
      <Card>
        <CardHeader className="pb-3">
          <ProjetoFunilSelector
            funis={funis}
            selectedId={selectedFunilId}
            onSelect={setSelectedFunilId}
            onCreate={createFunil}
            onRename={renameFunil}
          />
        </CardHeader>
        <CardContent className="pt-0">
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

          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{filteredProjetos.length} projetos</Badge>
          </div>
        </CardContent>
      </Card>

      {/* View */}
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
