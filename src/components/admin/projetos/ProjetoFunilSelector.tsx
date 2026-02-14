import { useState } from "react";
import { Plus, Pencil, Check, X, MoreHorizontal, EyeOff, Eye, ArrowUp, ArrowDown, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ProjetoFunil } from "@/hooks/useProjetoPipeline";

interface Props {
  funis: ProjetoFunil[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (nome: string) => void;
  onRename: (id: string, nome: string) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function ProjetoFunilSelector({
  funis, selectedId, onSelect, onCreate, onRename, onToggleAtivo, onReorder,
}: Props) {
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const activeFunis = funis.filter(f => f.ativo).sort((a, b) => a.ordem - b.ordem);
  const inactiveFunis = funis.filter(f => !f.ativo).sort((a, b) => a.ordem - b.ordem);

  const handleCreate = () => {
    if (newName.trim()) {
      onCreate(newName.trim());
      setNewName("");
      setCreatingNew(false);
    }
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      onRename(id, editName.trim());
      setEditingId(null);
    }
  };

  const moveUp = (id: string) => {
    const ids = activeFunis.map(f => f.id);
    const idx = ids.indexOf(id);
    if (idx <= 0) return;
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    onReorder(ids);
  };

  const moveDown = (id: string) => {
    const ids = activeFunis.map(f => f.id);
    const idx = ids.indexOf(id);
    if (idx < 0 || idx >= ids.length - 1) return;
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    onReorder(ids);
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
      <Layers className="h-4 w-4 text-muted-foreground shrink-0 mr-1" />

      {/* Tabs-style funnel selector */}
      <div className="flex items-center border rounded-lg bg-muted/40 p-0.5 gap-0.5">
        {activeFunis.map((funil, i) => {
          const isSelected = selectedId === funil.id;

          if (editingId === funil.id) {
            return (
              <div key={funil.id} className="flex items-center gap-0.5 px-1">
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="h-7 w-28 text-xs"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter") handleRename(funil.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRename(funil.id)}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          }

          return (
            <div key={funil.id} className="flex items-center">
              <button
                onClick={() => onSelect(funil.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                  isSelected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                {funil.nome}
              </button>

              {isSelected && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-0.5 rounded hover:bg-muted transition-colors -ml-1 mr-0.5">
                      <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuItem onClick={() => {
                      setEditingId(funil.id);
                      setEditName(funil.nome);
                    }}>
                      <Pencil className="h-3.5 w-3.5 mr-2" />
                      Renomear
                    </DropdownMenuItem>
                    {i > 0 && (
                      <DropdownMenuItem onClick={() => moveUp(funil.id)}>
                        <ArrowUp className="h-3.5 w-3.5 mr-2" />
                        Mover para esquerda
                      </DropdownMenuItem>
                    )}
                    {i < activeFunis.length - 1 && (
                      <DropdownMenuItem onClick={() => moveDown(funil.id)}>
                        <ArrowDown className="h-3.5 w-3.5 mr-2" />
                        Mover para direita
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onToggleAtivo(funil.id, false)}
                      className="text-destructive focus:text-destructive"
                    >
                      <EyeOff className="h-3.5 w-3.5 mr-2" />
                      Desativar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>

      {/* Create new */}
      {creatingNew ? (
        <div className="flex items-center gap-0.5 ml-1">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nome do funil..."
            className="h-7 w-32 text-xs"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setCreatingNew(false); setNewName(""); }
            }}
          />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCreate}>
            <Check className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setCreatingNew(false); setNewName(""); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 shrink-0"
          onClick={() => setCreatingNew(true)}
        >
          <Plus className="h-3 w-3" />
          Novo
        </Button>
      )}

      {/* Inactive funnels */}
      {inactiveFunis.length > 0 && (
        <Popover open={showInactive} onOpenChange={setShowInactive}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground gap-1 shrink-0 ml-auto">
              <EyeOff className="h-3 w-3" />
              {inactiveFunis.length}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-2">
            <p className="text-[11px] font-medium text-muted-foreground px-2 pb-1.5 uppercase tracking-wider">Inativos</p>
            {inactiveFunis.map(funil => (
              <div key={funil.id} className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50">
                <span className="text-sm text-muted-foreground">{funil.nome}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    onToggleAtivo(funil.id, true);
                    if (inactiveFunis.length <= 1) setShowInactive(false);
                  }}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Ativar
                </Button>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
