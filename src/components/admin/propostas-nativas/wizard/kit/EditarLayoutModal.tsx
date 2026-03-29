import { useState, useEffect } from "react";
import { Plus, Trash2, LayoutGrid, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { LayoutArranjo } from "../types";

interface EditarLayoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layouts: LayoutArranjo[];
  totalModulos: number;
  /** Number of MPPT inputs on the inverter — used for smart default */
  mpptCount?: number;
  onSave: (layouts: LayoutArranjo[]) => void;
}

/**
 * Generates a smart default layout distributing modules across MPPT strings.
 * e.g. 11 modules, 2 MPPTs → [6, 5]
 */
function generateSmartDefault(totalModulos: number, mpptCount: number): LayoutArranjo[] {
  const strings = Math.max(1, mpptCount);
  const base = Math.floor(totalModulos / strings);
  const remainder = totalModulos % strings;

  return Array.from({ length: strings }, (_, i) => {
    const modulosNeste = base + (i < remainder ? 1 : 0);
    return {
      id: crypto.randomUUID(),
      arranjo_index: i + 1,
      num_linhas: 1,
      modulos_por_linha: Math.max(1, modulosNeste),
      disposicao: "horizontal" as const,
    };
  });
}

export function EditarLayoutModal({ open, onOpenChange, layouts: initial, totalModulos, mpptCount = 1, onSave }: EditarLayoutModalProps) {
  const [arranjos, setArranjos] = useState<LayoutArranjo[]>([]);

  // Sync internal state when modal opens
  useEffect(() => {
    if (!open) return;
    if (initial.length > 0) {
      setArranjos(initial);
    } else {
      // Auto-generate smart default based on MPPT count
      setArranjos(generateSmartDefault(totalModulos, mpptCount));
    }
  }, [open, initial, totalModulos, mpptCount]);

  const totalUsados = arranjos.reduce((s, a) => s + a.num_linhas * a.modulos_por_linha, 0);
  const diff = totalUsados - totalModulos;

  const updateArranjo = (id: string, field: keyof LayoutArranjo, value: any) => {
    setArranjos(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const increment = (id: string, field: "num_linhas" | "modulos_por_linha") => {
    setArranjos(prev => prev.map(a => {
      if (a.id !== id) return a;
      return { ...a, [field]: a[field] + 1 };
    }));
  };

  const decrement = (id: string, field: "num_linhas" | "modulos_por_linha") => {
    setArranjos(prev => prev.map(a => {
      if (a.id !== id) return a;
      return { ...a, [field]: Math.max(1, a[field] - 1) };
    }));
  };

  const addArranjo = () => {
    setArranjos(prev => [...prev, {
      id: crypto.randomUUID(),
      arranjo_index: prev.length + 1,
      num_linhas: 1,
      modulos_por_linha: 1,
      disposicao: "horizontal",
    }]);
  };

  const removeArranjo = (id: string) => {
    setArranjos(prev => prev.filter(a => a.id !== id).map((a, i) => ({ ...a, arranjo_index: i + 1 })));
  };

  const exceedsLimit = totalModulos > 0 && diff > 0;

  const handleSave = () => {
    if (exceedsLimit) return;
    onSave(arranjos);
    onOpenChange(false);
  };

  const handleAutoDistribute = () => {
    setArranjos(generateSmartDefault(totalModulos, mpptCount));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" /> Editar Layout dos Módulos
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
          {/* Info banner */}
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
            <span>
              <strong className="text-foreground">{totalModulos}</strong> módulos no kit
              {mpptCount > 1 && <> · <strong className="text-foreground">{mpptCount}</strong> strings (MPPT)</>}
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={handleAutoDistribute}>
              <Sparkles className="h-3 w-3" /> Auto distribuir
            </Button>
          </div>

          {arranjos.map((arranjo) => (
            <div key={arranjo.id} className="rounded-xl border-2 border-border/40 bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold">Arranjo {arranjo.arranjo_index}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {arranjo.num_linhas * arranjo.modulos_por_linha} módulos
                  </span>
                  {arranjos.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive/60 hover:text-destructive"
                      onClick={() => removeArranjo(arranjo.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-2 gap-4">
                {/* Nº de Linhas */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground">Nº de Linhas</Label>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => decrement(arranjo.id, "num_linhas")} disabled={arranjo.num_linhas <= 1}>
                      <span className="text-sm font-bold">−</span>
                    </Button>
                    <span className="text-sm font-bold w-10 text-center">{arranjo.num_linhas}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => increment(arranjo.id, "num_linhas")}>
                      <span className="text-sm font-bold">+</span>
                    </Button>
                  </div>
                </div>

                {/* Módulos por linha */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground">Módulos por linha</Label>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => decrement(arranjo.id, "modulos_por_linha")} disabled={arranjo.modulos_por_linha <= 1}>
                      <span className="text-sm font-bold">−</span>
                    </Button>
                    <span className="text-sm font-bold w-10 text-center">{arranjo.modulos_por_linha}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => increment(arranjo.id, "modulos_por_linha")}>
                      <span className="text-sm font-bold">+</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Disposição */}
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground">Disposição</Label>
                <RadioGroup
                  value={arranjo.disposicao}
                  onValueChange={(v) => updateArranjo(arranjo.id, "disposicao", v)}
                  className="flex gap-4"
                >
                  <label className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all flex-1",
                    arranjo.disposicao === "horizontal"
                      ? "border-primary bg-primary/5"
                      : "border-border/40 hover:border-border"
                  )}>
                    <RadioGroupItem value="horizontal" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">Horizontal</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: Math.min(arranjo.modulos_por_linha, 6) }).map((_, i) => (
                          <div key={i} className="w-4 h-6 rounded-[2px] border border-info/60 bg-gradient-to-br from-secondary/70 via-secondary/60 to-secondary/50 relative overflow-hidden">
                            <div className="absolute inset-[1px] grid grid-cols-2 gap-[0.5px]">
                              <div className="bg-info/15 rounded-[0.5px]" />
                              <div className="bg-info/15 rounded-[0.5px]" />
                              <div className="bg-info/15 rounded-[0.5px]" />
                              <div className="bg-info/15 rounded-[0.5px]" />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/5" />
                          </div>
                        ))}
                        {arranjo.modulos_por_linha > 6 && (
                          <span className="text-[9px] text-muted-foreground self-center ml-0.5">+{arranjo.modulos_por_linha - 6}</span>
                        )}
                      </div>
                    </div>
                  </label>

                  <label className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all flex-1",
                    arranjo.disposicao === "vertical"
                      ? "border-primary bg-primary/5"
                      : "border-border/40 hover:border-border"
                  )}>
                    <RadioGroupItem value="vertical" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">Vertical</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: Math.min(arranjo.modulos_por_linha, 6) }).map((_, i) => (
                          <div key={i} className="w-6 h-4 rounded-[2px] border border-info/60 bg-gradient-to-br from-secondary/70 via-secondary/60 to-secondary/50 relative overflow-hidden">
                            <div className="absolute inset-[1px] grid grid-cols-3 gap-[0.5px]">
                              <div className="bg-info/15 rounded-[0.5px]" />
                              <div className="bg-info/15 rounded-[0.5px]" />
                              <div className="bg-info/15 rounded-[0.5px]" />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/5" />
                          </div>
                        ))}
                        {arranjo.modulos_por_linha > 6 && (
                          <span className="text-[9px] text-muted-foreground self-center ml-0.5">+{arranjo.modulos_por_linha - 6}</span>
                        )}
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            </div>
          ))}

          {/* Add Layout */}
          <Button variant="default" size="sm" className="gap-1.5 text-xs w-full" onClick={addArranjo}>
            <Plus className="h-3 w-3" /> Adicionar Layout
          </Button>

          {/* Validation */}
          {totalModulos > 0 && diff !== 0 && (
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg text-xs",
              diff > 0
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-warning/10 text-warning border border-warning/20"
            )}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {diff > 0
                  ? `Você excedeu em ${diff} a quantidade de módulos do sistema.`
                  : `Faltam ${Math.abs(diff)} módulos para completar o sistema.`
                }
                {" "}(Total no kit: {totalModulos} | Total nos arranjos: {totalUsados})
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button variant="default" onClick={handleSave} disabled={exceedsLimit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
