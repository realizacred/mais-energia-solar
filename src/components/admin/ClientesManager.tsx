import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { handleSupabaseError } from "@/lib/errorHandler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { EmailInput } from "@/components/ui/EmailInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Download,
  X,
  Building2,
  UserCheck,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPhone } from "@/lib/validations";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import { AddressFields, type AddressData } from "@/components/shared/AddressFields";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { WhatsAppSendDialog } from "./WhatsAppSendDialog";
import { ClienteViewDialog } from "./ClienteViewDialog";
import { ClienteDocumentUpload } from "./ClienteDocumentUpload";
import { PageHeader, EmptyState, LoadingState, SearchInput, Spinner } from "@/components/ui-kit";
import { TablePagination } from "@/components/ui-kit/TablePagination";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  useClientes,
  useLeadsForClientes,
  useSalvarCliente,
  useCheckClienteDependencies,
  useDeletarCliente,
  useClientesRealtime,
  type ClienteRow,
} from "@/hooks/useClientes";

type Cliente = ClienteRow;

interface Lead {
  id: string;
  nome: string;
  telefone: string;
  lead_code: string | null;
}

interface ClientesManagerProps {
  onSelectCliente?: (cliente: Cliente) => void;
}

// ── KPI Card ────────────────────────────────────────────────
function KpiCard({
  icon: Icon,
  label,
  value,
  borderColor = "border-l-primary",
  iconBg = "bg-primary/10 text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  borderColor?: string;
  iconBg?: string;
}) {
  return (
    <Card className={`border-l-[3px] ${borderColor} bg-card shadow-sm`}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg} shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold tracking-tight text-foreground leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ClientesManager({ onSelectCliente }: ClientesManagerProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: clientes = [], isLoading: loading } = useClientes();
  const { data: leads = [] } = useLeadsForClientes();
  const salvarCliente = useSalvarCliente();
  const checkDeps = useCheckClienteDependencies();
  const deletarCliente = useDeletarCliente();
  useClientesRealtime();
  const autoEditApplied = useRef(false);

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

  // ── Filters ─────────────────────────────────────────────
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterCidade, setFilterCidade] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");

  // ── Pagination ──────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  const handleSubmit = async () => {
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

      await salvarCliente.mutateAsync({
        id: editingCliente?.id,
        data: clienteData,
      });

      toast({ title: editingCliente ? "Cliente atualizado!" : "Cliente cadastrado!" });
      setDialogOpen(false);
      resetForm();
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
      const blocking = await checkDeps.mutateAsync(id);

      if (blocking.length > 0) {
        toast({
          title: "Não é possível excluir este cliente",
          description: `Existem registros vinculados que impedem a exclusão: ${blocking.join(", ")}. Remova ou desassocie esses registros primeiro.`,
          variant: "destructive",
        });
        return;
      }

      await deletarCliente.mutateAsync(id);
      toast({ title: "Cliente excluído!" });
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

  // ── Derived data ────────────────────────────────────────
  const cidadesDisponiveis = useMemo(() => {
    const cidades = new Set<string>();
    clientes.forEach((c) => {
      if (c.cidade) cidades.add(c.cidade);
    });
    return Array.from(cidades).sort();
  }, [clientes]);

  const filteredClientes = useMemo(() => {
    return clientes.filter((c) => {
      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          c.nome.toLowerCase().includes(term) ||
          c.telefone.includes(searchTerm) ||
          c.email?.toLowerCase().includes(term) ||
          c.cpf_cnpj?.includes(searchTerm);
        if (!matchesSearch) return false;
      }
      // Tipo (PF/PJ heuristic based on CPF/CNPJ length)
      if (filterTipo !== "todos") {
        const doc = c.cpf_cnpj?.replace(/\D/g, "") || "";
        if (filterTipo === "pf" && doc.length > 11) return false;
        if (filterTipo === "pj" && doc.length <= 11) return false;
      }
      // Cidade
      if (filterCidade !== "todos" && c.cidade !== filterCidade) return false;
      // Status
      if (filterStatus !== "todos") {
        if (filterStatus === "ativo" && !c.ativo) return false;
        if (filterStatus === "inativo" && c.ativo) return false;
      }
      return true;
    });
  }, [clientes, searchTerm, filterTipo, filterCidade, filterStatus]);

  // Reset page on filter change
  const handleSearchChange = useCallback((v: string) => { setSearchTerm(v); setPage(1); }, []);
  const handleFilterTipo = useCallback((v: string) => { setFilterTipo(v); setPage(1); }, []);
  const handleFilterCidade = useCallback((v: string) => { setFilterCidade(v); setPage(1); }, []);
  const handleFilterStatus = useCallback((v: string) => { setFilterStatus(v); setPage(1); }, []);

  const activeFilterCount = [
    filterTipo !== "todos" ? 1 : 0,
    filterCidade !== "todos" ? 1 : 0,
    filterStatus !== "todos" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearFilters = () => {
    setFilterTipo("todos");
    setFilterCidade("todos");
    setFilterStatus("todos");
    setSearchTerm("");
    setPage(1);
  };

  // ── Paginated data ─────────────────────────────────────
  const paginatedClientes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredClientes.slice(start, start + pageSize);
  }, [filteredClientes, page, pageSize]);

  // ── KPIs ────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = clientes.length;
    let pf = 0;
    let pj = 0;
    let comProjeto = 0;
    clientes.forEach((c) => {
      const doc = c.cpf_cnpj?.replace(/\D/g, "") || "";
      if (doc.length > 11) pj++;
      else pf++;
      if (c.potencia_kwp && c.potencia_kwp > 0) comProjeto++;
    });
    return { total, pf, pj, comProjeto };
  }, [clientes]);

  // ── CSV Export ──────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    if (filteredClientes.length === 0) return;
    const headers = ["Nome", "Telefone", "E-mail", "CPF/CNPJ", "Cidade", "Estado", "Potência kWp", "Valor Projeto", "Ativo"];
    const rows = filteredClientes.map((c) => [
      c.nome,
      c.telefone,
      c.email || "",
      c.cpf_cnpj || "",
      c.cidade || "",
      c.estado || "",
      c.potencia_kwp?.toString() || "",
      c.valor_projeto?.toString() || "",
      c.ativo ? "Sim" : "Não",
    ]);
    const csvContent = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    a.download = `clientes_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${filteredClientes.length} clientes exportados` });
  }, [filteredClientes]);

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader
        icon={Users}
        title="Clientes"
        description="Gerencie os clientes da sua base"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filteredClientes.length === 0}>
              <Download className="h-4 w-4 mr-1.5" />
              Exportar CSV
            </Button>
            <Button className="gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </div>
        }
      />

      {/* KPI Cards §27 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Total de clientes" value={kpis.total} borderColor="border-l-primary" iconBg="bg-primary/10 text-primary" />
        <KpiCard icon={UserCheck} label="Pessoas físicas" value={kpis.pf} borderColor="border-l-info" iconBg="bg-info/10 text-info" />
        <KpiCard icon={Building2} label="Pessoas jurídicas" value={kpis.pj} borderColor="border-l-warning" iconBg="bg-warning/10 text-warning" />
        <KpiCard icon={Sun} label="Com projeto ativo" value={kpis.comProjeto} borderColor="border-l-success" iconBg="bg-success/10 text-success" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <SearchInput
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Buscar por nome, telefone, e-mail ou CPF..."
          />
          <Select value={filterTipo} onValueChange={handleFilterTipo}>
            <SelectTrigger className="h-9 w-[130px] text-sm">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pf">Pessoa Física</SelectItem>
              <SelectItem value="pj">Pessoa Jurídica</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCidade} onValueChange={handleFilterCidade}>
            <SelectTrigger className="h-9 w-[150px] text-sm">
              <SelectValue placeholder="Cidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas cidades</SelectItem>
              {cidadesDisponiveis.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={handleFilterStatus}>
            <SelectTrigger className="h-9 w-[120px] text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
          {activeFilterCount > 0 && (
            <>
              <Badge variant="secondary" className="text-xs">{activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""}</Badge>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1">
                <X className="h-3 w-3" /> Limpar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="w-[90vw] max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          {/* §25 Header */}
          <DialogHeader className="flex flex-row items-center gap-3 px-4 py-3 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-bold text-foreground">
                {editingCliente ? "Editar Cliente" : "Novo Cliente"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Cadastre ou edite um cliente</p>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 py-3.5 space-y-4">
              {/* Vincular Lead */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Vincular a um Lead</Label>
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
                  <SelectTrigger className="h-8 text-sm">
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
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Dados pessoais</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Nome <span className="text-destructive">*</span></Label>
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="h-8 text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Telefone <span className="text-destructive">*</span></Label>
                    <PhoneInput
                      value={formData.telefone}
                      onChange={(raw) => setFormData({ ...formData, telefone: raw })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">E-mail</Label>
                    <EmailInput
                      value={formData.email}
                      onChange={(v) => setFormData({ ...formData, email: v })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">CPF/CNPJ</Label>
                    <CpfCnpjInput
                      value={formData.cpf_cnpj}
                      onChange={(v) => setFormData({ ...formData, cpf_cnpj: v })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Data de Nascimento</Label>
                    <DateInput
                      value={formData.data_nascimento}
                      onChange={(v) => setFormData({ ...formData, data_nascimento: v })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Endereço — usa AddressFields (RB-09) */}
              <div className="space-y-2.5 border-t border-border pt-3.5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Endereço</p>
                <AddressFields
                  value={{
                    cep: formData.cep,
                    rua: formData.rua,
                    numero: formData.numero,
                    complemento: formData.complemento,
                    bairro: formData.bairro,
                    cidade: formData.cidade,
                    estado: formData.estado,
                  }}
                  onChange={(addr) => {
                    setFormData(prev => ({
                      ...prev,
                      cep: addr.cep,
                      rua: addr.rua,
                      numero: addr.numero,
                      complemento: addr.complemento,
                      bairro: addr.bairro,
                      cidade: addr.cidade,
                      estado: addr.estado,
                    }));
                  }}
                />
              </div>

              {/* Observações */}
              <div className="space-y-1 border-t border-border pt-3.5">
                <Label className="text-[11px] font-medium text-muted-foreground">Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={2}
                  className="text-sm min-h-[48px] resize-y"
                />
              </div>

              {/* Documentos (somente no modo edição) */}
              {editingCliente && (
                <div className="space-y-2.5 border-t border-border pt-3.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Documentos</p>
                  <ClienteDocumentUpload
                    clienteId={editingCliente.id}
                    documents={editDocuments}
                    onDocumentsChange={(updated) => {
                      setEditDocuments(updated);
                    }}
                  />
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-muted/30 shrink-0">
            <Button type="button" variant="ghost" onClick={() => { setDialogOpen(false); resetForm(); }} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Spinner size="sm" className="mr-1.5" />}
              {saving ? "Salvando..." : editingCliente ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredClientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente encontrado"
          description={activeFilterCount > 0 ? "Tente ajustar os filtros" : "Cadastre um novo cliente para começar"}
          action={activeFilterCount === 0 ? { label: "Novo Cliente", onClick: () => setDialogOpen(true), icon: Plus } : undefined}
        />
      ) : (
        <SectionCard icon={Users} title={`Clientes (${filteredClientes.length})`} variant="neutral" noPadding>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Cliente</TableHead>
                <TableHead className="font-semibold text-foreground">Contato</TableHead>
                <TableHead className="font-semibold text-foreground">Projeto</TableHead>
                <TableHead className="font-semibold text-foreground">Docs</TableHead>
                <TableHead className="font-semibold text-foreground">Lead</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedClientes.map((cliente) => (
                <TableRow
                  key={cliente.id}
                  className={`${onSelectCliente ? "cursor-pointer" : ""} hover:bg-muted/30 transition-colors ${!cliente.ativo ? "opacity-50" : ""}`}
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
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30 gap-1 text-xs">
                          <Sun className="h-3 w-3" />
                          {cliente.potencia_kwp} kWp
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(cliente.valor_projeto)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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
                      <span className="text-muted-foreground">—</span>
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
          <TablePagination
            totalItems={filteredClientes.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
          />
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
    </motion.div>
  );
}
