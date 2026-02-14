import { useState, useRef } from "react";
import {
  Plus, Pencil, Check, X, Trash2, GripHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ProjetoEtapaCategoria } from "@/hooks/useProjetoPipeline";

const CATEGORIAS: { value: ProjetoEtapaCategoria; label: string; dot: string; bg: string }[] = [
  { value: "aberto", label: "Aberto", dot: "bg-blue-500", bg: "border-blue-500/40 bg-blue-500/5" },
  { value: "ganho", label: "Ganho", dot: "bg-emerald-500", bg: "border-emerald-500/40 bg-emerald-500/5" },
  { value: "perdido", label: "Perdido", dot: "bg-red-500", bg: "border-red-500/40 bg-red-500/5" },
  { value: "excluido", label: "Excluído", dot: "bg-muted-foreground", bg: "border-muted-foreground/40 bg-muted/30" },
];

interface EtapaItem {
  id: string;
  funil_id: string;
  nome: string;
  cor: string;
  ordem: number;
  categoria: ProjetoEtapaCategoria;
  tenant_id: string;
}

interface Props {
  funilId: string;
  funilNome: string;
  etapas: EtapaItem[];
  onCreate: (funilId: string, nome: string, categoria?: ProjetoEtapaCategoria) => void;
  onRename: (id: string, nome: string) => void;
  onUpdateCor: (id: string, cor: string) => void;
  onUpdateCategoria: (id: string, categoria: ProjetoEtapaCategoria) => void;
  onReorder: (funilId: string, orderedIds: string[]) => void;
  onDelete: (id: string) => void;
}

export function ProjetoEtapaManager({
  funilId, funilNome, etapas, onCreate, onRename, onUpdateCor, onUpdateCategoria, onReorder, onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategoria, setNewCategoria] = useState<ProjetoEtapaCategoria>("aberto");
  const [showCreate, setShowCreate] = useState(false);

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const sorted = [...etapas].sort((a, b) => a.ordem - b.ordem);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== draggedId) setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const ids = sorted.map(et => et.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);
    onReorder(funilId, ids);
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleCreate = () => {
    if (newName.trim()) {
      onCreate(funilId, newName.trim(), newCategoria);
      setNewName("");
      setNewCategoria("aberto");
      setShowCreate(false);
    }
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      onRename(id, editName.trim());
      setEditingId(null);
    }
  };

  const catInfo = (cat: ProjetoEtapaCategoria) => CATEGORIAS.find(c => c.value === cat) || CATEGORIAS[0];

  return (
    <div className="space-y-4">
      {/* Instruction */}
      <p className="text-xs text-muted-foreground">
        Arraste os cards para reordenar as etapas. A ordem define o fluxo do funil.
      </p>

      {/* Kanban horizontal */}
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-3 px-1" style={{ minWidth: "max-content" }}>
          {sorted.map((etapa, i) => {
            const cat = catInfo(etapa.categoria);
            const isDragging = draggedId === etapa.id;
            const isDragOver = dragOverId === etapa.id;

            return (
              <div
                key={etapa.id}
                draggable={editingId !== etapa.id}
                onDragStart={e => handleDragStart(e, etapa.id)}
                onDragOver={e => handleDragOver(e, etapa.id)}
                onDragLeave={() => setDragOverId(null)}
                onDrop={e => handleDrop(e, etapa.id)}
                onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                className={cn(
                  "w-[180px] flex-shrink-0 rounded-2xl border-2 p-3 transition-all duration-150",
                  "cursor-grab active:cursor-grabbing",
                  cat.bg,
                  isDragging && "opacity-40 scale-95",
                  isDragOver && "ring-2 ring-primary/50 scale-[1.02]"
                )}
              >
                {/* Position badge */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-muted-foreground bg-background/80 rounded-full px-2 py-0.5">
                    #{i + 1}
                  </span>
                  <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/50" />
                </div>

                {/* Name - editable */}
                {editingId === etapa.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === "Enter") handleRename(etapa.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRename(etapa.id)}>
                        <Check className="h-3.5 w-3.5 text-success" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <h4 className="text-sm font-bold text-foreground truncate mb-2" title={etapa.nome}>
                    {etapa.nome}
                  </h4>
                )}

                {/* Categoria */}
                <div className="flex items-center gap-1.5 mb-3">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", cat.dot)} />
                  <span className="text-[10px] font-medium text-muted-foreground">{cat.label}</span>
                </div>

                {/* Actions */}
                {editingId !== etapa.id && (
                  <div className="flex items-center gap-1 border-t border-border/40 pt-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setEditingId(etapa.id); setEditName(etapa.nome); }}
                      title="Renomear"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover etapa "{etapa.nome}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Projetos nesta etapa ficarão sem etapa definida. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDelete(etapa.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add new card */}
          {showCreate ? (
            <div className="w-[200px] flex-shrink-0 rounded-2xl border-2 border-dashed border-primary/30 p-3 bg-primary/5 space-y-2">
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nome da etapa..."
                className="h-8 text-sm"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") { setShowCreate(false); setNewName(""); }
                }}
              />
              <Select value={newCategoria} onValueChange={v => setNewCategoria(v as ProjetoEtapaCategoria)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", c.dot)} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1">
                <Button size="sm" className="h-8 flex-1 text-xs" onClick={handleCreate}>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Criar
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowCreate(false); setNewName(""); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className={cn(
                "w-[140px] flex-shrink-0 rounded-2xl border-2 border-dashed border-primary/30",
                "flex flex-col items-center justify-center gap-2 py-6",
                "text-primary/60 hover:text-primary hover:border-primary/50 hover:bg-primary/5",
                "transition-all duration-200 cursor-pointer"
              )}
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs font-medium">Nova Etapa</span>
            </button>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
