import { useState } from "react";
import { CreditCard, Pencil, Plus, Trash2, Banknote, Building2, FileText, Smartphone, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  usePaymentInterestConfigs,
  useUpsertPaymentInterestConfig,
  useDeletePaymentInterestConfig,
  type PaymentInterestConfig,
} from "@/hooks/usePaymentInterestConfig";
import {
  FORMA_PAGAMENTO_LABELS,
  JUROS_RESPONSAVEL_LABELS,
  type FormaPagamento,
  type JurosTipo,
  type JurosResponsavel,
} from "@/services/paymentComposition/types";

const FORMA_ICONS: Record<FormaPagamento, React.ReactNode> = {
  pix: <Smartphone className="w-4 h-4" />,
  dinheiro: <Banknote className="w-4 h-4" />,
  transferencia: <Building2 className="w-4 h-4" />,
  boleto: <FileText className="w-4 h-4" />,
  cartao_credito: <CreditCard className="w-4 h-4" />,
  cartao_debito: <CreditCard className="w-4 h-4" />,
  cheque: <FileText className="w-4 h-4" />,
  financiamento: <Building2 className="w-4 h-4" />,
  crediario: <Wallet className="w-4 h-4" />,
  outro: <Wallet className="w-4 h-4" />,
};

function getJurosLabel(tipo: JurosTipo, valor: number): string {
  if (tipo === "sem_juros") return "Sem juros";
  if (tipo === "percentual") return `${valor}% a.m.`;
  if (tipo === "valor_fixo") return `R$ ${valor.toFixed(2)} fixo`;
  return "—";
}

interface FormData {
  forma_pagamento: FormaPagamento;
  juros_tipo: JurosTipo;
  juros_valor: number;
  juros_responsavel: JurosResponsavel;
  parcelas_padrao: number;
  intervalo_dias_padrao: number;
  ativo: boolean;
  observacoes: string;
}

const EMPTY_FORM: FormData = {
  forma_pagamento: "pix",
  juros_tipo: "sem_juros",
  juros_valor: 0,
  juros_responsavel: "nao_aplica",
  parcelas_padrao: 1,
  intervalo_dias_padrao: 30,
  ativo: true,
  observacoes: "",
};

export function FormasPagamentoPage() {
  const { data: configs, isLoading } = usePaymentInterestConfigs();
  const upsert = useUpsertPaymentInterestConfig();
  const deleteMut = useDeletePaymentInterestConfig();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const handleNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const handleEdit = (config: PaymentInterestConfig) => {
    setEditingId(config.id);
    setForm({
      forma_pagamento: config.forma_pagamento,
      juros_tipo: config.juros_tipo,
      juros_valor: config.juros_valor,
      juros_responsavel: config.juros_responsavel,
      parcelas_padrao: config.parcelas_padrao,
      intervalo_dias_padrao: config.intervalo_dias_padrao,
      ativo: config.ativo,
      observacoes: config.observacoes || "",
    });
    setModalOpen(true);
  };

  const handleToggle = (config: PaymentInterestConfig, ativo: boolean) => {
    upsert.mutate({
      forma_pagamento: config.forma_pagamento,
      juros_tipo: config.juros_tipo,
      juros_valor: config.juros_valor,
      juros_responsavel: config.juros_responsavel,
      parcelas_padrao: config.parcelas_padrao,
      intervalo_dias_padrao: config.intervalo_dias_padrao,
      ativo,
      observacoes: config.observacoes,
    });
  };

  const handleSave = async () => {
    upsert.mutate(form, {
      onSuccess: () => {
        setModalOpen(false);
      },
    });
  };

  const handleDelete = (id: string) => {
    deleteMut.mutate(id);
  };

  const update = (partial: Partial<FormData>) => setForm(prev => ({ ...prev, ...partial }));

  // Determine which formas are already configured
  const configuredFormas = new Set(configs?.map(c => c.forma_pagamento) || []);

  // Available formas for new config (exclude already configured)
  const availableFormas = (Object.keys(FORMA_PAGAMENTO_LABELS) as FormaPagamento[]).filter(
    f => !configuredFormas.has(f) || editingId !== null
  );

  return (
    <div className="space-y-6 p-4 md:p-6 w-full">
      {/* Header — §26 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Formas de Pagamento</h1>
            <p className="text-sm text-muted-foreground">Configure juros, parcelas e condições para cada forma</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={handleNew}>
          <Plus className="h-3.5 w-3.5" /> Nova Forma
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !configs || configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CreditCard className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma forma de pagamento configurada</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Clique em "Nova Forma" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map(config => (
            <Card key={config.id} className={cn("border bg-card transition-opacity", !config.ativo && "opacity-50")}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    {FORMA_ICONS[config.forma_pagamento] || <Wallet className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {FORMA_PAGAMENTO_LABELS[config.forma_pagamento]}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{getJurosLabel(config.juros_tipo, config.juros_valor)}</span>
                      <span>•</span>
                      <span>{config.parcelas_padrao}x parcelas</span>
                      <span>•</span>
                      <span>{JUROS_RESPONSAVEL_LABELS[config.juros_responsavel]}</span>
                    </div>
                    {config.observacoes && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{config.observacoes}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    config.ativo
                      ? "bg-success/10 text-success border-success/30"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {config.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                  <Switch
                    checked={config.ativo}
                    onCheckedChange={(v) => handleToggle(config, v)}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(config)}>
                    <Pencil className="w-4 h-4 text-primary" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDelete(config.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal — §25 */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[90vw] max-w-xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {editingId ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure juros, parcelas e responsabilidade
              </p>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-5">
              {/* Forma */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Forma de Pagamento</Label>
                <Select
                  value={form.forma_pagamento}
                  onValueChange={(v) => update({ forma_pagamento: v as FormaPagamento })}
                  disabled={!!editingId}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(editingId
                      ? (Object.keys(FORMA_PAGAMENTO_LABELS) as FormaPagamento[])
                      : availableFormas
                    ).map(f => (
                      <SelectItem key={f} value={f}>{FORMA_PAGAMENTO_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Juros */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Tipo de Juros</Label>
                  <Select
                    value={form.juros_tipo}
                    onValueChange={(v) => update({
                      juros_tipo: v as JurosTipo,
                      ...(v === "sem_juros" ? { juros_valor: 0, juros_responsavel: "nao_aplica" as JurosResponsavel } : {}),
                    })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem_juros">Sem juros</SelectItem>
                      <SelectItem value="percentual">Percentual (% a.m.)</SelectItem>
                      <SelectItem value="valor_fixo">Valor fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.juros_tipo !== "sem_juros" && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">
                      {form.juros_tipo === "percentual" ? "Taxa (% a.m.)" : "Valor fixo (R$)"}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.juros_valor || ""}
                      onChange={(e) => update({ juros_valor: Number(e.target.value) })}
                      className="h-9"
                    />
                  </div>
                )}
              </div>

              {/* Responsável */}
              {form.juros_tipo !== "sem_juros" && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Quem paga os juros?</Label>
                  <Select
                    value={form.juros_responsavel}
                    onValueChange={(v) => update({ juros_responsavel: v as JurosResponsavel })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cliente">Cliente paga</SelectItem>
                      <SelectItem value="empresa">Empresa absorve</SelectItem>
                      <SelectItem value="nao_aplica">Não se aplica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Parcelas e Intervalo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Parcelas padrão</Label>
                  <Input
                    type="number"
                    min="1"
                    max="120"
                    value={form.parcelas_padrao}
                    onChange={(e) => update({ parcelas_padrao: Number(e.target.value) || 1 })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Intervalo entre parcelas (dias)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={form.intervalo_dias_padrao}
                    onChange={(e) => update({ intervalo_dias_padrao: Number(e.target.value) || 30 })}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => update({ observacoes: e.target.value })}
                  placeholder="Ex: Desconto de 5% para PIX à vista"
                  className="min-h-[60px] text-sm"
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={upsert.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
