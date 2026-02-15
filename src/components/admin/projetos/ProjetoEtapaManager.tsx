import { useState } from "react";
import {
  Plus, Pencil, Check, X, Trash2, GripVertical,
  ArrowRight, Target, Trophy, XCircle, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ProjetoEtapaCategoria } from "@/hooks/useProjetoPipeline";

const CATEGORIAS: {
  value: ProjetoEtapaCategoria;
  label: string;
  dot: string;
  bg: string;
  border: string;
  icon: typeof Target;
  description: string;
}[] = [
  {
    value: "aberto",
    label: "Aberto",
    dot: "bg-info",
    bg: "bg-info/5",
    border: "border-info/30",
    icon: Target,
    description: "Etapa de trabalho ativo",
  },
  {
    value: "ganho",
    label: "Ganho",
    dot: "bg-success",
    bg: "bg-success/5",
    border: "border-success/30",
    icon: Trophy,
    description: "Projeto convertido com sucesso",
  },
  {
    value: "perdido",
    label: "Perdido",
    dot: "bg-destructive",
    bg: "bg-destructive/5",
    border: "border-destructive/30",
    icon: XCircle,
    description: "Projeto perdido ou cancelado",
  },
  {
    value: "excluido",
    label: "Excluído",
    dot: "bg-muted-foreground",
    bg: "bg-muted/20",
    border: "border-muted-foreground/20",
    icon: Trash2,
    description: "Etapa descartada",
  },
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
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Layers className="h-4 w-4" />
          <span className="font-semibold text-foreground">{etapas.length}</span> etapa{etapas.length !== 1 ? "s" : ""} configurada{etapas.length !== 1 ? "s" : ""}
        </div>
        {CATEGORIAS.filter(c => etapas.some(e => e.categoria === c.value)).map(cat => (
          <Badge key={cat.value} variant="outline" className="gap-1.5 text-[11px] font-medium">
            <span className={cn("w-2 h-2 rounded-full", cat.dot)} />
            {etapas.filter(e => e.categoria === cat.value).length} {cat.label}
          </Badge>
        ))}
      </div>

      {/* Flow visualization */}
      <div className="flex items-center gap-1 px-1 py-3 overflow-x-auto">
        {sorted.map((etapa, i) => {
          const cat = catInfo(etapa.categoria);
          return (
            <div key={etapa.id} className="flex items-center gap-1 shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className={cn(
                      "h-2 rounded-full transition-all",
                      cat.dot,
                      "w-16"
                    )} />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-semibold">{etapa.nome}</p>
                    <p className="text-muted-foreground">{cat.label}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {i < sorted.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Stage cards */}
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 px-1" style={{ minWidth: "max-content" }}>
          {sorted.map((etapa, i) => {
            const cat = catInfo(etapa.categoria);
            const CatIcon = cat.icon;
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
                  "w-[240px] flex-shrink-0 rounded-xl border-2 transition-all duration-200",
                  "cursor-grab active:cursor-grabbing",
                  "hover:shadow-md",
                  cat.bg, cat.border,
                  isDragging && "opacity-30 scale-95",
                  isDragOver && "ring-2 ring-primary/40 scale-[1.02]"
                )}
              >
                {/* Header */}
                <div className="px-4 pt-4 pb-2 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-bold h-5 px-2 bg-background/80">
                      Etapa #{i + 1}
                    </Badge>
                  </div>
                  <GripVertical className="h-4 w-4 text-muted-foreground/30 mt-0.5" />
                </div>

                {/* Body */}
                <div className="px-4 pb-3">
                  {editingId === etapa.id ? (
                    <div className="space-y-2.5">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="h-9 text-sm font-semibold"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === "Enter") handleRename(etapa.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-8 flex-1 text-xs" onClick={() => handleRename(etapa.id)}>
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Salvar
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h4 className="text-base font-bold text-foreground leading-tight mb-2" title={etapa.nome}>
                        {etapa.nome}
                      </h4>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", cat.dot)} />
                        <span className="text-xs font-semibold text-muted-foreground">{cat.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                        {cat.description}
                      </p>
                    </>
                  )}
                </div>

                {/* Footer */}
                {editingId !== etapa.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-border/20 flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-background/60"
                            onClick={() => { setEditingId(etapa.id); setEditName(etapa.nome); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Renomear</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <AlertDialog>
                      <TooltipProvider>
                        <Tooltip>
                          <AlertDialogTrigger asChild>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                          </AlertDialogTrigger>
                          <TooltipContent side="bottom" className="text-xs">Excluir</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
            <div className="w-[260px] flex-shrink-0 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 space-y-3">
              <h4 className="text-sm font-bold text-foreground">Nova Etapa</h4>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nome da etapa..."
                className="h-10 text-sm"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") { setShowCreate(false); setNewName(""); }
                }}
              />
              <Select value={newCategoria} onValueChange={v => setNewCategoria(v as ProjetoEtapaCategoria)}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">
                      <span className="flex items-center gap-2">
                        <span className={cn("w-2.5 h-2.5 rounded-full", c.dot)} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-10 flex-1 text-xs rounded-lg" onClick={handleCreate}>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Criar Etapa
                </Button>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg" onClick={() => { setShowCreate(false); setNewName(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className={cn(
                "w-[180px] flex-shrink-0 rounded-xl border-2 border-dashed border-primary/30",
                "flex flex-col items-center justify-center gap-3 py-10",
                "text-primary/50 hover:text-primary hover:border-primary/50 hover:bg-primary/5",
                "transition-all duration-200 cursor-pointer"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-semibold">Nova Etapa</span>
            </button>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
