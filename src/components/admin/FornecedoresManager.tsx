import { useState, useEffect } from "react";
import { formatPhone } from "@/lib/validations";
import { formatCpfCnpj } from "@/lib/cpfCnpjUtils";
import { Plus, Trash2, Pencil, Truck, Building2, Globe, Phone, Mail, MapPin } from "lucide-react";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, LoadingState, SearchInput } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export function FornecedoresManager() {
  const { toast } = useToast();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleting, setDeleting] = useState<Fornecedor | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fornecedores")
      .select("id, nome, tipo, cnpj, inscricao_estadual, telefone, email, contato_nome, contato_telefone, endereco, cidade, estado, cep, site, categorias, observacoes, ativo, created_at, updated_at")
      .order("nome");
    setFornecedores((data as any[]) || []);
    setLoading(false);
  };

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

  const filtered = fornecedores.filter(f =>
    f.nome.toLowerCase().includes(search.toLowerCase()) ||
    (f.cnpj && f.cnpj.includes(search)) ||
    (f.cidade && f.cidade.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <LoadingState message="Carregando fornecedores..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Truck}
        title="Fornecedores"
        description="Cadastro de distribuidores, fabricantes e integradores de equipamentos"
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome, CNPJ ou cidade..."
          className="flex-1 max-w-sm"
        />
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo Fornecedor
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Categorias</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nenhum fornecedor encontrado
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(f => (
                <TableRow key={f.id} className={!f.ativo ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {TIPOS.find(t => t.value === f.tipo)?.label || f.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.cnpj || "—"}</TableCell>
                  <TableCell>
                    <div className="text-xs space-y-0.5">
                      {f.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{f.email}</div>}
                      {f.telefone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{f.telefone}</div>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {f.cidade && f.estado ? `${f.cidade}/${f.estado}` : f.cidade || f.estado || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(f.categorias || []).slice(0, 3).map(c => (
                        <Badge key={c} variant="secondary" className="text-[9px]">{c}</Badge>
                      ))}
                      {(f.categorias || []).length > 3 && (
                        <Badge variant="secondary" className="text-[9px]">+{f.categorias.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch checked={f.ativo} onCheckedChange={() => toggleAtivo(f)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(f)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {editing ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Identificação */}
            <SectionCard icon={Building2} title="Identificação" variant="blue">
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
                  <div className="space-y-1.5">
                    <Label>CNPJ</Label>
                    <Input value={form.cnpj} onChange={e => setForm(p => ({ ...p, cnpj: formatCpfCnpj(e.target.value) }))} placeholder="00.000.000/0000-00" maxLength={18} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Inscrição Estadual</Label>
                    <Input value={form.inscricao_estadual} onChange={e => setForm(p => ({ ...p, inscricao_estadual: e.target.value }))} />
                  </div>
                </div>
            </SectionCard>

            {/* Contato */}
            <SectionCard icon={Phone} title="Contato" variant="green">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="contato@fornecedor.com" />
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
            <SectionCard icon={MapPin} title="Endereço" variant="neutral">
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
            <SectionCard icon={Truck} title="Categorias & Observações" variant="neutral">
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
