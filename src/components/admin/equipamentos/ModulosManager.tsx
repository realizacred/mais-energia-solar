import { useState, useMemo } from "react";
import { Plus, Search, SunMedium, LayoutGrid, Table as TableIcon, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import type { Modulo } from "./modulos/types";
import { CELL_TYPES } from "./modulos/types";
import { useModulos, useModuloMutations } from "./modulos/useModulos";
import { ModuloCard } from "./modulos/ModuloCard";
import { ModuloViewModal } from "./modulos/ModuloViewModal";
import { ModuloFormDialog } from "./modulos/ModuloFormDialog";
import { ModuloImportDialog } from "./modulos/ModuloImportDialog";
import { DistributorImportDialog } from "./modulos/DistributorImportDialog";
import { ModuloTableView } from "./modulos/ModuloTableView";

type ViewMode = "cards" | "table";

export function ModulosManager() {
  const { data: modulos = [], isLoading } = useModulos();
  const { saveMutation, deleteMutation, toggleMutation } = useModuloMutations();

  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState<string>("all");
  const [filterFabricante, setFilterFabricante] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterBifacial, setFilterBifacial] = useState<string>("all");
  const [filterTensao, setFilterTensao] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const [viewModulo, setViewModulo] = useState<Modulo | null>(null);
  const [editModulo, setEditModulo] = useState<Modulo | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Modulo | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const fabricantes = useMemo(() => {
    const set = new Set(modulos.map((m) => m.fabricante));
    return Array.from(set).sort();
  }, [modulos]);

  const filtered = useMemo(() => modulos.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch = !search || `${m.fabricante} ${m.modelo} ${m.tipo_celula}`.toLowerCase().includes(q);
    const matchAtivo = filterAtivo === "all" || (filterAtivo === "ativo" ? m.ativo : !m.ativo);
    const matchFab = filterFabricante === "all" || m.fabricante === filterFabricante;
    const matchStatus = filterStatus === "all" || m.status === filterStatus;
    const matchTipo = filterTipo === "all" || m.tipo_celula === filterTipo;
    const matchBifacial = filterBifacial === "all" || (filterBifacial === "sim" ? m.bifacial : !m.bifacial);
    const matchTensao = filterTensao === "all" || m.tensao_sistema === filterTensao;
    return matchSearch && matchAtivo && matchFab && matchStatus && matchTipo && matchBifacial && matchTensao;
  }), [modulos, search, filterAtivo, filterFabricante, filterStatus, filterTipo, filterBifacial, filterTensao]);

  const isGlobal = (m: Modulo) => m.tenant_id === null;

  const openCreate = () => { setEditModulo(null); setFormOpen(true); };
  const openEdit = (m: Modulo) => { setEditModulo(m); setFormOpen(true); };

  const handleSave = (id: string | undefined, payload: Record<string, unknown>) => {
    saveMutation.mutate({ id, payload }, {
      onSuccess: () => setFormOpen(false),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={SunMedium}
        title="Módulos Fotovoltaicos"
        description={`${modulos.length} módulos cadastrados (${fabricantes.length} fabricantes)`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4" /> Importar
            </Button>
            <Button size="sm" onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Novo Módulo
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar fabricante, modelo..." className="pl-9"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1 border rounded-md p-0.5">
              <Button variant={viewMode === "cards" ? "secondary" : "ghost"} size="icon" className="h-8 w-8"
                onClick={() => setViewMode("cards")}><LayoutGrid className="w-4 h-4" /></Button>
              <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="icon" className="h-8 w-8"
                onClick={() => setViewMode("table")}><TableIcon className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterFabricante} onValueChange={setFilterFabricante}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Fabricante" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos fabricantes</SelectItem>
                {fabricantes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Tecnologia" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas tecnologias</SelectItem>
                {CELL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="revisao">Revisão</SelectItem>
                <SelectItem value="publicado">Publicado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterBifacial} onValueChange={setFilterBifacial}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Bifacial" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sim">Bifacial</SelectItem>
                <SelectItem value="nao">Monofacial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterTensao} onValueChange={setFilterTensao}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Tensão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="1000V">1000V</SelectItem>
                <SelectItem value="1500V">1500V</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAtivo} onValueChange={setFilterAtivo}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-40" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
              <SunMedium className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">Nenhum módulo encontrado</p>
            <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre um novo módulo.</p>
            <Button size="sm" onClick={openCreate} className="mt-4 gap-2">
              <Plus className="w-4 h-4" /> Novo Módulo
            </Button>
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(m => (
              <ModuloCard
                key={m.id}
                modulo={m}
                isGlobal={isGlobal(m)}
                onView={() => setViewModulo(m)}
                onEdit={() => openEdit(m)}
                onToggle={(v) => toggleMutation.mutate({ id: m.id, ativo: v })}
              />
            ))}
          </div>
        ) : (
          <ModuloTableView
            modulos={filtered}
            onView={(m) => setViewModulo(m)}
            onEdit={(m) => openEdit(m)}
            onDelete={(m) => setDeleting(m)}
            onToggle={(id, v) => toggleMutation.mutate({ id, ativo: v })}
          />
        )}

        {/* Results count */}
        {!isLoading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {filtered.length} de {modulos.length} módulos
          </p>
        )}
      </div>

      {/* Modals */}
      <ModuloViewModal modulo={viewModulo} open={!!viewModulo} onOpenChange={v => !v && setViewModulo(null)} />
      <ModuloFormDialog
        modulo={editModulo}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSave={handleSave}
        isPending={saveMutation.isPending}
      />
      <ModuloImportDialog open={importOpen} onOpenChange={setImportOpen} existingModulos={modulos} />

      {/* Delete */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Módulo</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir "{deleting?.fabricante} {deleting?.modelo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleting && deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
