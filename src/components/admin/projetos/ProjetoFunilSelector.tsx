import { useState } from "react";
import { ProjetoPipelineTemplates } from "./ProjetoPipelineTemplates";
import { Plus, Pencil, Check, X, MoreHorizontal, EyeOff, Eye, ArrowUp, ArrowDown, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  onCreate: (nome: string, templateStages?: { name: string; probability: number; is_closed?: boolean; is_won?: boolean }[]) => void;
  onRename: (id: string, nome: string) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  onReorder: (orderedIds: string[]) => void;
  onEditEtapas?: (funilId: string) => void;
}

export function ProjetoFunilSelector({
  funis, selectedId, onSelect, onCreate, onRename, onToggleAtivo, onReorder, onEditEtapas,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const activeFunis = funis.filter(f => f.ativo).sort((a, b) => a.ordem - b.ordem);
  const inactiveFunis = funis.filter(f => !f.ativo).sort((a, b) => a.ordem - b.ordem);

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

              {/* Pencil icon to edit stages - always visible */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditEtapas?.(funil.id);
                    }}
                    className="p-1 rounded hover:bg-muted transition-colors -ml-0.5 mr-0.5"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Editar etapas de "{funil.nome}"
                </TooltipContent>
              </Tooltip>

              {isSelected && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-0.5 rounded hover:bg-muted transition-colors mr-0.5">
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
                    {funil.nome.toLowerCase() !== "comercial" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onToggleAtivo(funil.id, false)}
                          className="text-destructive focus:text-destructive"
                        >
                          <EyeOff className="h-3.5 w-3.5 mr-2" />
                          Desativar
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>

      {/* Create new via template */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 shrink-0"
        onClick={() => setTemplateDialogOpen(true)}
      >
        <Plus className="h-3 w-3" />
        Novo
      </Button>

      <ProjetoPipelineTemplates
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onCreateFromTemplate={(name, stages) => onCreate(name, stages)}
        onCreateBlank={(name) => onCreate(name)}
      />

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
