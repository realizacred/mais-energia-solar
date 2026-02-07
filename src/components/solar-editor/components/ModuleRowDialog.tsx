import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DEFAULT_MODULE_WIDTH, DEFAULT_MODULE_HEIGHT } from "../types";

interface ModuleRowDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (count: number, orientation: 'horizontal' | 'vertical', spacing: number) => void;
}

export function ModuleRowDialog({ isOpen, onClose, onGenerate }: ModuleRowDialogProps) {
  const [count, setCount] = useState(5);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [spacing, setSpacing] = useState(10);

  const handleGenerate = () => {
    onGenerate(count, orientation, spacing);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Fileira de Módulos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="count">Quantidade de Módulos</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="space-y-2">
            <Label>Orientação</Label>
            <RadioGroup
              value={orientation}
              onValueChange={(v) => setOrientation(v as 'horizontal' | 'vertical')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="horizontal" id="horizontal" />
                <Label htmlFor="horizontal" className="cursor-pointer">
                  Horizontal
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="vertical" id="vertical" />
                <Label htmlFor="vertical" className="cursor-pointer">
                  Vertical
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="spacing">Espaçamento (px)</Label>
            <Input
              id="spacing"
              type="number"
              min={0}
              max={100}
              value={spacing}
              onChange={(e) => setSpacing(parseInt(e.target.value) || 0)}
            />
          </div>

          {/* Preview */}
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Preview:</p>
            <div className="flex items-center justify-center gap-1">
              {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
                <div
                  key={i}
                  className="bg-primary/80 border border-primary rounded"
                  style={{
                    width: orientation === 'horizontal' ? 20 : 15,
                    height: orientation === 'horizontal' ? 30 : 25,
                    marginRight: orientation === 'horizontal' ? spacing / 5 : 0,
                    marginBottom: orientation === 'vertical' ? spacing / 5 : 0,
                  }}
                />
              ))}
              {count > 8 && (
                <span className="text-xs text-muted-foreground ml-1">
                  +{count - 8}
                </span>
              )}
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Largura total:{" "}
              {orientation === 'horizontal'
                ? count * DEFAULT_MODULE_WIDTH + (count - 1) * spacing
                : DEFAULT_MODULE_WIDTH}
              px
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate}>
            Gerar {count} Módulos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}