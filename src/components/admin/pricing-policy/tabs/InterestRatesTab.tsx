import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { Percent, Plus, Save, Trash2 } from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import {
  type FormaPagamento,
  type JurosTipo,
  type JurosResponsavel,
  FORMA_PAGAMENTO_LABELS,
  FORMAS_COM_JUROS,
} from "@/services/paymentComposition/types";
import {
  usePaymentInterestConfigs,
  useUpsertPaymentInterestConfig,
  useDeletePaymentInterestConfig,
  type PaymentInterestConfig,
} from "@/hooks/usePaymentInterestConfig";

interface EditingRow {
  forma_pagamento: FormaPagamento;
  juros_tipo: JurosTipo;
  juros_valor: number;
  juros_responsavel: JurosResponsavel;
  parcelas_padrao: number;
  intervalo_dias_padrao: number;
  ativo: boolean;
  observacoes: string;
}

const EMPTY_ROW: EditingRow = {
  forma_pagamento: "cartao_credito",
  juros_tipo: "sem_juros",
  juros_valor: 0,
  juros_responsavel: "cliente",
  parcelas_padrao: 1,
  intervalo_dias_padrao: 30,
  ativo: true,
  observacoes: "",
};

export function InterestRatesTab() {
  const { data: configs, isLoading } = usePaymentInterestConfigs();
  const upsert = useUpsertPaymentInterestConfig();
  const remove = useDeletePaymentInterestConfig();
  const [editing, setEditing] = useState<EditingRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const configuredFormas = new Set(configs?.map((c) => c.forma_pagamento) ?? []);
  const availableFormas = FORMAS_COM_JUROS.filter((f) => !configuredFormas.has(f) || f === editing?.forma_pagamento);

  const handleEdit = (config: PaymentInterestConfig) => {
    setEditingId(config.id);
    setEditing({
      forma_pagamento: config.forma_pagamento as FormaPagamento,
      juros_tipo: config.juros_tipo as JurosTipo,
      juros_valor: config.juros_valor,
      juros_responsavel: config.juros_responsavel as JurosResponsavel,
      parcelas_padrao: config.parcelas_padrao,
      intervalo_dias_padrao: config.intervalo_dias_padrao,
      ativo: config.ativo,
      observacoes: config.observacoes ?? "",
    });
  };

  const handleAdd = () => {
    const firstAvailable = FORMAS_COM_JUROS.find((f) => !configuredFormas.has(f));
    if (!firstAvailable) return;
    setEditingId(null);
    setEditing({ ...EMPTY_ROW, forma_pagamento: firstAvailable });
  };

  const handleSave = () => {
    if (!editing) return;
    upsert.mutate(editing, { onSuccess: () => { setEditing(null); setEditingId(null); } });
  };

  const handleCancel = () => { setEditing(null); setEditingId(null); };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Taxas de Juros por Forma de Pagamento</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure as taxas padrão que serão preenchidas automaticamente no compositor de pagamento.
          </p>
        </div>
        <Button size="sm" onClick={handleAdd} disabled={availableFormas.length === 0 || !!editing}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      {/* Editing Form */}
      {editing && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Forma de Pagamento</Label>
                <Select
                  value={editing.forma_pagamento}
                  onValueChange={(v) => setEditing({ ...editing, forma_pagamento: v as FormaPagamento })}
                  disabled={!!editingId}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(editingId ? FORMAS_COM_JUROS : availableFormas).map((f) => (
                      <SelectItem key={f} value={f}>{FORMA_PAGAMENTO_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Juros</Label>
                <Select
                  value={editing.juros_tipo}
                  onValueChange={(v) => setEditing({
                    ...editing,
                    juros_tipo: v as JurosTipo,
                    juros_valor: v === "sem_juros" ? 0 : editing.juros_valor,
                    juros_responsavel: v === "sem_juros" ? "nao_aplica" : editing.juros_responsavel,
                  })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem_juros">Sem juros</SelectItem>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="valor_fixo">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editing.juros_tipo !== "sem_juros" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{editing.juros_tipo === "percentual" ? "Taxa (%)" : "Valor (R$)"}</Label>
                  {editing.juros_tipo === "percentual" ? (
                    <Input
                      type="number" min={0} step={0.1}
                      value={editing.juros_valor || ""}
                      onChange={(e) => setEditing({ ...editing, juros_valor: parseFloat(e.target.value) || 0 })}
                      className="h-9"
                    />
                  ) : (
                    <CurrencyInput
                      value={editing.juros_valor}
                      onChange={(v) => setEditing({ ...editing, juros_valor: v })}
                      className="h-9"
                    />
                  )}
                </div>
              )}

              {editing.juros_tipo !== "sem_juros" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Responsável</Label>
                  <Select
                    value={editing.juros_responsavel}
                    onValueChange={(v) => setEditing({ ...editing, juros_responsavel: v as JurosResponsavel })}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cliente">Cliente paga</SelectItem>
                      <SelectItem value="empresa">Empresa absorve</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Parcelas padrão</Label>
                <Input
                  type="number" min={1} max={120}
                  value={editing.parcelas_padrao}
                  onChange={(e) => setEditing({ ...editing, parcelas_padrao: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Intervalo (dias)</Label>
                <Input
                  type="number" min={1} max={365}
                  value={editing.intervalo_dias_padrao}
                  onChange={(e) => setEditing({ ...editing, intervalo_dias_padrao: Math.max(1, parseInt(e.target.value) || 30) })}
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={editing.ativo} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
                <Label className="text-xs">Ativo</Label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
                  <Save className="w-3.5 h-3.5 mr-1" /> Salvar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {configs && configs.length > 0 ? (
        <div className="space-y-2">
          {configs.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => !editing && handleEdit(c)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Percent className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {FORMA_PAGAMENTO_LABELS[c.forma_pagamento as FormaPagamento] ?? c.forma_pagamento}
                    </span>
                    {!c.ativo && (
                      <Badge variant="outline" className="text-[10px] h-4 bg-muted text-muted-foreground">Inativo</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.juros_tipo === "sem_juros"
                      ? "Sem juros"
                      : c.juros_tipo === "percentual"
                        ? `${c.juros_valor}% — ${c.juros_responsavel === "cliente" ? "Cliente paga" : "Empresa absorve"}`
                        : `${formatBRL(c.juros_valor)} fixo — ${c.juros_responsavel === "cliente" ? "Cliente paga" : "Empresa absorve"}`
                    }
                    {" · "}{c.parcelas_padrao}x · {c.intervalo_dias_padrao} dias
                  </p>
                </div>
              </div>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive/80 shrink-0"
                onClick={(e) => { e.stopPropagation(); remove.mutate(c.id); }}
                aria-label="Remover"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : !editing ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Percent className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma taxa configurada</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Adicione taxas para preencher automaticamente no compositor de pagamento</p>
        </div>
      ) : null}
    </div>
  );
}
