import { useState } from "react";
import { Plus, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProjetoFunil } from "@/hooks/useProjetoPipeline";

interface Props {
  funis: ProjetoFunil[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (nome: string) => void;
  onRename: (id: string, nome: string) => void;
}

export function ProjetoFunilSelector({ funis, selectedId, onSelect, onCreate, onRename }: Props) {
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {funis.filter(f => f.ativo).map(funil => (
        <div key={funil.id} className="flex items-center">
          {editingId === funil.id ? (
            <div className="flex items-center gap-1">
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
          ) : (
            <Button
              variant={selectedId === funil.id ? "default" : "outline"}
              size="sm"
              className={cn("gap-1.5 group", selectedId === funil.id && "shadow-sm")}
              onClick={() => onSelect(funil.id)}
            >
              {funil.nome}
              <Pencil
                className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity cursor-pointer"
                onClick={e => {
                  e.stopPropagation();
                  setEditingId(funil.id);
                  setEditName(funil.nome);
                }}
              />
            </Button>
          )}
        </div>
      ))}

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
