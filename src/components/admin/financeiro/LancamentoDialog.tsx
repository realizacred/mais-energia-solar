import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { ArrowDownCircle, ArrowUpCircle, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LancamentoFinanceiro,
  CreateLancamentoInput,
  LancamentoFiltros,
  useCreateLancamento,
  useUpdateLancamento,
  CATEGORIAS_RECEITA,
  CATEGORIAS_DESPESA,
  FORMAS_PAGAMENTO,
} from "@/hooks/useLancamentosFinanceiros";

interface LancamentoDialogProps {
  open: boolean;
  onClose: () => void;
  lancamento?: LancamentoFinanceiro | null;
  filtrosAtuais: LancamentoFiltros;
}

export function LancamentoDialog({ open, onClose, lancamento, filtrosAtuais }: LancamentoDialogProps) {
  const createMutation = useCreateLancamento(filtrosAtuais);
  const updateMutation = useUpdateLancamento(filtrosAtuais);
  const isEditing = !!lancamento;

  const [tipo, setTipo] = useState<"receita" | "despesa">("receita");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().slice(0, 10));
  const [formaPagamento, setFormaPagamento] = useState("");
  const [status, setStatus] = useState("confirmado");
  const [observacoes, setObservacoes] = useState("");
  const [comprovante, setComprovante] = useState<File | null>(null);

  useEffect(() => {
    if (lancamento) {
      setTipo(lancamento.tipo);
      setCategoria(lancamento.categoria);
      setDescricao(lancamento.descricao);
      setValor(Number(lancamento.valor));
      setDataLancamento(lancamento.data_lancamento);
      setFormaPagamento(lancamento.forma_pagamento || "");
      setStatus(lancamento.status);
      setObservacoes(lancamento.observacoes || "");
    } else {
      setTipo("receita");
      setCategoria("");
      setDescricao("");
      setValor(0);
      setDataLancamento(new Date().toISOString().slice(0, 10));
      setFormaPagamento("");
      setStatus("confirmado");
      setObservacoes("");
      setComprovante(null);
    }
  }, [lancamento, open]);

  const categorias = tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;

  const handleSubmit = async () => {
    if (!categoria || !descricao || valor <= 0) return;

    const input: CreateLancamentoInput = {
      tipo,
      categoria,
      descricao,
      valor,
      data_lancamento: dataLancamento,
      forma_pagamento: formaPagamento || undefined,
      status,
      observacoes: observacoes || undefined,
      comprovante,
    };

    if (isEditing) {
      await updateMutation.mutateAsync({ id: lancamento!.id, ...input });
    } else {
      await createMutation.mutateAsync(input);
    }
    onClose();
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              {tipo === "receita" ? (
                <ArrowUpCircle className="w-5 h-5 text-success" />
              ) : (
                <ArrowDownCircle className="w-5 h-5 text-destructive" />
              )}
            </div>
            <DialogTitle>{isEditing ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={tipo === "receita" ? "default" : "outline"}
              className={cn("flex-1", tipo === "receita" && "bg-success hover:bg-success/90")}
              onClick={() => { setTipo("receita"); setCategoria(""); }}
            >
              <ArrowUpCircle className="w-4 h-4 mr-2" /> Receita
            </Button>
            <Button
              type="button"
              variant={tipo === "despesa" ? "default" : "outline"}
              className={cn("flex-1", tipo === "despesa" && "bg-destructive hover:bg-destructive/90")}
              onClick={() => { setTipo("despesa"); setCategoria(""); }}
            >
              <ArrowDownCircle className="w-4 h-4 mr-2" /> Despesa
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Categoria */}
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valor */}
            <div className="space-y-2">
              <Label>Valor *</Label>
              <CurrencyInput value={valor} onChange={setValor} />
            </div>

            {/* Descrição */}
            <div className="col-span-1 sm:col-span-2 space-y-2">
              <Label>Descrição *</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o lançamento" />
            </div>

            {/* Data */}
            <div className="space-y-2">
              <Label>Data</Label>
              <DateInput value={dataLancamento} onChange={setDataLancamento} />
            </div>

            {/* Forma pgto */}
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Comprovante */}
            <div className="space-y-2">
              <Label>Comprovante</Label>
              <div className="relative">
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setComprovante(e.target.files?.[0] || null)}
                  className="text-xs"
                />
              </div>
              {comprovante && (
                <p className="text-xs text-muted-foreground truncate">{comprovante.name}</p>
              )}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações adicionais (opcional)"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !categoria || !descricao || valor <= 0}
          >
            {isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar Lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
