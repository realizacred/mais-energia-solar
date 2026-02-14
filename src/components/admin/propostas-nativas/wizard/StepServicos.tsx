import { Plus, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { type ServicoItem, formatBRL } from "./types";

const CATEGORIAS_SERVICO = [
  { value: "instalacao", label: "Instalação" },
  { value: "projeto", label: "Projeto Elétrico" },
  { value: "homologacao", label: "Homologação" },
  { value: "frete", label: "Frete" },
  { value: "seguro", label: "Seguro" },
  { value: "comissao", label: "Comissão" },
  { value: "manutencao", label: "Manutenção" },
  { value: "outros", label: "Outros" },
];

interface StepServicosProps {
  servicos: ServicoItem[];
  onServicosChange: (servicos: ServicoItem[]) => void;
}

export function StepServicos({ servicos, onServicosChange }: StepServicosProps) {
  const addServico = () => {
    onServicosChange([...servicos, {
      id: crypto.randomUUID(),
      descricao: "",
      categoria: "instalacao",
      valor: 0,
      incluso_no_preco: true,
    }]);
  };

  const removeServico = (id: string) => onServicosChange(servicos.filter(s => s.id !== id));

  const updateServico = (id: string, field: keyof ServicoItem, value: any) => {
    onServicosChange(servicos.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const totalInclusos = servicos.filter(s => s.incluso_no_preco).reduce((s, i) => s + i.valor, 0);
  const totalExtras = servicos.filter(s => !s.incluso_no_preco).reduce((s, i) => s + i.valor, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" /> Serviços
        </h3>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={addServico}>
          <Plus className="h-3 w-3" /> Adicionar Serviço
        </Button>
      </div>

      {servicos.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Nenhum serviço adicionado. Clique em "Adicionar Serviço" para incluir itens como instalação, frete, etc.
        </div>
      ) : (
        <div className="space-y-2">
          {servicos.map((servico) => (
            <div key={servico.id} className="p-3 rounded-lg border border-border/40 bg-card space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={servico.descricao}
                  onChange={e => updateServico(servico.id, "descricao", e.target.value)}
                  placeholder="Descrição do serviço"
                  className="h-8 text-sm flex-1"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 shrink-0" onClick={() => removeServico(servico.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Categoria</Label>
                  <Select value={servico.categoria} onValueChange={v => updateServico(servico.id, "categoria", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIAS_SERVICO.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Valor (R$)</Label>
                  <Input
                    type="number" min={0} step={0.01}
                    value={servico.valor || ""}
                    onChange={e => updateServico(servico.id, "valor", Number(e.target.value))}
                    placeholder="0,00"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2 pb-0.5">
                  <Switch
                    checked={servico.incluso_no_preco}
                    onCheckedChange={v => updateServico(servico.id, "incluso_no_preco", v)}
                  />
                  <Label className="text-[10px] text-muted-foreground cursor-pointer">
                    {servico.incluso_no_preco ? "Incluso" : "Extra"}
                  </Label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Totais */}
      {servicos.length > 0 && (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <div className="bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo Serviços</div>
          <div className="divide-y divide-border/30">
            <div className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Inclusos no preço</span>
              <span className="font-medium">{formatBRL(totalInclusos)}</span>
            </div>
            {totalExtras > 0 && (
              <div className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Serviços extras (cobrados à parte)</span>
                <span className="font-medium text-warning">{formatBRL(totalExtras)}</span>
              </div>
            )}
            <div className="flex justify-between px-4 py-2.5 text-sm font-bold bg-muted/10">
              <span>Total</span>
              <span>{formatBRL(totalInclusos + totalExtras)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
