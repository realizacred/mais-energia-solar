import { useState, useEffect, useCallback, useMemo } from "react";
import { formatPhone } from "@/lib/validations";
import { FornecedorImportDialog } from "@/components/admin/fornecedores/FornecedorImportDialog";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import {
  Plus, Trash2, Pencil, Truck, Building2, Phone, Mail, MapPin,
  Search, X, Download, Eye, Package, Factory, Wrench, Globe,
  FileText, Calendar, ChevronLeft, ChevronRight,
} from "lucide-react";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/EmailInput";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string | null;
  inscricao_estadual: string | null;
  email: string | null;
  telefone: string | null;
  site: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  tipo: string;
  categorias: string[];
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
}

const TIPOS = [
  { value: "distribuidor", label: "Distribuidor" },
  { value: "fabricante", label: "Fabricante" },
  { value: "integrador", label: "Integrador" },
];

const CATEGORIAS_OPCOES = [
  "Inversores", "Módulos", "Estruturas", "Cabos", "String Box",
  "Baterias", "Microinversores", "Conectores", "Proteções", "Outros",
];

const emptyForm = {
  nome: "", cnpj: "", inscricao_estadual: "", email: "", telefone: "",
  site: "", contato_nome: "", contato_telefone: "", endereco: "",
  cidade: "", estado: "", cep: "", tipo: "distribuidor",
  categorias: [] as string[], observacoes: "",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/* ─── View Modal Info Row ─── */
function InfoRow({ icon: Icon, label, value }: { icon?: any; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2 py-1">
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <p className="text-sm text-foreground break-words">{value || "—"}</p>
      </div>
    </div>
  );
}

export function FornecedoresManager() {
  const { toast } = useToast();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterCidade, setFilterCidade] = useState<string>("all");
  const [filterAtivo, setFilterAtivo] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleting, setDeleting] = useState<Fornecedor | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewFornecedor, setViewFornecedor] = useState<Fornecedor | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fornecedores")
      .select("id, nome, tipo, cnpj, inscricao_estadual, telefone, email, contato_nome, contato_telefone, endereco, cidade, estado, cep, site, categorias, observacoes, ativo, created_at, updated_at")
      .order("nome");
    setFornecedores((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Derived lists ─── */
  const cidades = useMemo(() => {
    const set = new Set(fornecedores.filter(f => f.cidade).map(f => `${f.cidade}/${f.estado || ""}`));
    return Array.from(set).sort();
  }, [fornecedores]);

  /* ─── KPIs ─── */
  const kpis = useMemo(() => {
    const total = fornecedores.length;
    const distribuidores = fornecedores.filter(f => f.tipo === "distribuidor").length;
    const fabricantes = fornecedores.filter(f => f.tipo === "fabricante").length;
    const integradores = fornecedores.filter(f => f.tipo === "integrador").length;
    return { total, distribuidores, fabricantes, integradores };
  }, [fornecedores]);

  /* ─── Active filter count ─── */
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (search) c++;
    if (filterTipo !== "all") c++;
    if (filterCidade !== "all") c++;
    if (filterAtivo !== "all") c++;
    return c;
  }, [search, filterTipo, filterCidade, filterAtivo]);

  const clearFilters = () => {
    setSearch("");
    setFilterTipo("all");
    setFilterCidade("all");
    setFilterAtivo("all");
  };

  /* ─── Filtering ─── */
  const filtered = useMemo(() => {
    return fornecedores.filter(f => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        f.nome.toLowerCase().includes(q) ||
        (f.cnpj && f.cnpj.includes(q)) ||
        (f.cidade && f.cidade.toLowerCase().includes(q));
      const matchTipo = filterTipo === "all" || f.tipo === filterTipo;
      const matchCidade = filterCidade === "all" || `${f.cidade}/${f.estado || ""}` === filterCidade;
      const matchAtivo = filterAtivo === "all" || (filterAtivo === "ativo" ? f.ativo : !f.ativo);
      return matchSearch && matchTipo && matchCidade && matchAtivo;
    });
  }, [fornecedores, search, filterTipo, filterCidade, filterAtivo]);

  /* ─── Pagination ─── */
  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);
  const safeCurrentPage = Math.min(page, totalPages);
  const paginatedData = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safeCurrentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, filterTipo, filterCidade, filterAtivo, pageSize]);

  /* ─── CSV Export ─── */
  const handleExportCSV = () => {
    const headers = ["Nome", "Tipo", "CNPJ", "Email", "Telefone", "Cidade", "UF", "Ativo"];
    const rows = filtered.map(f => [
      f.nome, f.tipo, f.cnpj || "", f.email || "", f.telefone || "",
      f.cidade || "", f.estado || "", f.ativo ? "Sim" : "Não",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fornecedores_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${filtered.length} fornecedores exportados` });
  };

  /* ─── CRUD handlers (unchanged logic) ─── */
  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (f: Fornecedor) => {
    setEditing(f);
    setForm({
      nome: f.nome,
      cnpj: f.cnpj || "",
      inscricao_estadual: f.inscricao_estadual || "",
      email: f.email || "",
      telefone: f.telefone || "",
      site: f.site || "",
      contato_nome: f.contato_nome || "",
      contato_telefone: f.contato_telefone || "",
      endereco: f.endereco || "",
      cidade: f.cidade || "",
      estado: f.estado || "",
      cep: f.cep || "",
      tipo: f.tipo,
      categorias: f.categorias || [],
      observacoes: f.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      cnpj: form.cnpj.trim() || null,
      inscricao_estadual: form.inscricao_estadual.trim() || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      site: form.site.trim() || null,
      contato_nome: form.contato_nome.trim() || null,
      contato_telefone: form.contato_telefone.trim() || null,
      endereco: form.endereco.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim() || null,
      cep: form.cep.trim() || null,
      tipo: form.tipo,
      categorias: form.categorias,
      observacoes: form.observacoes.trim() || null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("fornecedores").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("fornecedores").insert([payload] as any));
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editing ? "Fornecedor atualizado" : "Fornecedor criado" });
      setDialogOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("fornecedores").delete().eq("id", deleting.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Fornecedor excluído" });
      fetchData();
    }
    setDeleting(null);
  };

  const toggleAtivo = async (f: Fornecedor) => {
    await supabase.from("fornecedores").update({ ativo: !f.ativo }).eq("id", f.id);
    fetchData();
  };

  const toggleCategoria = (cat: string) => {
    setForm(prev => ({
      ...prev,
      categorias: prev.categorias.includes(cat)
        ? prev.categorias.filter(c => c !== cat)
        : [...prev.categorias, cat],
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Truck}
        title="Fornecedores"
        description={`${fornecedores.length} fornecedores cadastrados`}
        actions={
          <div className="flex gap-2 flex-wrap items-center">
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                {activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""}
              </Badge>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
            <Button size="sm" onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Novo Fornecedor
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-l-[3px] border-l-primary">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{kpis.total}</p>
                <p className="text-xs text-muted-foreground mt-1">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-success">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{kpis.distribuidores}</p>
                <p className="text-xs text-muted-foreground mt-1">Distribuidores</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-warning">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
                <Factory className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{kpis.fabricantes}</p>
                <p className="text-xs text-muted-foreground mt-1">Fabricantes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-info">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{kpis.integradores}</p>
                <p className="text-xs text-muted-foreground mt-1">Integradores</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou cidade..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCidade} onValueChange={setFilterCidade}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Cidade/UF" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas cidades</SelectItem>
              {cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAtivo} onValueChange={setFilterAtivo}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={clearFilters}>
              <X className="w-3 h-3" /> Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="uppercase tracking-wide text-xs font-semibold text-muted-foreground">Nome</TableHead>
              <TableHead className="uppercase tracking-wide text-xs font-semibold text-muted-foreground">Tipo</TableHead>
              <TableHead className="uppercase tracking-wide text-xs font-semibold text-muted-foreground">CNPJ</TableHead>
              <TableHead className="uppercase tracking-wide text-xs font-semibold text-muted-foreground">Contato</TableHead>
              <TableHead className="uppercase tracking-wide text-xs font-semibold text-muted-foreground">Cidade/UF</TableHead>
              <TableHead className="uppercase tracking-wide text-xs font-semibold text-muted-foreground">Categorias</TableHead>
              <TableHead className="uppercase tracking-wide text-xs font-semibold text-muted-foreground text-center">Ativo</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-md" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 rounded-md" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-10 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                </TableRow>
              ))
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mb-4">
                      <Truck className="h-7 w-7 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-1">Nenhum fornecedor encontrado</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-4">Cadastre um novo fornecedor para começar.</p>
                    <Button onClick={openCreate} className="gap-2">
                      <Plus className="w-4 h-4" /> Novo Fornecedor
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map(f => (
                <TableRow
                  key={f.id}
                  className={`hover:bg-muted/30 cursor-pointer transition-colors border-b border-border/50 ${!f.ativo ? "opacity-50" : ""}`}
                  onClick={() => setViewFornecedor(f)}
                >
                  <TableCell className="font-medium text-foreground py-3">{f.nome}</TableCell>
                  <TableCell className="py-3">
                    <Badge variant="outline" className="text-xs rounded-full px-2 py-0.5">
                      {TIPOS.find(t => t.value === f.tipo)?.label || f.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-3">{f.cnpj || "—"}</TableCell>
                  <TableCell className="py-3">
                    <div className="text-xs space-y-0.5 text-muted-foreground">
                      {f.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3 shrink-0" />{f.email}</div>}
                      {f.telefone && <div className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{f.telefone}</div>}
                      {!f.email && !f.telefone && "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-3">
                    {f.cidade && f.estado ? `${f.cidade}/${f.estado}` : f.cidade || f.estado || "—"}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {(f.categorias || []).slice(0, 3).map(c => (
                        <Badge key={c} variant="outline" className="text-[9px] rounded-full px-2 py-0.5">{c}</Badge>
                      ))}
                      {(f.categorias || []).length > 3 && (
                        <Badge variant="outline" className="text-[9px] rounded-full px-2 py-0.5">+{f.categorias.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-3" onClick={(e) => e.stopPropagation()}>
                    <Switch checked={f.ativo} onCheckedChange={() => toggleAtivo(f)} />
                  </TableCell>
                  <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewFornecedor(f)} aria-label="Ver">
                        <Eye className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)} aria-label="Editar">
                        <Pencil className="h-4 w-4 text-warning" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleting(f)} aria-label="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Exibir</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <span>de {filtered.length} resultados</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={safeCurrentPage <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2 text-xs">{safeCurrentPage} / {totalPages}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={safeCurrentPage >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── View Modal ─── */}
      <Dialog open={!!viewFornecedor} onOpenChange={(v) => { if (!v) setViewFornecedor(null); }}>
        <DialogContent className="w-[90vw] max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {viewFornecedor?.nome}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {TIPOS.find(t => t.value === viewFornecedor?.tipo)?.label || viewFornecedor?.tipo}
                {viewFornecedor && !viewFornecedor.ativo && (
                  <Badge variant="outline" className="ml-2 text-[10px] border-destructive/30 text-destructive">Inativo</Badge>
                )}
              </p>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Left column */}
                <div className="flex-1 space-y-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 border-b border-border pb-1">Identificação</p>
                    <div className="space-y-1">
                      <InfoRow icon={Building2} label="Nome" value={viewFornecedor?.nome} />
                      <InfoRow icon={FileText} label="Tipo" value={TIPOS.find(t => t.value === viewFornecedor?.tipo)?.label} />
                      <InfoRow icon={FileText} label="CNPJ" value={viewFornecedor?.cnpj} />
                      <InfoRow icon={FileText} label="Inscrição Estadual" value={viewFornecedor?.inscricao_estadual} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 border-b border-border pb-1">Contato</p>
                    <div className="space-y-1">
                      <InfoRow icon={Mail} label="E-mail" value={viewFornecedor?.email} />
                      <InfoRow icon={Phone} label="Telefone" value={viewFornecedor?.telefone} />
                      <InfoRow icon={Building2} label="Pessoa de contato" value={viewFornecedor?.contato_nome} />
                      <InfoRow icon={Phone} label="Tel. Contato" value={viewFornecedor?.contato_telefone} />
                      <InfoRow icon={Globe} label="Site" value={viewFornecedor?.site} />
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="flex-1 space-y-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 border-b border-border pb-1">Endereço</p>
                    <div className="space-y-1">
                      <InfoRow icon={MapPin} label="Endereço" value={viewFornecedor?.endereco} />
                      <InfoRow icon={MapPin} label="Cidade" value={viewFornecedor?.cidade} />
                      <InfoRow icon={MapPin} label="UF" value={viewFornecedor?.estado} />
                      <InfoRow icon={MapPin} label="CEP" value={viewFornecedor?.cep} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 border-b border-border pb-1">Histórico</p>
                    <div className="space-y-1">
                      <InfoRow icon={Calendar} label="Criado em" value={viewFornecedor?.created_at ? new Date(viewFornecedor.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null} />
                      <InfoRow icon={FileText} label="Observações" value={viewFornecedor?.observacoes} />
                    </div>
                    {viewFornecedor?.categorias && viewFornecedor.categorias.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Categorias</p>
                        <div className="flex flex-wrap gap-1">
                          {viewFornecedor.categorias.map(c => (
                            <Badge key={c} variant="outline" className="text-xs rounded-full px-2 py-0.5">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => { setViewFornecedor(null); openEdit(viewFornecedor!); }}>
              <Pencil className="w-4 h-4 mr-1" /> Editar
            </Button>
            <Button variant="ghost" onClick={() => setViewFornecedor(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Form Dialog (Create/Edit) ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[90vw] max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {editing ? "Editar Fornecedor" : "Novo Fornecedor"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Preencha os dados do fornecedor
              </p>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-5">
              {/* Identificação */}
              <SectionCard icon={Building2} title="Identificação">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Nome *</Label>
                    <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do fornecedor" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <CpfCnpjInput
                    value={form.cnpj || ""}
                    onChange={(val) => setForm(p => ({ ...p, cnpj: val }))}
                    label="CNPJ"
                    showValidation
                  />
                  <div className="space-y-1.5">
                    <Label>Inscrição Estadual</Label>
                    <Input value={form.inscricao_estadual} onChange={e => setForm(p => ({ ...p, inscricao_estadual: e.target.value }))} />
                  </div>
                </div>
              </SectionCard>

              {/* Contato */}
              <SectionCard icon={Phone} title="Contato">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <EmailInput value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1.5">
                    <Label>Pessoa de Contato</Label>
                    <Input value={form.contato_nome} onChange={e => setForm(p => ({ ...p, contato_nome: e.target.value }))} placeholder="Nome do contato" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tel. Contato</Label>
                    <Input value={form.contato_telefone} onChange={e => setForm(p => ({ ...p, contato_telefone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} />
                  </div>
                </div>
                <div className="space-y-1.5 mt-4">
                  <Label>Site</Label>
                  <Input value={form.site} onChange={e => setForm(p => ({ ...p, site: e.target.value }))} placeholder="https://fornecedor.com.br" />
                </div>
              </SectionCard>

              {/* Endereço */}
              <SectionCard icon={MapPin} title="Endereço">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="col-span-1 sm:col-span-2 space-y-1.5">
                    <Label>Endereço</Label>
                    <Input value={form.endereco} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cidade</Label>
                    <Input value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>UF</Label>
                    <Input value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} maxLength={2} />
                  </div>
                </div>
                <div className="w-full sm:w-32 space-y-1.5 mt-4">
                  <Label>CEP</Label>
                  <Input value={form.cep} onChange={e => setForm(p => ({ ...p, cep: e.target.value }))} placeholder="00000-000" />
                </div>
              </SectionCard>

              {/* Categorias & Obs */}
              <SectionCard icon={Truck} title="Categorias & Observações">
                <div className="space-y-2">
                  <Label>Categorias de Produtos</Label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIAS_OPCOES.map(cat => (
                      <Badge
                        key={cat}
                        variant={form.categorias.includes(cat) ? "default" : "outline"}
                        className="cursor-pointer select-none"
                        onClick={() => toggleCategoria(cat)}
                      >
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5 mt-4">
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={3} />
                </div>
              </SectionCard>
            </div>
          </ScrollArea>

          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button variant="default" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              O fornecedor "{deleting?.nome}" será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="border-destructive text-destructive hover:bg-destructive/10 border bg-transparent">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
