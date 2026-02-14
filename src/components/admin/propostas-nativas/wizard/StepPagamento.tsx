import { Plus, Trash2, CreditCard, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type PagamentoOpcao, type BancoFinanciamento, formatBRL } from "./types";

const TIPOS_PAGAMENTO = [
  { value: "a_vista", label: "À Vista" },
  { value: "financiamento", label: "Financiamento" },
  { value: "parcelado", label: "Parcelado (s/ juros)" },
  { value: "outro", label: "Outro" },
];

interface StepPagamentoProps {
  opcoes: PagamentoOpcao[];
  onOpcoesChange: (opcoes: PagamentoOpcao[]) => void;
  bancos: BancoFinanciamento[];
  loadingBancos: boolean;
  precoFinal: number;
}

export function StepPagamento({ opcoes, onOpcoesChange, bancos, loadingBancos, precoFinal }: StepPagamentoProps) {
  const addOpcao = (tipo: PagamentoOpcao["tipo"] = "a_vista") => {
    const base: PagamentoOpcao = {
      id: crypto.randomUUID(),
      nome: tipo === "a_vista" ? "À Vista" : tipo === "financiamento" ? "Financiamento" : tipo === "parcelado" ? "Parcelado" : "Personalizado",
      tipo,
      valor_financiado: precoFinal,
      entrada: 0,
      taxa_mensal: tipo === "financiamento" && bancos[0] ? bancos[0].taxa_mensal : 0,
      carencia_meses: 0,
      num_parcelas: tipo === "a_vista" ? 1 : 36,
      valor_parcela: 0,
    };
    // Calculate parcela
    base.valor_parcela = calcParcela(base);
    onOpcoesChange([...opcoes, base]);
  };

  const removeOpcao = (id: string) => onOpcoesChange(opcoes.filter(o => o.id !== id));

  const updateOpcao = (id: string, field: keyof PagamentoOpcao, value: any) => {
    const updated = opcoes.map(o => {
      if (o.id !== id) return o;
      const newOp = { ...o, [field]: value };
      // Auto-recalc valor_parcela
      newOp.valor_parcela = calcParcela(newOp);
      return newOp;
    });
    onOpcoesChange(updated);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" /> Opções de Pagamento
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => addOpcao("a_vista")}>+ À Vista</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => addOpcao("financiamento")}>+ Financiamento</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => addOpcao("parcelado")}>+ Parcelado</Button>
        </div>
      </div>

      {opcoes.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Nenhuma opção de pagamento. Adicione pelo menos uma opção para o cliente.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opcoes.map((op, idx) => (
            <div key={op.id} className="p-4 rounded-xl border border-border/50 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">Opção {idx + 1}</Badge>
                  <Input value={op.nome} onChange={e => updateOpcao(op.id, "nome", e.target.value)} className="h-7 text-xs w-32" />
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => removeOpcao(op.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Tipo</Label>
                  <Select value={op.tipo} onValueChange={v => updateOpcao(op.id, "tipo", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS_PAGAMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Valor financiado</Label>
                  <Input type="number" min={0} value={op.valor_financiado || ""} onChange={e => updateOpcao(op.id, "valor_financiado", Number(e.target.value))} className="h-8 text-xs" />
                </div>
              </div>

              {op.tipo !== "a_vista" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Entrada (R$)</Label>
                    <Input type="number" min={0} value={op.entrada || ""} onChange={e => updateOpcao(op.id, "entrada", Number(e.target.value))} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Parcelas</Label>
                    <Input type="number" min={1} max={240} value={op.num_parcelas || ""} onChange={e => updateOpcao(op.id, "num_parcelas", Number(e.target.value))} className="h-8 text-xs" />
                  </div>
                </div>
              )}

              {op.tipo === "financiamento" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Taxa mensal (%)</Label>
                    <Input type="number" min={0} step={0.01} value={op.taxa_mensal || ""} onChange={e => updateOpcao(op.id, "taxa_mensal", Number(e.target.value))} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Carência (meses)</Label>
                    <Input type="number" min={0} value={op.carencia_meses || ""} onChange={e => updateOpcao(op.id, "carencia_meses", Number(e.target.value))} className="h-8 text-xs" />
                  </div>
                </div>
              )}

              {/* Quick bank selection */}
              {op.tipo === "financiamento" && bancos.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground">Banco rápido</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {bancos.map(bank => (
                      <button
                        key={bank.id}
                        onClick={() => {
                          updateOpcao(op.id, "taxa_mensal", bank.taxa_mensal);
                          updateOpcao(op.id, "nome", `Financiamento ${bank.nome}`);
                        }}
                        className={cn(
                          "text-[10px] px-2 py-1 rounded-md border transition-colors",
                          op.taxa_mensal === bank.taxa_mensal
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/40 hover:border-border/70 text-muted-foreground"
                        )}
                      >
                        {bank.nome} ({bank.taxa_mensal}%)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Result */}
              <div className="pt-2 border-t border-border/30">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {op.tipo === "a_vista" ? "Valor total" : `${op.num_parcelas}x de`}
                  </span>
                  <span className="font-bold text-primary">{formatBRL(op.valor_parcela)}</span>
                </div>
                {op.entrada > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                    <span>+ entrada</span>
                    <span>{formatBRL(op.entrada)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function calcParcela(op: PagamentoOpcao): number {
  const principal = (op.valor_financiado || 0) - (op.entrada || 0);
  if (principal <= 0 || op.num_parcelas <= 0) return 0;
  if (op.tipo === "a_vista") return op.valor_financiado || 0;
  if (op.tipo === "parcelado" || op.taxa_mensal <= 0) return principal / op.num_parcelas;
  // Price table
  const r = op.taxa_mensal / 100;
  const n = op.num_parcelas;
  const fator = Math.pow(1 + r, n);
  return principal * (r * fator) / (fator - 1);
}
