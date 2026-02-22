import { Plus, Trash2, Wrench, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { type ServicoItem, type KitItemRow, formatBRL } from "./types";

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

interface ResumoItem {
  descricao: string;
  quantidade: number;
  valor: number;
  expandivel?: boolean;
}

interface StepServicosProps {
  servicos: ServicoItem[];
  onServicosChange: (servicos: ServicoItem[]) => void;
  /** Kit items for building the Resumo sidebar */
  kitItens?: KitItemRow[];
  potenciaKwp?: number;
}

export function StepServicos({ servicos, onServicosChange, kitItens = [], potenciaKwp = 0 }: StepServicosProps) {
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

  // ── Build Resumo items ──
  const kitTotal = kitItens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const kitLabel = potenciaKwp > 0
    ? `Kit fotovoltaico ${potenciaKwp.toFixed(2)} kWp`
    : "Kit fotovoltaico";

  const resumoItens: ResumoItem[] = [
    ...(kitItens.length > 0 ? [{ descricao: kitLabel, quantidade: 1, valor: kitTotal, expandivel: true }] : []),
  ];

  // Add service-based resumo items (Instalação, Comissão, etc.)
  const instalacaoServico = servicos.find(s => s.categoria === "instalacao");
  const comissaoServico = servicos.find(s => s.categoria === "comissao");

  if (instalacaoServico || !servicos.some(s => s.categoria === "instalacao")) {
    resumoItens.push({
      descricao: "Instalação",
      quantidade: 1,
      valor: instalacaoServico?.valor || 0,
    });
  }

  if (comissaoServico || !servicos.some(s => s.categoria === "comissao")) {
    resumoItens.push({
      descricao: "Comissão",
      quantidade: 1,
      valor: comissaoServico?.valor || 0,
    });
  }

  // Add other services not already shown
  servicos
    .filter(s => s.categoria !== "instalacao" && s.categoria !== "comissao" && s.descricao)
    .forEach(s => {
      resumoItens.push({ descricao: s.descricao, quantidade: 1, valor: s.valor });
    });

  const totalResumo = resumoItens.reduce((s, i) => s + i.valor, 0);
  const precoWp = potenciaKwp > 0 ? totalResumo / (potenciaKwp * 1000) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      {/* ── Left: Serviços ── */}
      <div className="space-y-5 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" /> Serviços
          </h3>
        </div>

        {servicos.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhum serviço configurado para esta proposta.
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
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
      </div>

      {/* ── Right: Resumo ── */}
      <div className="hidden lg:block">
        <div className="rounded-xl border border-border/50 overflow-hidden sticky top-4">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border/30">
            <h4 className="text-sm font-bold">Resumo</h4>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/20">
            <span>Item</span>
            <span className="text-center w-10">Qtd</span>
            <span className="text-right w-24">Valor</span>
          </div>

          {/* Items */}
          <div className="divide-y divide-border/20">
            {resumoItens.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2.5 text-xs items-center">
                <span className="text-foreground truncate flex items-center gap-1">
                  {item.descricao}
                  {item.expandivel && (
                    <svg className="h-3 w-3 text-muted-foreground shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 5l3 3 3-3" />
                    </svg>
                  )}
                </span>
                <span className="text-center text-muted-foreground w-10">{item.quantidade}</span>
                <span className="text-right font-medium w-24">{formatBRL(item.valor)}</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t border-dashed border-border/40 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Total</span>
              <div className="text-right">
                {precoWp > 0 && (
                  <span className="text-[10px] text-primary font-medium block">
                    {formatBRL(precoWp)} / Wp
                  </span>
                )}
                <span className="text-sm font-bold text-primary">
                  {formatBRL(totalResumo)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
