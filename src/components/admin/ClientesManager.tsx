import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { handleSupabaseError } from "@/lib/errorHandler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionCard } from "@/components/ui-kit/SectionCard";
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
  Edit,
  Trash2,
  Link as LinkIcon,
  DollarSign,
  Sun,
  MessageSquare,
  Eye,
  FileText,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { formatPhone, ESTADOS_BRASIL } from "@/lib/validations";
import { useCidadesPorEstado } from "@/hooks/useCidadesPorEstado";
import { WhatsAppSendDialog } from "./WhatsAppSendDialog";
import { ClienteViewDialog } from "./ClienteViewDialog";
import { ClienteDocumentUpload } from "./ClienteDocumentUpload";
import { PageHeader, EmptyState, LoadingState, SearchInput } from "@/components/ui-kit";
import { useUserPermissions } from "@/hooks/useUserPermissions";

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
  localizacao: string | null;
  ativo: boolean;
  created_at: string;
  identidade_urls: string[] | null;
  comprovante_endereco_urls: string[] | null;
  comprovante_beneficiaria_urls: string[] | null;
  disjuntor_id: string | null;
  transformador_id: string | null;
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
  const { hasPermission } = useUserPermissions();
  const canDeleteClients = hasPermission("delete_clients");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [selectedClienteForWhatsApp, setSelectedClienteForWhatsApp] = useState<Cliente | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [editDocuments, setEditDocuments] = useState<{
    identidade_urls: string[];
    comprovante_endereco_urls: string[];
    comprovante_beneficiaria_urls: string[];
  }>({ identidade_urls: [], comprovante_endereco_urls: [], comprovante_beneficiaria_urls: [] });

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

  // ⚠️ HARDENING: Realtime subscription for cross-user sync on clientes
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('clientes-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'clientes' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchClientes(), 500);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clientes' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchClientes(), 500);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'clientes' },
        (payload) => {
          if (payload.old) {
            const deletedId = (payload.old as any).id;
            setClientes(prev => prev.filter(c => c.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone, email, cpf_cnpj, data_nascimento, cep, estado, cidade, bairro, rua, numero, complemento, potencia_kwp, valor_projeto, data_instalacao, numero_placas, modelo_inversor, observacoes, lead_id, localizacao, ativo, created_at, identidade_urls, comprovante_endereco_urls, comprovante_beneficiaria_urls, disjuntor_id, transformador_id")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      const appError = handleSupabaseError(error, "fetch_clientes");
      toast({
        title: "Erro ao carregar clientes",
        description: appError.userMessage,
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
        .is("deleted_at", null)
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
        // cliente_code é gerado automaticamente pelo trigger generate_cliente_code()
        const { error } = await supabase.from("clientes").insert(clienteData as any);

        if (error) throw error;
        toast({ title: "Cliente cadastrado!" });
      }

      setDialogOpen(false);
      resetForm();
      fetchClientes();
    } catch (error) {
      const appError = handleSupabaseError(error, editingCliente ? "update_cliente" : "create_cliente");
      toast({
        title: "Erro ao salvar cliente",
        description: appError.userMessage,
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
    setEditDocuments({
      identidade_urls: cliente.identidade_urls || [],
      comprovante_endereco_urls: cliente.comprovante_endereco_urls || [],
      comprovante_beneficiaria_urls: cliente.comprovante_beneficiaria_urls || [],
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente? Todos os registros vinculados serão desassociados.")) return;

    try {
      // Check for blocking dependencies and provide clear feedback
      const dependencyChecks = await Promise.all([
        supabase.from("propostas_nativas").select("id", { count: "exact", head: true }).eq("cliente_id", id),
        supabase.from("projetos").select("id", { count: "exact", head: true }).eq("cliente_id", id),
        supabase.from("deals").select("id", { count: "exact", head: true }).eq("customer_id", id),
        supabase.from("comissoes").select("id", { count: "exact", head: true }).eq("cliente_id", id),
        supabase.from("recebimentos").select("id", { count: "exact", head: true }).eq("cliente_id", id),
        supabase.from("checklists_cliente").select("id", { count: "exact", head: true }).eq("cliente_id", id),
        supabase.from("checklists_instalador").select("id", { count: "exact", head: true }).eq("cliente_id", id),
        supabase.from("layouts_solares").select("id", { count: "exact", head: true }).eq("cliente_id", id),
        supabase.from("servicos_agendados").select("id", { count: "exact", head: true }).eq("cliente_id", id),
      ]);

      const depNames = [
        "Propostas", "Projetos", "Negociações em andamento", "Comissões",
        "Recebimentos", "Checklists do Cliente", "Checklists do Instalador",
        "Layouts Solares", "Serviços Agendados",
      ];

      const blocking: string[] = [];
      dependencyChecks.forEach((res, i) => {
        if ((res.count ?? 0) > 0) {
          blocking.push(`${depNames[i]} (${res.count})`);
        }
      });

      if (blocking.length > 0) {
        toast({
          title: "Não é possível excluir este cliente",
          description: `Existem registros vinculados que impedem a exclusão: ${blocking.join(", ")}. Remova ou desassocie esses registros primeiro.`,
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Cliente excluído!" });
      fetchClientes();
    } catch (error) {
      const appError = handleSupabaseError(error, "delete_cliente", { entityId: id });
      toast({
        title: "Erro ao excluir cliente",
        description: appError.userMessage,
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
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Clientes"
        description="Gerencie os clientes da sua base"
        actions={
          <Button className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por nome, telefone ou CPF..."
        />

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
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
              <SectionCard icon={Users} title="Dados pessoais" variant="blue">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                </div>
              </SectionCard>

              {/* Endereço */}
              <SectionCard icon={Users} title="Endereço" variant="green">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      value={formData.cep}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                        setFormData({ ...formData, cep: raw });
                        // Auto-fill via ViaCEP
                        if (raw.length === 8) {
                          fetch(`https://viacep.com.br/ws/${raw}/json/`)
                            .then(r => r.json())
                            .then(data => {
                              if (!data.erro) {
                                setFormData(prev => ({
                                  ...prev,
                                  rua: data.logradouro || prev.rua,
                                  bairro: data.bairro || prev.bairro,
                                  cidade: data.localidade || prev.cidade,
                                  estado: data.uf || prev.estado,
                                  complemento: data.complemento || prev.complemento,
                                }));
                              }
                            })
                            .catch(() => { /* ViaCEP offline */ });
                        }
                      }}
                      placeholder="00000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado</Label>
                    <Select
                      value={formData.estado}
                      onValueChange={(value) => setFormData({ ...formData, estado: value, cidade: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_BRASIL.map((est) => (
                          <SelectItem key={est.sigla} value={est.sigla}>
                            {est.sigla}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <CidadeSelect estado={formData.estado} cidade={formData.cidade} onCidadeChange={(v) => setFormData({ ...formData, cidade: v })} />
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
                </div>
              </SectionCard>

              {/* Seção "Dados do projeto solar" removida — esses dados pertencem ao domínio Projetos */}

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

              {/* Documentos (somente no modo edição) */}
              {editingCliente && (
                <SectionCard icon={FileText} title="Documentos" variant="blue">
                    <ClienteDocumentUpload
                      clienteId={editingCliente.id}
                      documents={editDocuments}
                      onDocumentsChange={(updated) => {
                        setEditDocuments(updated);
                        fetchClientes();
                      }}
                    />
                </SectionCard>
              )}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Spinner size="sm" className="mr-2" />}
                  {editingCliente ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <LoadingState />
      ) : filteredClientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente encontrado"
          description="Cadastre um novo cliente para começar"
          action={{ label: "Novo Cliente", onClick: () => setDialogOpen(true), icon: Plus }}
        />
      ) : (
        <SectionCard icon={Users} title="Clientes" variant="neutral" noPadding>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Docs</TableHead>
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
                    {(() => {
                      const docCount = (cliente.identidade_urls?.length || 0) +
                        (cliente.comprovante_endereco_urls?.length || 0) +
                        (cliente.comprovante_beneficiaria_urls?.length || 0);
                      return docCount > 0 ? (
                        <Badge variant="outline" className="gap-1 text-primary border-primary/30">
                          <FileText className="h-3 w-3" />
                          {docCount}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      );
                    })()}
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
                        className="text-secondary hover:text-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCliente(cliente);
                          setViewOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-success hover:text-success/80 hover:bg-success/10"
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
                          <DollarSign className="h-4 w-4 text-success" />
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
                        <Edit className="h-4 w-4 text-info" />
                      </Button>
                      {canDeleteClients && (
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
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
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

      {/* View Dialog */}
      <ClienteViewDialog
        cliente={selectedCliente}
        open={viewOpen}
        onOpenChange={setViewOpen}
      />
    </div>
  );
}

function CidadeSelect({ estado, cidade, onCidadeChange }: { estado: string; cidade: string; onCidadeChange: (v: string) => void }) {
  const { cidades, isLoading } = useCidadesPorEstado(estado);

  if (!estado || cidades.length === 0) {
    return (
      <div className="space-y-2">
        <Label htmlFor="cidade">Cidade</Label>
        <Input
          id="cidade"
          value={cidade}
          onChange={(e) => onCidadeChange(e.target.value)}
          placeholder={isLoading ? "Carregando..." : "Digite a cidade"}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="cidade">Cidade</Label>
      <Select value={cidade} onValueChange={onCidadeChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione a cidade" />
        </SelectTrigger>
        <SelectContent>
          {cidades.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
