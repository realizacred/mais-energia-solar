import { useState, useCallback, useMemo } from "react";
import { Plus, Trash2, CreditCard, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Receipt } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { formatBRL } from "@/lib/formatters";
import {
  type PaymentItemInput,
  type FormaPagamento,
  type JurosTipo,
  type JurosResponsavel,
  FORMA_PAGAMENTO_LABELS,
  JUROS_RESPONSAVEL_LABELS,
  FORMAS_PARCELAVEIS,
  FORMAS_COM_JUROS,
  createEmptyItem,
} from "@/services/paymentComposition/types";
import {
  computeItem,
  computeSummary,
  validateComposition,
} from "@/services/paymentComposition/calculator";
import { usePaymentInterestConfigMap, type PaymentInterestConfig } from "@/hooks/usePaymentInterestConfig";

interface PaymentComposerProps {
  valorVenda: number;
  items: PaymentItemInput[];
  onChange: (items: PaymentItemInput[]) => void;
  readOnly?: boolean;
}

export function PaymentComposer({ valorVenda, items, onChange, readOnly = false }: PaymentComposerProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { configMap } = usePaymentInterestConfigMap();

  const summary = useMemo(() => computeSummary(items, valorVenda), [items, valorVenda]);
  const errors = useMemo(() => validateComposition(items, valorVenda), [items, valorVenda]);

  const addItem = useCallback(() => {
    const newItem = createEmptyItem();
    // Set remaining value as default
    const remaining = valorVenda - items.reduce((s, i) => s + i.valor_base, 0);
    newItem.valor_base = Math.max(0, Math.round(remaining * 100) / 100);
    onChange([...items, newItem]);
    setExpandedItems((prev) => new Set([...prev, newItem.id]));
  }, [items, onChange, valorVenda]);

  const removeItem = useCallback((id: string) => {
    onChange(items.filter((i) => i.id !== id));
    setExpandedItems((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }, [items, onChange]);

  const updateItem = useCallback((id: string, patch: Partial<PaymentItemInput>) => {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, [items, onChange]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* ── Items List ── */}
      <AnimatePresence mode="popLayout">
        {items.map((item, idx) => (
          <PaymentItemCard
            key={item.id}
            item={item}
            index={idx}
            expanded={expandedItems.has(item.id)}
            onToggle={() => toggleExpand(item.id)}
            onUpdate={(patch) => updateItem(item.id, patch)}
            onRemove={() => removeItem(item.id)}
            readOnly={readOnly}
            configMap={configMap}
          />
        ))}
      </AnimatePresence>

      {/* ── Add Button ── */}
      {!readOnly && (() => {
        const lastItem = items[items.length - 1];
        const lastItemConfigured = !lastItem || (lastItem.valor_base > 0);
        return (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dashed"
            onClick={addItem}
            disabled={!lastItemConfigured}
          >
            <Plus className="w-4 h-4 mr-2" /> Adicionar forma de pagamento
          </Button>
        );
      })()}

      {/* ── Summary Panel ── */}
      <CompositionSummaryPanel summary={summary} errors={errors} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Payment Item Card
// ═══════════════════════════════════════════════════════

interface PaymentItemCardProps {
  item: PaymentItemInput;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<PaymentItemInput>) => void;
  onRemove: () => void;
  readOnly: boolean;
  configMap: Map<FormaPagamento, PaymentInterestConfig>;
}

function PaymentItemCard({ item, index, expanded, onToggle, onUpdate, onRemove, readOnly, configMap }: PaymentItemCardProps) {
  const computed = useMemo(() => computeItem(item), [item]);
  const isParcelavel = FORMAS_PARCELAVEIS.includes(item.forma_pagamento);
  const hasJuros = FORMAS_COM_JUROS.includes(item.forma_pagamento);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="border-border bg-card shadow-sm">
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={onToggle}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">{index + 1}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {FORMA_PAGAMENTO_LABELS[item.forma_pagamento]}
                </span>
                {item.entrada && (
                  <Badge variant="outline" className="text-[10px] h-4 bg-success/10 text-success border-success/20">
                    Entrada
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Base: {formatBRL(item.valor_base)}
                {computed.valor_juros > 0 && (
                  <> · Juros: {formatBRL(computed.valor_juros)} ({JUROS_RESPONSAVEL_LABELS[item.juros_responsavel]})</>
                )}
                {item.parcelas > 1 && <> · {item.parcelas}x de {formatBRL(computed.parcelas_detalhes[0]?.valor ?? 0)}</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-primary">{formatBRL(computed.valor_com_juros)}</span>
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive/80"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                aria-label="Remover item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {/* ── Expanded Form ── */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CardContent className="pt-0 pb-4 px-4 space-y-4">
                <Separator />

                {/* Row 1: Forma + Valor + Entrada */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Forma de Pagamento</Label>
                    <Select
                      value={item.forma_pagamento}
                      onValueChange={(v) => {
                        const forma = v as FormaPagamento;
                        const patch: Partial<PaymentItemInput> = { forma_pagamento: forma };
                        if (!FORMAS_PARCELAVEIS.includes(forma)) {
                          patch.parcelas = 1;
                        }
                        // Auto-fill from interest config
                        const cfg = configMap.get(forma);
                        if (cfg && cfg.ativo) {
                          patch.juros_tipo = cfg.juros_tipo;
                          patch.juros_valor = cfg.juros_valor;
                          patch.juros_responsavel = cfg.juros_responsavel;
                          if (FORMAS_PARCELAVEIS.includes(forma)) {
                            patch.parcelas = cfg.parcelas_padrao;
                            patch.intervalo_dias = cfg.intervalo_dias_padrao;
                          }
                        } else if (!FORMAS_COM_JUROS.includes(forma)) {
                          patch.juros_tipo = "sem_juros";
                          patch.juros_valor = 0;
                          patch.juros_responsavel = "nao_aplica";
                        }
                        onUpdate(patch);
                      }}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FORMA_PAGAMENTO_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor Base (R$)</Label>
                    <CurrencyInput
                      value={item.valor_base}
                      onChange={(v) => onUpdate({ valor_base: v })}
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Row 1b: Entrada toggle */}
                <div className="flex items-center gap-2 overflow-visible">
                  <Switch
                    checked={item.entrada}
                    onCheckedChange={(v) => onUpdate({ entrada: v })}
                    disabled={readOnly}
                  />
                  <Label className="text-xs">Marcar como entrada</Label>
                </div>

                {/* Row 2: Data */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data do Pagamento</Label>
                    <DateInput
                      value={item.data_pagamento}
                      onChange={(v) => onUpdate({ data_pagamento: v })}
                      className="h-9"
                    />
                  </div>
                  {isParcelavel && item.parcelas > 1 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">1º Vencimento</Label>
                      <DateInput
                        value={item.data_primeiro_vencimento}
                        onChange={(v) => onUpdate({ data_primeiro_vencimento: v })}
                        className="h-9"
                      />
                    </div>
                  )}
                </div>

                {/* Row 3: Parcelas (if applicable) */}
                {isParcelavel && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nº de Parcelas</Label>
                      <Input
                        type="number"
                        min={1}
                        max={120}
                        value={item.parcelas}
                        onChange={(e) => onUpdate({ parcelas: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="h-9"
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Intervalo (dias)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={item.intervalo_dias}
                        onChange={(e) => onUpdate({ intervalo_dias: Math.max(1, parseInt(e.target.value) || 30) })}
                        className="h-9"
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                )}

                {/* Row 4: Interest (if applicable) */}
                {hasJuros && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tipo de Juros</Label>
                      <Select
                        value={item.juros_tipo}
                        onValueChange={(v) => {
                          const patch: Partial<PaymentItemInput> = { juros_tipo: v as JurosTipo };
                          if (v === "sem_juros") {
                            patch.juros_valor = 0;
                            patch.juros_responsavel = "nao_aplica";
                          } else if (item.juros_responsavel === "nao_aplica") {
                            // Auto-default: when interest is enabled, client pays by default
                            patch.juros_responsavel = "cliente";
                          }
                          onUpdate(patch);
                        }}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sem_juros">Sem juros</SelectItem>
                          <SelectItem value="percentual">Percentual (%)</SelectItem>
                          <SelectItem value="valor_fixo">Valor fixo (R$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {item.juros_tipo !== "sem_juros" && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">
                            {item.juros_tipo === "percentual" ? "Taxa (%)" : "Valor (R$)"}
                          </Label>
                          {item.juros_tipo === "percentual" ? (
                            <Input
                              type="number"
                              min={0}
                              step={0.1}
                              value={item.juros_valor || ""}
                              onChange={(e) => onUpdate({ juros_valor: parseFloat(e.target.value) || 0 })}
                              className="h-9"
                              disabled={readOnly}
                            />
                          ) : (
                            <CurrencyInput
                              value={item.juros_valor}
                              onChange={(v) => onUpdate({ juros_valor: v })}
                              className="h-9"
                            />
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">Quem paga os juros?</Label>
                          <Select
                            value={item.juros_responsavel}
                            onValueChange={(v) => onUpdate({ juros_responsavel: v as JurosResponsavel })}
                            disabled={readOnly}
                          >
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cliente">Cliente paga</SelectItem>
                              <SelectItem value="empresa">Empresa absorve</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Installment Preview */}
                {computed.parcelas_detalhes.length > 1 && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Preview das Parcelas
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                      {computed.parcelas_detalhes.map((p) => (
                        <div
                          key={p.numero_parcela}
                          className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-card border border-border"
                        >
                          <span className="text-muted-foreground">
                            {p.tipo_parcela === "entrada" ? "Entrada" : `${p.numero_parcela}ª`}
                          </span>
                          <span className="font-mono font-medium text-foreground">{formatBRL(p.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Observações */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Observações</Label>
                  <Textarea
                    value={item.observacoes}
                    onChange={(e) => onUpdate({ observacoes: e.target.value })}
                    placeholder="Notas sobre este item..."
                    rows={2}
                    className="text-sm"
                    disabled={readOnly}
                  />
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// Composition Summary Panel
// ═══════════════════════════════════════════════════════

function CompositionSummaryPanel({
  summary,
  errors,
}: {
  summary: ReturnType<typeof computeSummary>;
  errors: string[];
}) {
  return (
    <Card className="border-border bg-card shadow-sm overflow-hidden">
      <div className="bg-muted/30 px-4 py-2 flex items-center gap-2">
        <Receipt className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Resumo Financeiro
        </span>
        {summary.is_valid ? (
          <Badge variant="outline" className="ml-auto text-[10px] h-4 bg-success/10 text-success border-success/20">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Válido
          </Badge>
        ) : (
          <Badge variant="outline" className="ml-auto text-[10px] h-4 bg-warning/10 text-warning border-warning/20">
            <AlertTriangle className="w-3 h-3 mr-1" /> Pendente
          </Badge>
        )}
      </div>

      <div className="divide-y divide-border/30">
        <SummaryRow label="Valor da Venda" value={formatBRL(summary.valor_venda)} />
        <SummaryRow label="Total Alocado" value={formatBRL(summary.total_alocado)} />
        <SummaryRow
          label="Valor Restante"
          value={formatBRL(summary.valor_restante)}
          highlight={summary.valor_restante !== 0}
          variant={summary.valor_restante > 0 ? "warning" : summary.valor_restante < 0 ? "destructive" : undefined}
        />
        {summary.total_juros_cliente > 0 && (
          <SummaryRow label="Juros (Cliente paga)" value={formatBRL(summary.total_juros_cliente)} />
        )}
        {summary.total_juros_empresa > 0 && (
          <SummaryRow label="Juros (Empresa absorve)" value={`-${formatBRL(summary.total_juros_empresa)}`} variant="destructive" />
        )}
        <SummaryRow label="Total pago pelo Cliente" value={formatBRL(summary.total_pago_cliente)} bold />
        <SummaryRow label="Valor Líquido Empresa" value={formatBRL(summary.valor_liquido_empresa)} bold primary />
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="px-4 py-3 bg-destructive/5 border-t border-destructive/20 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-destructive flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              {e}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  primary,
  highlight,
  variant,
}: {
  label: string;
  value: string;
  bold?: boolean;
  primary?: boolean;
  highlight?: boolean;
  variant?: "warning" | "destructive";
}) {
  const valueClass = primary
    ? "text-primary font-bold"
    : variant === "destructive"
    ? "text-destructive font-medium"
    : variant === "warning"
    ? "text-warning font-medium"
    : bold
    ? "font-bold text-foreground"
    : "font-medium text-foreground";

  return (
    <div className={`flex justify-between px-4 py-2.5 text-sm ${highlight ? "bg-warning/5" : ""}`}>
      <span className={`text-muted-foreground ${bold ? "font-semibold" : ""}`}>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
