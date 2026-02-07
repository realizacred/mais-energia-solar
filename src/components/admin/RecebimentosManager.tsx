import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign,
  Plus,
  Search,
  Loader2,
  Edit,
  Trash2,
  Receipt,
  CreditCard,
  Eye,
  Calendar,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PagamentosDialog } from "./PagamentosDialog";
import { ParcelasManager } from "./recebimentos/ParcelasManager";
import { RelatoriosFinanceiros } from "./recebimentos/RelatoriosFinanceiros";
import { CalendarioPagamentos } from "./recebimentos/CalendarioPagamentos";
import { ParcelasAtrasadasWidget } from "./widgets/ParcelasAtrasadasWidget";

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
}

interface Pagamento {
  id: string;
  valor_pago: number;
  forma_pagamento: string;
  data_pagamento: string;
  observacoes: string | null;
}

interface Recebimento {
  id: string;
  cliente_id: string;
  valor_total: number;
  forma_pagamento_acordada: string;
  numero_parcelas: number;
  descricao: string | null;
  data_acordo: string;
  status: string;
  created_at: string;
  clientes?: Cliente;
  pagamentos?: Pagamento[];
}

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
  { value: "financiamento", label: "Financiamento" },
];

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-500",
  parcial: "bg-blue-500",
  quitado: "bg-green-500",
  cancelado: "bg-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  parcial: "Parcial",
  quitado: "Quitado",
  cancelado: "Cancelado",
};

export function RecebimentosManager() {
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecebimento, setEditingRecebimento] = useState<Recebimento | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [selectedRecebimento, setSelectedRecebimento] = useState<Recebimento | null>(null);
  const [pagamentosDialogOpen, setPagamentosDialogOpen] = useState(false);
  const [parcelasDialogOpen, setParcelasDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("lista");

  const [formData, setFormData] = useState({
    cliente_id: "",
    valor_total: "",
    forma_pagamento_acordada: "",
    numero_parcelas: "1",
    descricao: "",
    data_acordo: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchRecebimentos();
    fetchClientes();
  }, []);

  const fetchRecebimentos = async () => {
    try {
      const { data, error } = await supabase
        .from("recebimentos")
        .select(`
          *,
          clientes (id, nome, telefone),
          pagamentos (id, valor_pago, forma_pagamento, data_pagamento, observacoes)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecebimentos(data || []);
    } catch (error) {
      console.error("Error fetching recebimentos:", error);
      toast({
        title: "Erro ao carregar recebimentos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error("Error fetching clientes:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const recebimentoData = {
        cliente_id: formData.cliente_id,
        valor_total: parseFloat(formData.valor_total),
        forma_pagamento_acordada: formData.forma_pagamento_acordada,
        numero_parcelas: parseInt(formData.numero_parcelas),
        descricao: formData.descricao || null,
        data_acordo: formData.data_acordo,
      };

      if (editingRecebimento) {
        const { error } = await supabase
          .from("recebimentos")
          .update(recebimentoData)
          .eq("id", editingRecebimento.id);

        if (error) throw error;
        toast({ title: "Recebimento atualizado!" });
      } else {
        const { error } = await supabase.from("recebimentos").insert(recebimentoData);

        if (error) throw error;
        toast({ title: "Recebimento cadastrado!" });
      }

      setDialogOpen(false);
      resetForm();
      fetchRecebimentos();
    } catch (error) {
      console.error("Error saving recebimento:", error);
      toast({
        title: "Erro ao salvar recebimento",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (recebimento: Recebimento) => {
    setEditingRecebimento(recebimento);
    setFormData({
      cliente_id: recebimento.cliente_id,
      valor_total: recebimento.valor_total.toString(),
      forma_pagamento_acordada: recebimento.forma_pagamento_acordada,
      numero_parcelas: recebimento.numero_parcelas.toString(),
      descricao: recebimento.descricao || "",
      data_acordo: recebimento.data_acordo,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este recebimento e todos os pagamentos?")) return;

    try {
      const { error } = await supabase.from("recebimentos").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Recebimento excluído!" });
      fetchRecebimentos();
    } catch (error) {
      console.error("Error deleting recebimento:", error);
      toast({
        title: "Erro ao excluir recebimento",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      cliente_id: "",
      valor_total: "",
      forma_pagamento_acordada: "",
      numero_parcelas: "1",
      descricao: "",
      data_acordo: new Date().toISOString().split("T")[0],
    });
    setEditingRecebimento(null);
  };

  const calcularTotalPago = (pagamentos?: Pagamento[]) => {
    if (!pagamentos) return 0;
    return pagamentos.reduce((acc, p) => acc + p.valor_pago, 0);
  };

  const calcularProgresso = (recebimento: Recebimento) => {
    const totalPago = calcularTotalPago(recebimento.pagamentos);
    return Math.min((totalPago / recebimento.valor_total) * 100, 100);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filteredRecebimentos = recebimentos.filter((r) => {
    const matchesSearch =
      r.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const totalPendente = recebimentos
    .filter((r) => r.status !== "quitado" && r.status !== "cancelado")
    .reduce((acc, r) => acc + r.valor_total - calcularTotalPago(r.pagamentos), 0);

  const totalRecebido = recebimentos.reduce((acc, r) => acc + calcularTotalPago(r.pagamentos), 0);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="lista" className="gap-2">
            <Receipt className="h-4 w-4" />
            Recebimentos
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendário
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-6 mt-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ParcelasAtrasadasWidget />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalRecebido)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{formatCurrency(totalPendente)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-1 gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="quitado">Quitado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Recebimento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingRecebimento ? "Editar Recebimento" : "Novo Recebimento"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select
                  value={formData.cliente_id}
                  onValueChange={(value) => setFormData({ ...formData, cliente_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor_total">Valor Total *</Label>
                  <Input
                    id="valor_total"
                    type="number"
                    step="0.01"
                    value={formData.valor_total}
                    onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero_parcelas">Parcelas</Label>
                  <Input
                    id="numero_parcelas"
                    type="number"
                    min="1"
                    value={formData.numero_parcelas}
                    onChange={(e) => setFormData({ ...formData, numero_parcelas: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Forma de Pagamento Acordada *</Label>
                  <Select
                    value={formData.forma_pagamento_acordada}
                    onValueChange={(value) => setFormData({ ...formData, forma_pagamento_acordada: value })}
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
                <div className="space-y-2">
                  <Label htmlFor="data_acordo">Data do Acordo *</Label>
                  <Input
                    id="data_acordo"
                    type="date"
                    value={formData.data_acordo}
                    onChange={(e) => setFormData({ ...formData, data_acordo: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingRecebimento ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredRecebimentos.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum recebimento encontrado</p>
            {clientes.length === 0 && (
              <p className="text-sm mt-2">Cadastre um cliente primeiro</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Forma Acordada</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecebimentos.map((recebimento) => {
                const totalPago = calcularTotalPago(recebimento.pagamentos);
                const progresso = calcularProgresso(recebimento);

                return (
                  <TableRow key={recebimento.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{recebimento.clientes?.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(recebimento.data_acordo), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{formatCurrency(recebimento.valor_total)}</p>
                        <p className="text-xs text-muted-foreground">
                          Pago: {formatCurrency(totalPago)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-32">
                      <div className="space-y-1">
                        <Progress value={progresso} className="h-2" />
                        <p className="text-xs text-muted-foreground">{progresso.toFixed(0)}%</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {FORMAS_PAGAMENTO.find((f) => f.value === recebimento.forma_pagamento_acordada)?.label ||
                          recebimento.forma_pagamento_acordada}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${STATUS_COLORS[recebimento.status]} text-white`}>
                        {STATUS_LABELS[recebimento.status] || recebimento.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedRecebimento(recebimento);
                            setPagamentosDialogOpen(true);
                          }}
                          title="Ver/Registrar Pagamentos"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedRecebimento(recebimento);
                            setParcelasDialogOpen(true);
                          }}
                          title="Gerenciar Parcelas"
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(recebimento)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(recebimento.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="relatorios" className="mt-6">
          <RelatoriosFinanceiros />
        </TabsContent>

        <TabsContent value="calendario" className="mt-6">
          <CalendarioPagamentos />
        </TabsContent>
      </Tabs>

      {/* Pagamentos Dialog */}
      {selectedRecebimento && (
        <PagamentosDialog
          open={pagamentosDialogOpen}
          onOpenChange={(open) => {
            setPagamentosDialogOpen(open);
            if (!open) setSelectedRecebimento(null);
          }}
          recebimento={selectedRecebimento}
          onUpdate={fetchRecebimentos}
        />
      )}

      {/* Parcelas Dialog */}
      {selectedRecebimento && (
        <ParcelasManager
          open={parcelasDialogOpen}
          onOpenChange={(open) => {
            setParcelasDialogOpen(open);
            if (!open) setSelectedRecebimento(null);
          }}
          recebimento={selectedRecebimento}
          onUpdate={fetchRecebimentos}
        />
      )}
    </div>
  );
}
