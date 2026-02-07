import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Users,
  Plus,
  Search,
  Loader2,
  Edit,
  Trash2,
  Link as LinkIcon,
  DollarSign,
  Sun,
  MessageSquare,
} from "lucide-react";
import { formatPhone, ESTADOS_BRASIL } from "@/lib/validations";
import { WhatsAppSendDialog } from "./WhatsAppSendDialog";

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cpf_cnpj: string | null;
  data_nascimento: string | null;
  cep: string | null;
  estado: string | null;
  cidade: string | null;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  potencia_kwp: number | null;
  valor_projeto: number | null;
  data_instalacao: string | null;
  numero_placas: number | null;
  modelo_inversor: string | null;
  observacoes: string | null;
  lead_id: string | null;
  ativo: boolean;
  created_at: string;
}

interface Lead {
  id: string;
  nome: string;
  telefone: string;
  lead_code: string | null;
}

interface ClientesManagerProps {
  onSelectCliente?: (cliente: Cliente) => void;
}

export function ClientesManager({ onSelectCliente }: ClientesManagerProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [selectedClienteForWhatsApp, setSelectedClienteForWhatsApp] = useState<Cliente | null>(null);

  const handleOpenWhatsApp = (cliente: Cliente) => {
    setSelectedClienteForWhatsApp(cliente);
    setWhatsappOpen(true);
  };

  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    cpf_cnpj: "",
    data_nascimento: "",
    cep: "",
    estado: "",
    cidade: "",
    bairro: "",
    rua: "",
    numero: "",
    complemento: "",
    potencia_kwp: "",
    valor_projeto: "",
    data_instalacao: "",
    numero_placas: "",
    modelo_inversor: "",
    observacoes: "",
    lead_id: "",
  });

  useEffect(() => {
    fetchClientes();
    fetchLeads();
  }, []);

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error("Error fetching clientes:", error);
      toast({
        title: "Erro ao carregar clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, nome, telefone, lead_code")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const clienteData = {
        nome: formData.nome,
        telefone: formData.telefone,
        email: formData.email || null,
        cpf_cnpj: formData.cpf_cnpj || null,
        data_nascimento: formData.data_nascimento || null,
        cep: formData.cep || null,
        estado: formData.estado || null,
        cidade: formData.cidade || null,
        bairro: formData.bairro || null,
        rua: formData.rua || null,
        numero: formData.numero || null,
        complemento: formData.complemento || null,
        potencia_kwp: formData.potencia_kwp ? parseFloat(formData.potencia_kwp) : null,
        valor_projeto: formData.valor_projeto ? parseFloat(formData.valor_projeto) : null,
        data_instalacao: formData.data_instalacao || null,
        numero_placas: formData.numero_placas ? parseInt(formData.numero_placas) : null,
        modelo_inversor: formData.modelo_inversor || null,
        observacoes: formData.observacoes || null,
        lead_id: formData.lead_id || null,
      };

      if (editingCliente) {
        const { error } = await supabase
          .from("clientes")
          .update(clienteData)
          .eq("id", editingCliente.id);

        if (error) throw error;
        toast({ title: "Cliente atualizado!" });
      } else {
        const { error } = await supabase.from("clientes").insert(clienteData);

        if (error) throw error;
        toast({ title: "Cliente cadastrado!" });
      }

      setDialogOpen(false);
      resetForm();
      fetchClientes();
    } catch (error) {
      console.error("Error saving cliente:", error);
      toast({
        title: "Erro ao salvar cliente",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome,
      telefone: cliente.telefone,
      email: cliente.email || "",
      cpf_cnpj: cliente.cpf_cnpj || "",
      data_nascimento: cliente.data_nascimento || "",
      cep: cliente.cep || "",
      estado: cliente.estado || "",
      cidade: cliente.cidade || "",
      bairro: cliente.bairro || "",
      rua: cliente.rua || "",
      numero: cliente.numero || "",
      complemento: cliente.complemento || "",
      potencia_kwp: cliente.potencia_kwp?.toString() || "",
      valor_projeto: cliente.valor_projeto?.toString() || "",
      data_instalacao: cliente.data_instalacao || "",
      numero_placas: cliente.numero_placas?.toString() || "",
      modelo_inversor: cliente.modelo_inversor || "",
      observacoes: cliente.observacoes || "",
      lead_id: cliente.lead_id || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;

    try {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Cliente excluído!" });
      fetchClientes();
    } catch (error) {
      console.error("Error deleting cliente:", error);
      toast({
        title: "Erro ao excluir cliente",
        description: "Verifique se não há recebimentos vinculados",
        variant: "destructive",
      });
    }
  };

  const convertLeadToCliente = (lead: Lead) => {
    setFormData({
      ...formData,
      nome: lead.nome,
      telefone: lead.telefone,
      lead_id: lead.id,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      telefone: "",
      email: "",
      cpf_cnpj: "",
      data_nascimento: "",
      cep: "",
      estado: "",
      cidade: "",
      bairro: "",
      rua: "",
      numero: "",
      complemento: "",
      potencia_kwp: "",
      valor_projeto: "",
      data_instalacao: "",
      numero_placas: "",
      modelo_inversor: "",
      observacoes: "",
      lead_id: "",
    });
    setEditingCliente(null);
  };

  const filteredClientes = clientes.filter(
    (c) =>
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.telefone.includes(searchTerm) ||
      c.cpf_cnpj?.includes(searchTerm)
  );

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCliente ? "Editar Cliente" : "Novo Cliente"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Vincular Lead */}
              <div className="space-y-2">
                <Label>Vincular a um Lead</Label>
                <Select
                  value={formData.lead_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, lead_id: value });
                    const lead = leads.find((l) => l.id === value);
                    if (lead && !formData.nome) {
                      setFormData({
                        ...formData,
                        lead_id: value,
                        nome: lead.nome,
                        telefone: lead.telefone,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um lead (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.lead_code} - {lead.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dados Pessoais */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Dados Pessoais
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone *</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
                    <Input
                      id="cpf_cnpj"
                      value={formData.cpf_cnpj}
                      onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                    <Input
                      id="data_nascimento"
                      type="date"
                      value={formData.data_nascimento}
                      onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Endereço */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Endereço</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      value={formData.cep}
                      onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado</Label>
                    <Select
                      value={formData.estado}
                      onValueChange={(value) => setFormData({ ...formData, estado: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_BRASIL.map((est) => (
                          <SelectItem key={est.sigla} value={est.sigla}>
                            {est.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={formData.cidade}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      value={formData.bairro}
                      onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="rua">Rua</Label>
                    <Input
                      id="rua"
                      value={formData.rua}
                      onChange={(e) => setFormData({ ...formData, rua: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      value={formData.numero}
                      onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="complemento">Complemento</Label>
                    <Input
                      id="complemento"
                      value={formData.complemento}
                      onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Dados do Projeto */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Dados do Projeto Solar
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="potencia_kwp">Potência (kWp)</Label>
                    <Input
                      id="potencia_kwp"
                      type="number"
                      step="0.01"
                      value={formData.potencia_kwp}
                      onChange={(e) => setFormData({ ...formData, potencia_kwp: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valor_projeto">Valor do Projeto (R$)</Label>
                    <Input
                      id="valor_projeto"
                      type="number"
                      step="0.01"
                      value={formData.valor_projeto}
                      onChange={(e) => setFormData({ ...formData, valor_projeto: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data_instalacao">Data da Instalação</Label>
                    <Input
                      id="data_instalacao"
                      type="date"
                      value={formData.data_instalacao}
                      onChange={(e) => setFormData({ ...formData, data_instalacao: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero_placas">Número de Placas</Label>
                    <Input
                      id="numero_placas"
                      type="number"
                      value={formData.numero_placas}
                      onChange={(e) => setFormData({ ...formData, numero_placas: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="modelo_inversor">Modelo do Inversor</Label>
                    <Input
                      id="modelo_inversor"
                      value={formData.modelo_inversor}
                      onChange={(e) => setFormData({ ...formData, modelo_inversor: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingCliente ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredClientes.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum cliente encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClientes.map((cliente) => (
                <TableRow
                  key={cliente.id}
                  className={onSelectCliente ? "cursor-pointer hover:bg-muted" : ""}
                  onClick={() => onSelectCliente?.(cliente)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{cliente.nome}</p>
                      {cliente.cpf_cnpj && (
                        <p className="text-xs text-muted-foreground">{cliente.cpf_cnpj}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>{cliente.telefone}</p>
                      {cliente.email && (
                        <p className="text-muted-foreground text-xs">{cliente.email}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {cliente.potencia_kwp ? (
                      <div className="text-sm">
                        <Badge variant="secondary" className="gap-1">
                          <Sun className="h-3 w-3" />
                          {cliente.potencia_kwp} kWp
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(cliente.valor_projeto)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cliente.lead_id ? (
                      <Badge variant="outline" className="gap-1">
                        <LinkIcon className="h-3 w-3" />
                        Vinculado
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenWhatsApp(cliente);
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      {onSelectCliente && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCliente(cliente);
                          }}
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(cliente);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(cliente.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* WhatsApp Dialog */}
      {selectedClienteForWhatsApp && (
        <WhatsAppSendDialog
          open={whatsappOpen}
          onOpenChange={setWhatsappOpen}
          telefone={selectedClienteForWhatsApp.telefone}
          nome={selectedClienteForWhatsApp.nome}
          tipo="cliente"
        />
      )}
    </div>
  );
}
