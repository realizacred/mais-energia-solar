// ─── PaymentMethodSelector — Drag & drop + editar valores por proposta ────
// Substitui FormasPagamentoPreview read-only por seletor interativo

import { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  CreditCard,
  Banknote,
  Building2,
  FileText,
  Smartphone,
  Wallet,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/formatters";
import {
  usePaymentInterestConfigs,
  type PaymentInterestConfig,
} from "@/hooks/usePaymentInterestConfig";
import {
  FORMA_PAGAMENTO_LABELS,
  type FormaPagamento,
} from "@/services/paymentComposition/types";
import { resolveJuros } from "@/services/paymentComposition/resolveJuros";
import type { PagamentoOpcao } from "./types";

// ─── Icons ──────────────────────────────────────────────────
const FORMA_ICONS: Record<string, React.ReactNode> = {
  pix: <Smartphone className="h-4 w-4" />,
  dinheiro: <Banknote className="h-4 w-4" />,
  transferencia: <Wallet className="h-4 w-4" />,
  boleto: <FileText className="h-4 w-4" />,
  cartao_credito: <CreditCard className="h-4 w-4" />,
  cartao_debito: <CreditCard className="h-4 w-4" />,
  cheque: <FileText className="h-4 w-4" />,
  financiamento: <Building2 className="h-4 w-4" />,
  crediario: <Wallet className="h-4 w-4" />,
  outro: <DollarSign className="h-4 w-4" />,
};

// ─── Selected item type ─────────────────────────────────────
export interface FormaSelected {
  id: string;
  config_id: string;
  forma_pagamento: FormaPagamento;
  nome: string;
  num_parcelas: number;
  taxa_mensal: number;
  juros_responsavel: string;
  valor_total: number; // precoFinal or custom
  entrada: number;
  observacoes: string;
}

interface Props {
  precoFinal: number;
  selected: FormaSelected[];
  onSelectedChange: (items: FormaSelected[]) => void;
}

// ─── DraggablePoolItem ──────────────────────────────────────
function DraggablePoolItem({ config }: { config: PaymentInterestConfig }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pool-${config.id}`,
    data: { config },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card cursor-grab active:cursor-grabbing",
        "hover:border-primary/40 hover:shadow-sm transition-all select-none"
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
        {FORMA_ICONS[config.forma_pagamento] ?? <DollarSign className="h-3.5 w-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">
          {FORMA_PAGAMENTO_LABELS[config.forma_pagamento]}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {config.juros_tipo === "sem_juros"
            ? `${config.parcelas_padrao}x sem juros`
            : `${config.parcelas_padrao}x · ${config.juros_valor}% a.m.`}
        </p>
      </div>
      <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
    </div>
  );
}

// ─── PoolItemOverlay (for drag overlay) ─────────────────────
function PoolItemOverlay({ config }: { config: PaymentInterestConfig }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg border-2 border-primary bg-card shadow-lg">
      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
        {FORMA_ICONS[config.forma_pagamento] ?? <DollarSign className="h-3.5 w-3.5" />}
      </div>
      <p className="text-xs font-medium text-foreground">
        {FORMA_PAGAMENTO_LABELS[config.forma_pagamento]}
      </p>
    </div>
  );
}

// ─── DropZone ───────────────────────────────────────────────
function DropZone({ children, isEmpty }: { children: React.ReactNode; isEmpty: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: "selected-zone" });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[120px] rounded-lg border-2 border-dashed transition-colors p-2 space-y-2",
        isOver ? "border-primary bg-primary/5" : "border-border",
        isEmpty && !isOver && "flex items-center justify-center"
      )}
    >
      {isEmpty && !isOver ? (
        <div className="text-center py-4">
          <DollarSign className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground">
            Arraste as formas de pagamento aqui
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            ou clique no botão + ao lado
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ─── SelectedItem (card with inline edit) ───────────────────
function SelectedItemCard({
  item,
  precoFinal,
  onUpdate,
  onRemove,
}: {
  item: FormaSelected;
  precoFinal: number;
  onUpdate: (updated: FormaSelected) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(item);

  const handleSave = () => {
    onUpdate(editData);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditData(item);
    setEditing(false);
  };

  // Calculate valor_parcela
  const principal = (editData.valor_total || precoFinal) - (editData.entrada || 0);
  const valorParcela = editData.num_parcelas > 0 && principal > 0
    ? principal / editData.num_parcelas
    : principal;

  if (editing) {
    return (
      <div className="p-3 rounded-lg border border-primary/40 bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary">
              {FORMA_ICONS[item.forma_pagamento] ?? <DollarSign className="h-3.5 w-3.5" />}
            </div>
            <span className="text-sm font-semibold text-foreground">
              {FORMA_PAGAMENTO_LABELS[item.forma_pagamento]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave}>
              <Check className="h-3.5 w-3.5 text-success" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancel}>
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Parcelas</Label>
            <Input
              type="number"
              min={1}
              max={120}
              value={editData.num_parcelas}
              onChange={(e) => setEditData(prev => ({ ...prev, num_parcelas: Number(e.target.value) || 1 }))}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Taxa (% a.m.)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={editData.taxa_mensal}
              onChange={(e) => setEditData(prev => ({ ...prev, taxa_mensal: Number(e.target.value) || 0 }))}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Entrada (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={editData.entrada}
              onChange={(e) => setEditData(prev => ({ ...prev, entrada: Number(e.target.value) || 0 }))}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Valor parcela</Label>
            <div className="h-8 flex items-center text-xs font-mono text-foreground bg-muted/50 rounded-lg px-3 border border-input">
              {formatBRL(valorParcela)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors group">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
          {FORMA_ICONS[item.forma_pagamento] ?? <DollarSign className="h-3.5 w-3.5" />}
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">
            {FORMA_PAGAMENTO_LABELS[item.forma_pagamento]}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {item.num_parcelas}x de {formatBRL(valorParcela)}
            {item.taxa_mensal > 0 ? ` · ${item.taxa_mensal}% a.m.` : " · sem juros"}
            {item.entrada > 0 ? ` · Entrada ${formatBRL(item.entrada)}` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5 text-primary" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export function PaymentMethodSelector({ precoFinal, selected, onSelectedChange }: Props) {
  const { data: formasConfig } = usePaymentInterestConfigs();
  const [activeDrag, setActiveDrag] = useState<PaymentInterestConfig | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Pool: active configs not yet selected
  const selectedConfigIds = useMemo(() => new Set(selected.map(s => s.config_id)), [selected]);
  const pool = useMemo(
    () => (formasConfig ?? []).filter(f => f.ativo && !selectedConfigIds.has(f.id)),
    [formasConfig, selectedConfigIds]
  );

  const addFromConfig = useCallback((config: PaymentInterestConfig) => {
    const newItem: FormaSelected = {
      id: crypto.randomUUID(),
      config_id: config.id,
      forma_pagamento: config.forma_pagamento,
      nome: FORMA_PAGAMENTO_LABELS[config.forma_pagamento],
      num_parcelas: config.parcelas_padrao,
      taxa_mensal: config.juros_tipo === "percentual" ? config.juros_valor : 0,
      juros_responsavel: config.juros_responsavel,
      valor_total: precoFinal,
      entrada: 0,
      observacoes: config.observacoes || "",
    };
    onSelectedChange([...selected, newItem]);
  }, [selected, onSelectedChange, precoFinal]);

  const handleDragStart = (event: DragStartEvent) => {
    const config = event.active.data?.current?.config as PaymentInterestConfig | undefined;
    if (config) setActiveDrag(config);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || over.id !== "selected-zone") return;
    const config = active.data?.current?.config as PaymentInterestConfig | undefined;
    if (config) addFromConfig(config);
  };

  const handleUpdate = (idx: number, updated: FormaSelected) => {
    const next = [...selected];
    next[idx] = updated;
    onSelectedChange(next);
  };

  const handleRemove = (idx: number) => {
    onSelectedChange(selected.filter((_, i) => i !== idx));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
        {/* Pool — available methods */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Disponíveis
          </p>
          {pool.length === 0 && selected.length > 0 && (
            <p className="text-[10px] text-muted-foreground/60 py-2">Todas adicionadas</p>
          )}
          {pool.length === 0 && selected.length === 0 && (
            <p className="text-[10px] text-muted-foreground/60 py-2">
              Nenhuma forma configurada
            </p>
          )}
          {pool.map((config) => (
            <div key={config.id} className="relative">
              <DraggablePoolItem config={config} />
              <button
                onClick={() => addFromConfig(config)}
                className="absolute -right-1 -top-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity shadow-sm"
                title="Adicionar"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Drop zone — selected methods */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Na proposta
          </p>
          <DropZone isEmpty={selected.length === 0}>
            {selected.map((item, idx) => (
              <SelectedItemCard
                key={item.id}
                item={item}
                precoFinal={precoFinal}
                onUpdate={(updated) => handleUpdate(idx, updated)}
                onRemove={() => handleRemove(idx)}
              />
            ))}
          </DropZone>
        </div>
      </div>

      <DragOverlay>
        {activeDrag ? <PoolItemOverlay config={activeDrag} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
