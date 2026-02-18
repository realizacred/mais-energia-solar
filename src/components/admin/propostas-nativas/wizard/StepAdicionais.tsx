import { useState } from "react";
import { Plus, Trash2, Battery, Cable, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "./types";

const CATEGORIAS_ADICIONAIS = [
  { value: "estrutura", label: "Estrutura" },
  { value: "string_box", label: "String Box" },
  { value: "cabos", label: "Cabos" },
  { value: "conectores", label: "Conectores" },
  { value: "bateria", label: "Bateria" },
  { value: "monitoramento", label: "Monitoramento" },
  { value: "protecao", label: "Proteção" },
  { value: "outros", label: "Outros" },
];

interface AdicionalItem {
  id: string;
  descricao: string;
  categoria: string;
  quantidade: number;
  preco_unitario: number;
}

interface StepAdicionaisProps {
  adicionais: AdicionalItem[];
  onAdicionaisChange: (adicionais: AdicionalItem[]) => void;
}

export type { AdicionalItem };

export function StepAdicionais({ adicionais, onAdicionaisChange }: StepAdicionaisProps) {
  const addItem = () => {
    onAdicionaisChange([...adicionais, {
      id: crypto.randomUUID(),
      descricao: "",
      categoria: "estrutura",
      quantidade: 1,
      preco_unitario: 0,
    }]);
  };

  const removeItem = (id: string) => onAdicionaisChange(adicionais.filter(a => a.id !== id));

  const updateItem = (id: string, field: keyof AdicionalItem, value: any) => {
    onAdicionaisChange(adicionais.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const total = adicionais.reduce((s, a) => s + a.quantidade * a.preco_unitario, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Box className="h-4 w-4 text-primary" /> Adicionais
        </h3>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <Badge variant="secondary" className="text-xs">
              Total: {formatBRL(total)}
            </Badge>
          )}
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={addItem}>
            <Plus className="h-3 w-3" /> Adicionar Item
          </Button>
        </div>
      </div>

      {adicionais.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border rounded-xl">
          Nenhum item adicional. Adicione estruturas, cabos, baterias e outros componentes complementares.
        </div>
      ) : (
        <div className="space-y-2">
          {adicionais.map((item) => (
            <div key={item.id} className="p-3 rounded-lg border border-border/40 bg-card space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={item.descricao}
                  onChange={e => updateItem(item.id, "descricao", e.target.value)}
                  placeholder="Descrição do item"
                  className="h-8 text-sm flex-1"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 shrink-0" onClick={() => removeItem(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Categoria</Label>
                  <Select value={item.categoria} onValueChange={v => updateItem(item.id, "categoria", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIAS_ADICIONAIS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Quantidade</Label>
                  <Input type="number" min={1} value={item.quantidade || ""} onChange={e => updateItem(item.id, "quantidade", Number(e.target.value))} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Preço Unit. (R$)</Label>
                  <Input type="number" min={0} step={0.01} value={item.preco_unitario || ""} onChange={e => updateItem(item.id, "preco_unitario", Number(e.target.value))} className="h-8 text-xs" />
                </div>
              </div>
              <div className="text-right text-[10px] text-muted-foreground">
                Subtotal: {formatBRL(item.quantidade * item.preco_unitario)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
