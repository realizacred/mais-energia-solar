import { useState } from "react";
import {
  Plus, Pencil, Check, X, Trash2, ArrowUp, ArrowDown, Settings2, Palette,
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
import { cn } from "@/lib/utils";
import type { ProjetoEtapa, ProjetoEtapaCategoria } from "@/hooks/useProjetoPipeline";

const CORES = [
  "#3B82F6", "#2563EB", "#06B6D4", "#14B8A6",
  "#10B981", "#22C55E", "#84CC16", "#EAB308",
  "#F59E0B", "#F97316", "#EF4444", "#E11D48",
  "#EC4899", "#A855F7", "#8B5CF6", "#6366F1",
  "#64748B", "#374151",
];

const CATEGORIAS: { value: ProjetoEtapaCategoria; label: string; dot: string }[] = [
  { value: "aberto", label: "Aberto", dot: "bg-blue-500" },
  { value: "ganho", label: "Ganho", dot: "bg-emerald-500" },
  { value: "perdido", label: "Perdido", dot: "bg-red-500" },
  { value: "excluido", label: "Excluído", dot: "bg-muted-foreground" },
];

interface Props {
  funilId: string;
  funilNome: string;
  etapas: ProjetoEtapa[];
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

  const sorted = [...etapas].sort((a, b) => a.ordem - b.ordem);

  const moveUp = (id: string) => {
    const ids = sorted.map(e => e.id);
    const idx = ids.indexOf(id);
    if (idx <= 0) return;
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    onReorder(funilId, ids);
  };

  const moveDown = (id: string) => {
    const ids = sorted.map(e => e.id);
    const idx = ids.indexOf(id);
    if (idx < 0 || idx >= ids.length - 1) return;
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    onReorder(funilId, ids);
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
    <div>

        <div className="space-y-1 mt-2">
          {sorted.map((etapa, i) => {
            const cat = catInfo(etapa.categoria);

            if (editingId === etapa.id) {
              return (
                <div key={etapa.id} className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="h-8 text-sm flex-1"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === "Enter") handleRename(etapa.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleRename(etapa.id)}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditingId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            }

            return (
              <div
                key={etapa.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors group"
              >
                {/* Order arrows */}
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => moveUp(etapa.id)}
                    disabled={i === 0}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                  >
                    <ArrowUp className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => moveDown(etapa.id)}
                    disabled={i === sorted.length - 1}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                  >
                    <ArrowDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>

                {/* Color dot / picker */}
                <div className="relative shrink-0 group/cor">
                  <div
                    className="w-4 h-4 rounded-full cursor-pointer ring-2 ring-transparent hover:ring-border transition-all"
                    style={{ backgroundColor: etapa.cor }}
                  />
                  <div className="absolute left-0 top-6 z-50 hidden group-hover/cor:grid grid-cols-6 gap-1 p-2 rounded-lg bg-popover border shadow-lg min-w-[160px]">
                    {CORES.map(cor => (
                      <button
                        key={cor}
                        onClick={() => onUpdateCor(etapa.id, cor)}
                        className={cn(
                          "w-5 h-5 rounded-full transition-transform hover:scale-125",
                          etapa.cor === cor && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                        )}
                        style={{ backgroundColor: cor }}
                      />
                    ))}
                  </div>
                </div>

                {/* Name */}
                <span className="text-sm font-medium flex-1 truncate">{etapa.nome}</span>

                {/* Categoria badge */}
                <Select
                  value={etapa.categoria}
                  onValueChange={(v) => onUpdateCategoria(etapa.id, v as ProjetoEtapaCategoria)}
                >
                  <SelectTrigger className="h-6 w-24 text-[10px] border-0 bg-muted/50">
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

                {/* Actions */}
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => { setEditingId(etapa.id); setEditName(etapa.nome); }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
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
                      <AlertDialogAction onClick={() => onDelete(etapa.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}
        </div>

        {/* Add new */}
        {showCreate ? (
          <div className="flex items-center gap-2 mt-3 p-3 rounded-lg border border-dashed border-border">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nome da etapa..."
              className="h-8 text-sm flex-1"
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") { setShowCreate(false); setNewName(""); }
              }}
            />
            <Select value={newCategoria} onValueChange={v => setNewCategoria(v as ProjetoEtapaCategoria)}>
              <SelectTrigger className="h-8 w-28 text-xs">
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
            <Button size="sm" className="h-8" onClick={handleCreate}>
              <Check className="h-3.5 w-3.5 mr-1" />
              Criar
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowCreate(false); setNewName(""); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full gap-1.5 border-dashed"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Etapa
          </Button>
        )}
    </div>
  );
}
