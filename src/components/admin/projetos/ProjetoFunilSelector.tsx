import { useState } from "react";
import { Plus, Pencil, Check, X, MoreVertical, EyeOff, Eye, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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

  const renderFunilButton = (funil: ProjetoFunil, index: number, total: number) => {
    if (editingId === funil.id) {
      return (
        <div key={funil.id} className="flex items-center gap-1">
          <Input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            className="h-8 w-32 text-sm"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter") handleRename(funil.id);
              if (e.key === "Escape") setEditingId(null);
            }}
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRename(funil.id)}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }

    return (
      <div key={funil.id} className="flex items-center group/funil">
        <Button
          variant={selectedId === funil.id ? "default" : "outline"}
          size="sm"
          className={cn(
            "gap-1.5 pr-1",
            selectedId === funil.id && "shadow-sm",
            !funil.ativo && "opacity-50"
          )}
          onClick={() => funil.ativo && onSelect(funil.id)}
        >
          {funil.nome}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span
                role="button"
                className="ml-1 p-0.5 rounded hover:bg-primary-foreground/20 transition-colors cursor-pointer"
                onClick={e => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={() => {
                setEditingId(funil.id);
                setEditName(funil.nome);
              }}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Renomear
              </DropdownMenuItem>

              {funil.ativo && index > 0 && (
                <DropdownMenuItem onClick={() => moveUp(funil.id)}>
                  <ArrowUp className="h-3.5 w-3.5 mr-2" />
                  Mover para cima
                </DropdownMenuItem>
              )}
              {funil.ativo && index < total - 1 && (
                <DropdownMenuItem onClick={() => moveDown(funil.id)}>
                  <ArrowDown className="h-3.5 w-3.5 mr-2" />
                  Mover para baixo
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => onToggleAtivo(funil.id, !funil.ativo)}
                className={!funil.ativo ? "text-green-600" : "text-destructive"}
              >
                {funil.ativo ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5 mr-2" />
                    Desativar
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5 mr-2" />
                    Reativar
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Button>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {activeFunis.map((funil, i) => renderFunilButton(funil, i, activeFunis.length))}

      {/* Inactive funnels popover */}
      {inactiveFunis.length > 0 && (
        <Popover open={showInactive} onOpenChange={setShowInactive}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <EyeOff className="h-3.5 w-3.5" />
              {inactiveFunis.length} inativos
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Funis inativos</p>
            {inactiveFunis.map((funil, i) => (
              <div key={funil.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50">
                <span className="text-sm text-muted-foreground">{funil.nome}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-green-600"
                  onClick={() => {
                    onToggleAtivo(funil.id, true);
                    if (inactiveFunis.length <= 1) setShowInactive(false);
                  }}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Reativar
                </Button>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      )}

      {/* Create new */}
      {creatingNew ? (
        <div className="flex items-center gap-1">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nome do funil..."
            className="h-8 w-36 text-sm"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreatingNew(false);
            }}
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCreate}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreatingNew(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5 border-dashed" onClick={() => setCreatingNew(true)}>
          <Plus className="h-3.5 w-3.5" />
          Novo Funil
        </Button>
      )}
    </div>
  );
}
