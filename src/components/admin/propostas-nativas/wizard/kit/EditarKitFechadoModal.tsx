import { useState } from "react";
import { Minus, Plus, Trash2, Sun, Cpu, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatBRL } from "../types";
import type { KitCardData } from "./KitCard";

interface SelectedKit {
  kit: KitCardData;
  quantidade: number;
}

interface EditarKitFechadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kits: KitCardData[];
  onSave: (selected: SelectedKit[]) => void;
}

export type { SelectedKit };

export function EditarKitFechadoModal({ open, onOpenChange, kits, onSave }: EditarKitFechadoModalProps) {
  const [selected, setSelected] = useState<SelectedKit[]>(() =>
    kits.map(k => ({ kit: k, quantidade: 1 }))
  );

  const updateQtd = (id: string, delta: number) => {
    setSelected(prev =>
      prev.map(s => s.kit.id === id ? { ...s, quantidade: Math.max(1, s.quantidade + delta) } : s)
    );
  };

  const removeKit = (id: string) => {
    setSelected(prev => prev.filter(s => s.kit.id !== id));
  };

  const handleSave = () => {
    onSave(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Editar kit fechado</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Badge kits selecionados */}
          {selected.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
                <Zap className="h-3 w-3 mr-1" />
                Kits selecionados
              </Badge>
            </div>
          )}

          {selected.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhum kit selecionado.
            </div>
          ) : (
            <div className="space-y-3">
              {selected.map(({ kit, quantidade }) => (
                <div key={kit.id} className="rounded-xl border-2 border-border/40 bg-card p-4 space-y-3">
                  {/* Kit title */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold">
                      {kit.moduloQtd}x {kit.moduloDescricao} + {kit.inversorQtd}x {kit.inversorDescricao}
                    </p>

                    {/* Specs row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Sun className="h-3 w-3" />
                        {kit.moduloQtd}x {kit.moduloDescricao}
                      </span>
                      <span>Total {kit.moduloPotenciaKwp.toFixed(2)} kWp</span>
                      <span className="flex items-center gap-1">
                        <Cpu className="h-3 w-3" />
                        {kit.inversorQtd}x {kit.inversorDescricao}
                      </span>
                      <span>Total {kit.inversorPotenciaKw.toFixed(2)} kW</span>
                      <span>Topologia: {kit.topologia}</span>
                    </div>
                  </div>

                  {/* Price + Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">{formatBRL(kit.precoTotal * quantidade)}</span>
                      <Badge variant="outline" className="text-[10px] h-5 bg-primary/5 border-primary/20 text-primary">
                        {formatBRL(kit.precoWp)} / Wp
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Quantity controls */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground mr-1">Quantidade</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQtd(kit.id, -1)}
                          disabled={quantidade <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-bold w-6 text-center">{quantidade}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQtd(kit.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Remove */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                        onClick={() => removeKit(kit.id)}
                      >
                        <Trash2 className="h-3 w-3" /> Remover
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button onClick={handleSave} disabled={selected.length === 0}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
