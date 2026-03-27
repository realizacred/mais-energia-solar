import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, DollarSign, Upload, X, ExternalLink } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCurrentTenantId, tenantPath } from "@/lib/storagePaths";

interface PagamentoComissao {
  id: string;
  valor_pago: number;
  data_pagamento: string;
  forma_pagamento: string;
  observacoes: string | null;
  comprovante_url: string | null;
}

interface Comissao {
  id: string;
  consultor_id: string;
  descricao: string;
  valor_base: number;
  percentual_comissao: number;
  valor_comissao: number;
  mes_referencia: number;
  ano_referencia: number;
  status: string;
  consultores?: { nome: string };
  pagamentos_comissao?: { valor_pago: number }[];
}

interface PagamentosComissaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comissao: Comissao;
  onUpdate: () => void;
  initialShowForm?: boolean;
}

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function PagamentosComissaoDialog({
  open,
  onOpenChange,
  comissao,
  onUpdate,
  initialShowForm = false,
}: PagamentosComissaoDialogProps) {
  const [pagamentos, setPagamentos] = useState<PagamentoComissao[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(initialShowForm);
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    valor_pago: "",
    forma_pagamento: "",
    data_pagamento: new Date().toISOString().split("T")[0],
    observacoes: "",
  });

  const fetchPagamentos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pagamentos_comissao")
        .select("id, valor_pago, data_pagamento, forma_pagamento, observacoes, comprovante_url")
        .eq("comissao_id", comissao.id)
        .order("data_pagamento", { ascending: false });

      if (error) throw error;
      setPagamentos(data || []);
    } catch (error) {
      console.error("Error fetching pagamentos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch pagamentos when dialog opens
  useState(() => {
    if (open) {
      fetchPagamentos();
      setShowForm(initialShowForm);
    }
  });

  // Re-fetch when dialog opens
  if (open && pagamentos.length === 0 && !loading) {
    fetchPagamentos();
  }

  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor_pago, 0);
  const saldoRestante = comissao.valor_comissao - totalPago;
  const progresso = Math.min((totalPago / comissao.valor_comissao) * 100, 100);

  const uploadComprovante = async (): Promise<string | null> => {
    if (!comprovanteFile) return null;
    setUploading(true);
    try {
      const tid = await getCurrentTenantId();
      if (!tid) throw new Error("Tenant não encontrado");
      const ext = comprovanteFile.name.split(".").pop()?.toLowerCase() || "pdf";
      const fileName = tenantPath(tid, "comissoes", `${Date.now()}.${ext}`);
      const { error: uploadError } = await supabase.storage
        .from("comprovantes")
        .upload(fileName, comprovanteFile, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data: signedData } = await supabase.storage
        .from("comprovantes")
        .createSignedUrl(fileName, 86400 * 365);
      return signedData?.signedUrl || null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const comprovanteUrl = await uploadComprovante();

      const { error } = await supabase.from("pagamentos_comissao").insert({
        comissao_id: comissao.id,
        valor_pago: parseFloat(formData.valor_pago),
        forma_pagamento: formData.forma_pagamento,
        data_pagamento: formData.data_pagamento,
        observacoes: formData.observacoes || null,
        comprovante_url: comprovanteUrl,
      });

      if (error) throw error;

      // Update comissao status
      const newTotalPago = totalPago + parseFloat(formData.valor_pago);
      const newStatus = newTotalPago >= comissao.valor_comissao ? "pago" : "parcial";
      await supabase
        .from("comissoes")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", comissao.id);

      toast({ title: "Pagamento registrado!" });
      resetForm();
      fetchPagamentos();
      onUpdate();
    } catch (error) {
      console.error("Error saving pagamento:", error);
      toast({ title: "Erro ao registrar pagamento", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este pagamento?")) return;

    try {
      const { error } = await supabase.from("pagamentos_comissao").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Pagamento excluído!" });
      fetchPagamentos();
      onUpdate();
    } catch (error) {
      console.error("Error deleting pagamento:", error);
      toast({ title: "Erro ao excluir pagamento", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      valor_pago: "",
      forma_pagamento: "",
      data_pagamento: new Date().toISOString().split("T")[0],
      observacoes: "",
    });
    setComprovanteFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowForm(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Pagamentos - {comissao.consultores?.nome}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {comissao.descricao} • {MESES[comissao.mes_referencia - 1]}/{comissao.ano_referencia}
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Resumo da Comissão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Comissão</p>
                  <p className="text-lg font-bold">{formatCurrency(comissao.valor_comissao)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Pago</p>
                  <p className="text-lg font-bold text-success">{formatCurrency(totalPago)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Restante</p>
                  <p className="text-lg font-bold text-warning">{formatCurrency(saldoRestante)}</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Progresso</span>
                  <span>{progresso.toFixed(0)}%</span>
                </div>
                <Progress value={progresso} className="h-3" />
              </div>
            </CardContent>
          </Card>

          {/* Payments List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Histórico de Pagamentos</h3>
              {!showForm && saldoRestante > 0 && (
                <Button size="sm" onClick={() => setShowForm(true)} className="gap-1">
                  <Plus className="h-4 w-4" />
                  Novo Pagamento
                </Button>
              )}
            </div>

            {/* Form */}
            {showForm && (
              <Card>
                <CardContent className="pt-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="pag_valor_pago">Valor Pago *</Label>
                        <Input
                          id="pag_valor_pago"
                          type="number"
                          step="0.01"
                          placeholder={`Restante: ${formatCurrency(saldoRestante)}`}
                          value={formData.valor_pago}
                          onChange={(e) => setFormData({ ...formData, valor_pago: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pag_data_pagamento">Data *</Label>
                        <DateInput
                          value={formData.data_pagamento}
                          onChange={(v) => setFormData({ ...formData, data_pagamento: v })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Forma de Pagamento *</Label>
                      <Select
                        value={formData.forma_pagamento}
                        onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {FORMAS_PAGAMENTO.map((fp) => (
                            <SelectItem key={fp.value} value={fp.value}>
                              {fp.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Comprovante upload */}
                    <div className="space-y-2">
                      <Label>Comprovante (opcional)</Label>
                      {comprovanteFile ? (
                        <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
                          <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm text-foreground truncate flex-1">{comprovanteFile.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0"
                            onClick={() => {
                              setComprovanteFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-4 w-4" />
                          Anexar comprovante
                        </Button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setComprovanteFile(file);
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pag_observacoes">Observações</Label>
                      <Textarea
                        id="pag_observacoes"
                        value={formData.observacoes}
                        onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="ghost" onClick={resetForm}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={saving || uploading}>
                        {(saving || uploading) && <Spinner size="sm" className="mr-2" />}
                        Registrar
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Table */}
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : pagamentos.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhum pagamento registrado
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Obs</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagamentos.map((pagamento) => (
                    <TableRow key={pagamento.id}>
                      <TableCell>
                        {format(new Date(pagamento.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(pagamento.valor_pago)}
                      </TableCell>
                      <TableCell>
                        {FORMAS_PAGAMENTO.find((f) => f.value === pagamento.forma_pagamento)?.label ||
                          pagamento.forma_pagamento}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                        {pagamento.observacoes || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {pagamento.comprovante_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => window.open(pagamento.comprovante_url!, "_blank")}
                              title="Ver comprovante"
                            >
                              <ExternalLink className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleDelete(pagamento.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}