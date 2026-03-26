import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Search, Cpu, Globe, Building2, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InversorImportDialog } from "./inversores/InversorImportDialog";
import {
  useInversoresCatalogo,
  useSalvarInversor,
  useDeletarInversor,
  useToggleInversor,
  type Inversor,
} from "@/hooks/useInversoresCatalogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Inversor type imported from hook

const EMPTY_FORM = {
  fabricante: "", modelo: "", potencia_nominal_kw: "", potencia_maxima_kw: "", tipo: "String",
  tensao_entrada_max_v: "", corrente_entrada_max_a: "",
  tensao_mppt_min_v: "", tensao_mppt_max_v: "", corrente_saida_a: "", fator_potencia: "1.0",
  mppt_count: "2", strings_por_mppt: "1", fases: "Monofásico",
  tensao_saida_v: "220", eficiencia_max_percent: "",
  garantia_anos: "5", peso_kg: "", dimensoes_mm: "",
  wifi_integrado: true, ip_protection: "IP65",
  datasheet_url: "", status: "rascunho",
};

export function InversoresManager() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState("all");
  const [filterFabricante, setFilterFabricante] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [distImportOpen, setDistImportOpen] = useState(false);
  const [editing, setEditing] = useState<Inversor | null>(null);
  const [deleting, setDeleting] = useState<Inversor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: inversores = [], isLoading } = useInversoresCatalogo();
  const saveMutation = useSalvarInversor();
  const deleteMutation = useDeletarInversor();
  const toggleMutation = useToggleInversor();

  const fabricantes = useMemo(() => {
    const set = new Set(inversores.map((i) => i.fabricante));
    return Array.from(set).sort();
  }, [inversores]);

  const filtered = inversores.filter((i) => {
    const matchSearch = !search ||
      `${i.fabricante} ${i.modelo}`.toLowerCase().includes(search.toLowerCase());
    const matchAtivo = filterAtivo === "all" || (filterAtivo === "ativo" ? i.ativo : !i.ativo);
    const matchFab = filterFabricante === "all" || i.fabricante === filterFabricante;
    const matchTipo = filterTipo === "all" || i.tipo === filterTipo;
    return matchSearch && matchAtivo && matchFab && matchTipo;
  });

  const isGlobal = (i: Inversor) => i.tenant_id === null;

  const openDialog = (inv?: Inversor) => {
    if (inv) {
      setEditing(inv);
      setForm({
        fabricante: inv.fabricante, modelo: inv.modelo,
        potencia_nominal_kw: String(inv.potencia_nominal_kw),
        potencia_maxima_kw: inv.potencia_maxima_kw ? String(inv.potencia_maxima_kw) : "",
        tipo: inv.tipo,
        tensao_entrada_max_v: inv.tensao_entrada_max_v ? String(inv.tensao_entrada_max_v) : "",
        corrente_entrada_max_a: inv.corrente_entrada_max_a ? String(inv.corrente_entrada_max_a) : "",
        tensao_mppt_min_v: inv.tensao_mppt_min_v ? String(inv.tensao_mppt_min_v) : "",
        tensao_mppt_max_v: inv.tensao_mppt_max_v ? String(inv.tensao_mppt_max_v) : "",
        corrente_saida_a: inv.corrente_saida_a ? String(inv.corrente_saida_a) : "",
        fator_potencia: inv.fator_potencia ? String(inv.fator_potencia) : "1.0",
        mppt_count: inv.mppt_count ? String(inv.mppt_count) : "2",
        strings_por_mppt: inv.strings_por_mppt ? String(inv.strings_por_mppt) : "1",
        fases: inv.fases,
        tensao_saida_v: inv.tensao_saida_v ? String(inv.tensao_saida_v) : "220",
        eficiencia_max_percent: inv.eficiencia_max_percent ? String(inv.eficiencia_max_percent) : "",
        garantia_anos: inv.garantia_anos ? String(inv.garantia_anos) : "5",
        peso_kg: inv.peso_kg ? String(inv.peso_kg) : "",
        dimensoes_mm: inv.dimensoes_mm || "",
        wifi_integrado: inv.wifi_integrado ?? true,
        ip_protection: inv.ip_protection || "IP65",
        datasheet_url: inv.datasheet_url || "",
        status: inv.status || "rascunho",
      });
    } else {
      setEditing(null);
      setForm(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.fabricante.trim() || !form.modelo.trim() || !form.potencia_nominal_kw) {
      toast({ title: "Preencha fabricante, modelo e potência", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      id: editing?.id,
      data: {
        fabricante: form.fabricante.trim(),
        modelo: form.modelo.trim(),
        potencia_nominal_kw: parseFloat(form.potencia_nominal_kw),
        potencia_maxima_kw: form.potencia_maxima_kw ? parseFloat(form.potencia_maxima_kw) : null,
        tipo: form.tipo,
        tensao_entrada_max_v: form.tensao_entrada_max_v ? parseInt(form.tensao_entrada_max_v) : null,
        corrente_entrada_max_a: form.corrente_entrada_max_a ? parseFloat(form.corrente_entrada_max_a) : null,
        tensao_mppt_min_v: form.tensao_mppt_min_v ? parseInt(form.tensao_mppt_min_v) : null,
        tensao_mppt_max_v: form.tensao_mppt_max_v ? parseInt(form.tensao_mppt_max_v) : null,
        corrente_saida_a: form.corrente_saida_a ? parseFloat(form.corrente_saida_a) : null,
        fator_potencia: form.fator_potencia ? parseFloat(form.fator_potencia) : null,
        mppt_count: form.mppt_count ? parseInt(form.mppt_count) : null,
        strings_por_mppt: form.strings_por_mppt ? parseInt(form.strings_por_mppt) : null,
        fases: form.fases,
        tensao_saida_v: form.tensao_saida_v ? parseInt(form.tensao_saida_v) : null,
        eficiencia_max_percent: form.eficiencia_max_percent ? parseFloat(form.eficiencia_max_percent) : null,
        garantia_anos: form.garantia_anos ? parseInt(form.garantia_anos) : null,
        peso_kg: form.peso_kg ? parseFloat(form.peso_kg) : null,
        dimensoes_mm: form.dimensoes_mm || null,
        wifi_integrado: form.wifi_integrado,
        ip_protection: form.ip_protection || null,
        datasheet_url: form.datasheet_url || null,
        status: form.status,
      },
    }, {
      onSuccess: () => {
        toast({ title: editing ? "Inversor atualizado" : "Inversor cadastrado" });
        setDialogOpen(false);
      },
      onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  };

  const set = (key: string, val: string | boolean) => setForm((p) => ({ ...p, [key]: val }));

  const formatPotencia = (kw: number) => kw < 1 ? `${(kw * 1000).toFixed(0)} W` : `${kw} kW`;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Cpu}
        title="Inversores"
        description={`${inversores.length} inversores cadastrados (${fabricantes.length} fabricantes)`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setDistImportOpen(true)} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" /> CSV Distribuidora
            </Button>
            <Button onClick={() => openDialog()} className="gap-2">
              <Plus className="w-4 h-4" /> Novo Inversor
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar fabricante, modelo..." className="pl-9"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterFabricante} onValueChange={setFilterFabricante}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Fabricante" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fabricantes</SelectItem>
              {fabricantes.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="String">String</SelectItem>
              <SelectItem value="Microinversor">Microinversor</SelectItem>
              <SelectItem value="Híbrido">Híbrido</SelectItem>
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
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Fabricante</TableHead>
                <TableHead className="font-semibold text-foreground">Modelo</TableHead>
                <TableHead className="font-semibold text-foreground">Potência</TableHead>
                <TableHead className="font-semibold text-foreground">Tipo</TableHead>
                <TableHead className="font-semibold text-foreground">Fases</TableHead>
                <TableHead className="font-semibold text-foreground">MPPTs</TableHead>
                <TableHead className="font-semibold text-foreground">Eficiência</TableHead>
                <TableHead className="font-semibold text-foreground">Garantia</TableHead>
                <TableHead className="font-semibold text-foreground">Origem</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-16">
                    <div className="text-center text-muted-foreground">
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
                        <Cpu className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-foreground">Nenhum inversor encontrado</p>
                      <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre um novo inversor.</p>
                      <Button size="sm" onClick={() => openDialog()} className="mt-4 gap-2">
                        <Plus className="w-4 h-4" /> Novo Inversor
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.map((inv) => (
                <TableRow key={inv.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium text-foreground">{inv.fabricante}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{inv.modelo}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {formatPotencia(inv.potencia_nominal_kw)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">{inv.tipo}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">{inv.fases}</Badge>
                  </TableCell>
                  <TableCell>{inv.mppt_count || "—"}</TableCell>
                  <TableCell>
                    {inv.eficiencia_max_percent ? (
                      <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                        {inv.eficiencia_max_percent}%
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{inv.garantia_anos ? `${inv.garantia_anos}a` : "—"}</TableCell>
                  <TableCell>
                    {isGlobal(inv) ? (
                      <Badge variant="outline" className="gap-1 text-xs bg-muted text-muted-foreground border-border">
                        <Globe className="w-3 h-3" /> Global
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs bg-primary/10 text-primary border-primary/20">
                        <Building2 className="w-3 h-3" /> Custom
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={inv.ativo}
                      disabled={isGlobal(inv)}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: inv.id, ativo: v })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {isGlobal(inv) ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(inv)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(inv)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {!isLoading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {filtered.length} de {inversores.length} inversores
          </p>
        )}

        {/* Dialog */}
        <FormModalTemplate
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={editing ? "Editar Inversor" : "Novo Inversor"}
          icon={Cpu}
          subtitle="Cadastre ou edite um inversor"
          onSubmit={handleSave}
          submitLabel={editing ? "Salvar" : "Cadastrar"}
          saving={saveMutation.isPending}
          className="max-w-2xl"
        >
          <FormGrid>
              <div className="space-y-1 sm:col-span-2">
                <Label>Fabricante *</Label>
                <Input value={form.fabricante} onChange={(e) => set("fabricante", e.target.value)} placeholder="Ex: Growatt" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Modelo *</Label>
                <Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} placeholder="Ex: MOD 10KTL3-XH" />
              </div>
              <div className="space-y-1">
                <Label>Potência Nominal (kW) *</Label>
                <Input type="number" step="0.01" value={form.potencia_nominal_kw} onChange={(e) => set("potencia_nominal_kw", e.target.value)} placeholder="10.00" />
              </div>
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="String">String</SelectItem>
                    <SelectItem value="Microinversor">Microinversor</SelectItem>
                    <SelectItem value="Híbrido">Híbrido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fases *</Label>
                <Select value={form.fases} onValueChange={(v) => set("fases", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monofásico">Monofásico</SelectItem>
                    <SelectItem value="Trifásico">Trifásico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>MPPTs</Label>
                <Input type="number" value={form.mppt_count} onChange={(e) => set("mppt_count", e.target.value)} placeholder="2" />
              </div>
              <div className="space-y-1">
                <Label>Strings por MPPT</Label>
                <Input type="number" value={form.strings_por_mppt} onChange={(e) => set("strings_por_mppt", e.target.value)} placeholder="1" />
              </div>
              <div className="space-y-1">
                <Label>Tensão Entrada Máx (V)</Label>
                <Input type="number" value={form.tensao_entrada_max_v} onChange={(e) => set("tensao_entrada_max_v", e.target.value)} placeholder="1100" />
              </div>
              <div className="space-y-1">
                <Label>Corrente Entrada Máx (A)</Label>
                <Input type="number" step="0.1" value={form.corrente_entrada_max_a} onChange={(e) => set("corrente_entrada_max_a", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Tensão Saída (V)</Label>
                <Input type="number" value={form.tensao_saida_v} onChange={(e) => set("tensao_saida_v", e.target.value)} placeholder="220" />
              </div>
              <div className="space-y-1">
                <Label>Corrente de Saída (A)</Label>
                <Input type="number" step="0.1" value={form.corrente_saida_a} onChange={(e) => set("corrente_saida_a", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Tensão MPPT mín (V)</Label>
                <Input type="number" value={form.tensao_mppt_min_v} onChange={(e) => set("tensao_mppt_min_v", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Tensão MPPT máx (V)</Label>
                <Input type="number" value={form.tensao_mppt_max_v} onChange={(e) => set("tensao_mppt_max_v", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Potência Máxima (kW)</Label>
                <Input type="number" step="0.01" value={form.potencia_maxima_kw} onChange={(e) => set("potencia_maxima_kw", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fator de Potência</Label>
                <Input type="number" step="0.01" value={form.fator_potencia} onChange={(e) => set("fator_potencia", e.target.value)} placeholder="1.0" />
              </div>
              <div className="space-y-1">
                <Label>Eficiência Máx (%)</Label>
                <Input type="number" step="0.01" value={form.eficiencia_max_percent} onChange={(e) => set("eficiencia_max_percent", e.target.value)} placeholder="98.40" />
              </div>
              <div className="space-y-1">
                <Label>Garantia (anos)</Label>
                <Input type="number" value={form.garantia_anos} onChange={(e) => set("garantia_anos", e.target.value)} placeholder="5" />
              </div>
              <div className="space-y-1">
                <Label>Peso (kg)</Label>
                <Input type="number" step="0.1" value={form.peso_kg} onChange={(e) => set("peso_kg", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Proteção IP</Label>
                <Input value={form.ip_protection as string} onChange={(e) => set("ip_protection", e.target.value)} placeholder="IP65" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>URL do Datasheet</Label>
                <Input value={form.datasheet_url} onChange={(e) => set("datasheet_url", e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="revisao">Em revisão</SelectItem>
                    <SelectItem value="publicado">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
          </FormGrid>
        </FormModalTemplate>

        <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Inversor</AlertDialogTitle>
              <AlertDialogDescription>
                Excluir "{deleting?.fabricante} {deleting?.modelo}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="border-destructive text-destructive hover:bg-destructive/10 border bg-transparent"
                onClick={() => deleting && deleteMutation.mutate(deleting.id)}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
