import { useState, useMemo } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import { Plus, Pencil, Trash2, Search, Cpu, Globe, Building2, FileSpreadsheet, Wand2, X, GitCompareArrows, Package, CheckCircle2, FileWarning, Sparkles, LayoutGrid, Table as TableIcon, Eye, Zap } from "lucide-react";
import { EnrichButton } from "./shared/EnrichButton";
import { BatchEnrichDialog } from "./shared/BatchEnrichDialog";
import { useToast } from "@/hooks/use-toast";
import { InversorImportDialog } from "./inversores/InversorImportDialog";
import { InversorTableView } from "./inversores/InversorTableView";
import { InversorCompareModal } from "./inversores/InversorCompareModal";
import { InversorViewModal } from "./inversores/InversorViewModal";
import {
  useInversoresCatalogo, useSalvarInversor, useDeletarInversor, useToggleInversor, type Inversor,
} from "@/hooks/useInversoresCatalogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { calcCompletudeInversor } from "@/utils/calcCompletudeInversor";

type ViewMode = "cards" | "table";

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
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPotMin, setFilterPotMin] = useState("");
  const [filterPotMax, setFilterPotMax] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [distImportOpen, setDistImportOpen] = useState(false);
  const [batchEnrichOpen, setBatchEnrichOpen] = useState(false);
  const [editing, setEditing] = useState<Inversor | null>(null);
  const [deleting, setDeleting] = useState<Inversor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [viewItem, setViewItem] = useState<Inversor | null>(null);

  const { data: inversores = [], isLoading } = useInversoresCatalogo();
  const saveMutation = useSalvarInversor();
  const deleteMutation = useDeletarInversor();
  const toggleMutation = useToggleInversor();

  const fabricantes = useMemo(() => {
    const set = new Set(inversores.map((i) => i.fabricante));
    return Array.from(set).sort();
  }, [inversores]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (search) c++;
    if (filterAtivo !== "all") c++;
    if (filterFabricante !== "all") c++;
    if (filterTipo !== "all") c++;
    if (filterStatus !== "all") c++;
    if (filterPotMin) c++;
    if (filterPotMax) c++;
    return c;
  }, [search, filterAtivo, filterFabricante, filterTipo, filterStatus, filterPotMin, filterPotMax]);

  const clearFilters = () => {
    setSearch(""); setFilterAtivo("all"); setFilterFabricante("all");
    setFilterTipo("all"); setFilterStatus("all"); setFilterPotMin(""); setFilterPotMax("");
  };

  const filtered = useMemo(() => inversores.filter((i) => {
    const matchSearch = !search || `${i.fabricante} ${i.modelo}`.toLowerCase().includes(search.toLowerCase());
    const matchAtivo = filterAtivo === "all" || (filterAtivo === "ativo" ? i.ativo : !i.ativo);
    const matchFab = filterFabricante === "all" || i.fabricante === filterFabricante;
    const matchTipo = filterTipo === "all" || i.tipo === filterTipo;
    const matchStatus = filterStatus === "all" || i.status === filterStatus;
    const potMin = filterPotMin ? parseFloat(filterPotMin) : null;
    const potMax = filterPotMax ? parseFloat(filterPotMax) : null;
    const matchPotMin = potMin == null || i.potencia_nominal_kw >= potMin;
    const matchPotMax = potMax == null || i.potencia_nominal_kw <= potMax;
    return matchSearch && matchAtivo && matchFab && matchTipo && matchStatus && matchPotMin && matchPotMax;
  }), [inversores, search, filterAtivo, filterFabricante, filterTipo, filterStatus, filterPotMin, filterPotMax]);

  const kpis = useMemo(() => {
    const total = inversores.length;
    const publicados = inversores.filter(i => i.status === "publicado").length;
    const rascunhos = inversores.filter(i => i.status === "rascunho").length;
    const completos = inversores.filter(i => calcCompletudeInversor(i) >= 80).length;
    return { total, publicados, rascunhos, completos };
  }, [inversores]);

  const isGlobal = (i: Inversor) => i.tenant_id === null;
  const formatPotencia = (kw: number) => kw < 1 ? `${(kw * 1000).toFixed(0)} W` : `${kw} kW`;

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
        fabricante: form.fabricante.trim(), modelo: form.modelo.trim(),
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
      onSuccess: () => { toast({ title: editing ? "Inversor atualizado" : "Inversor cadastrado" }); setDialogOpen(false); },
      onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  };

  const set = (key: string, val: string | boolean) => setForm((p) => ({ ...p, [key]: val }));

  const toggleCompare = (id: string, checked: boolean) => {
    const next = new Set(compareIds);
    if (checked && next.size < 3) next.add(id); else next.delete(id);
    setCompareIds(next);
  };

  const compareInversores = useMemo(() => inversores.filter(i => compareIds.has(i.id)), [inversores, compareIds]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Cpu}
        title="Inversores"
        description={`${inversores.length} inversores cadastrados (${fabricantes.length} fabricantes)`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {activeFilterCount > 0 && <Badge variant="secondary" className="gap-1">{activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""}</Badge>}
            <Button variant="outline" size="sm" onClick={() => setBatchEnrichOpen(true)} className="gap-2"><Wand2 className="w-4 h-4" /> Buscar specs IA</Button>
            <Button variant="outline" size="sm" onClick={() => setDistImportOpen(true)} className="gap-2"><FileSpreadsheet className="w-4 h-4" /> CSV Distribuidora</Button>
            <Button size="sm" onClick={() => openDialog()} className="gap-2"><Plus className="w-4 h-4" /> Novo Inversor</Button>
          </div>
        }
      />

      {/* KPIs */}
      {!isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-l-[3px] border-l-primary"><CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0"><Package className="w-4 h-4" /></div>
            <div><p className="text-xl font-bold text-foreground leading-none">{kpis.total}</p><p className="text-xs text-muted-foreground mt-1">Total inversores</p></div>
          </CardContent></Card>
          <Card className="border-l-[3px] border-l-success"><CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0"><CheckCircle2 className="w-4 h-4" /></div>
            <div><p className="text-xl font-bold text-foreground leading-none">{kpis.publicados}<span className="text-xs font-normal text-muted-foreground ml-1">({kpis.total ? Math.round((kpis.publicados / kpis.total) * 100) : 0}%)</span></p><p className="text-xs text-muted-foreground mt-1">Publicados</p></div>
          </CardContent></Card>
          <Card className="border-l-[3px] border-l-warning"><CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0"><FileWarning className="w-4 h-4" /></div>
            <div><p className="text-xl font-bold text-foreground leading-none">{kpis.rascunhos}<span className="text-xs font-normal text-muted-foreground ml-1">({kpis.total ? Math.round((kpis.rascunhos / kpis.total) * 100) : 0}%)</span></p><p className="text-xs text-muted-foreground mt-1">Rascunhos</p></div>
          </CardContent></Card>
          <Card className="border-l-[3px] border-l-info"><CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0"><Sparkles className="w-4 h-4" /></div>
            <div><p className="text-xl font-bold text-foreground leading-none">{kpis.completos}<span className="text-xs font-normal text-muted-foreground ml-1">({kpis.total ? Math.round((kpis.completos / kpis.total) * 100) : 0}%)</span></p><p className="text-xs text-muted-foreground mt-1">Specs completas (≥80%)</p></div>
          </CardContent></Card>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar fabricante, modelo..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1 border rounded-md p-0.5">
              <Button variant={viewMode === "cards" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("cards")}><LayoutGrid className="w-4 h-4" /></Button>
              <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("table")}><TableIcon className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Select value={filterFabricante} onValueChange={setFilterFabricante}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Fabricante" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos fabricantes</SelectItem>{fabricantes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos os tipos</SelectItem><SelectItem value="String">String</SelectItem><SelectItem value="Microinversor">Microinversor</SelectItem><SelectItem value="Híbrido">Híbrido</SelectItem></SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos status</SelectItem><SelectItem value="rascunho">Rascunho</SelectItem><SelectItem value="revisao">Revisão</SelectItem><SelectItem value="publicado">Publicado</SelectItem></SelectContent>
            </Select>
            <Select value={filterAtivo} onValueChange={setFilterAtivo}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="ativo">Ativos</SelectItem><SelectItem value="inativo">Inativos</SelectItem></SelectContent>
            </Select>
            <Input type="number" placeholder="Min kW" className="w-24 h-9" value={filterPotMin} onChange={(e) => setFilterPotMin(e.target.value)} />
            <Input type="number" placeholder="Max kW" className="w-24 h-9" value={filterPotMax} onChange={(e) => setFilterPotMax(e.target.value)} />
            {activeFilterCount > 0 && <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={clearFilters}><X className="w-3 h-3" /> Limpar filtros</Button>}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3"><Cpu className="w-6 h-6" /></div>
            <p className="font-medium text-foreground">Nenhum inversor encontrado</p>
            <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre um novo inversor.</p>
            <Button size="sm" onClick={() => openDialog()} className="mt-4 gap-2"><Plus className="w-4 h-4" /> Novo Inversor</Button>
          </div>
        ) : viewMode === "cards" ? (
          <VirtuosoGrid
            style={{ height: "calc(100vh - 320px)" }}
            totalCount={filtered.length}
            itemContent={(index) => {
              const inv = filtered[index];
              const comp = calcCompletudeInversor(inv);
              const statusColor = inv.status === "publicado" ? "bg-success/10 text-success border-success/20" : inv.status === "revisao" ? "bg-info/10 text-info border-info/20" : "bg-warning/10 text-warning border-warning/20";
              const statusLabel = inv.status === "publicado" ? "Publicado" : inv.status === "revisao" ? "Revisão" : "Rascunho";
              return (
                <Card key={inv.id} className={`group relative border border-border hover:border-primary/30 hover:shadow-sm transition-all ${!inv.ativo ? "opacity-50 grayscale" : ""}`}>
                  <div className="absolute top-3 right-3 flex gap-1 z-10">
                    <EnrichButton equipmentType="inversor" equipmentId={inv.id} />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(inv)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                  </div>
                  {compareIds.size < 3 && (
                    <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Checkbox checked={compareIds.has(inv.id)} onCheckedChange={(v) => toggleCompare(inv.id, !!v)} />
                    </div>
                  )}
                  <CardContent className="pt-4 pb-3 px-4 space-y-3">
                    <div className="pr-16">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-muted-foreground">{inv.fabricante}</p>
                        {isGlobal(inv) ? <Globe className="w-3 h-3 text-muted-foreground" /> : <Building2 className="w-3 h-3 text-primary" />}
                      </div>
                      <p className="font-semibold text-sm truncate" title={inv.modelo}>{inv.modelo}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="gap-1 font-mono text-xs bg-primary/10 text-primary border-primary/20"><Zap className="w-3 h-3" />{formatPotencia(inv.potencia_nominal_kw)}</Badge>
                      <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">{inv.tipo}</Badge>
                      {inv.eficiencia_max_percent && <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">{inv.eficiencia_max_percent}%</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">{inv.fases}</Badge>
                      {inv.mppt_count && <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">{inv.mppt_count} MPPTs</Badge>}
                      <Badge className={`text-xs ${statusColor}`}>{statusLabel}</Badge>
                      {!inv.ativo && <Badge variant="muted" className="text-xs">Inativo</Badge>}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Completude</span>
                        <span className={`text-xs font-medium ${comp >= 80 ? "text-success" : comp >= 60 ? "text-warning" : "text-destructive"}`}>{comp}%</span>
                      </div>
                      <Progress value={comp} className="h-1.5" />
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <span className="text-xs text-muted-foreground">{inv.ativo ? "Ativo" : "Inativo"}</span>
                      <Switch checked={inv.ativo} onCheckedChange={(v) => toggleMutation.mutate({ id: inv.id, ativo: v })} className="scale-90" />
                    </div>
                  </CardContent>
                </Card>
              );
            }}
            listClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-1"
          />
        ) : (
          <InversorTableView inversores={filtered} onView={(i) => setViewItem(i)} onEdit={(i) => openDialog(i)} onDelete={(i) => setDeleting(i)} onToggle={(id, v) => toggleMutation.mutate({ id, ativo: v })} />
        )}

        {!isLoading && filtered.length > 0 && <p className="text-xs text-muted-foreground text-right">{filtered.length} de {inversores.length} inversores</p>}
      </div>

      {compareIds.size >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <Button size="lg" className="gap-2 shadow-lg" onClick={() => setCompareOpen(true)}><GitCompareArrows className="w-4 h-4" /> Comparar ({compareIds.size})</Button>
        </div>
      )}

      {/* Form Dialog */}
      <FormModalTemplate open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? "Editar Inversor" : "Novo Inversor"} icon={Cpu} subtitle="Cadastre ou edite um inversor" onSubmit={handleSave} submitLabel={editing ? "Salvar" : "Cadastrar"} saving={saveMutation.isPending} className="max-w-2xl">
        <FormGrid>
          <div className="space-y-1 sm:col-span-2"><Label>Fabricante *</Label><Input value={form.fabricante} onChange={(e) => set("fabricante", e.target.value)} placeholder="Ex: Growatt" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Modelo *</Label><Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} placeholder="Ex: MOD 10KTL3-XH" /></div>
          <div className="space-y-1"><Label>Potência Nominal (kW) *</Label><Input type="number" step="0.01" value={form.potencia_nominal_kw} onChange={(e) => set("potencia_nominal_kw", e.target.value)} placeholder="10.00" /></div>
          <div className="space-y-1"><Label>Tipo *</Label><Select value={form.tipo} onValueChange={(v) => set("tipo", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="String">String</SelectItem><SelectItem value="Microinversor">Microinversor</SelectItem><SelectItem value="Híbrido">Híbrido</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label>Fases *</Label><Select value={form.fases} onValueChange={(v) => set("fases", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Monofásico">Monofásico</SelectItem><SelectItem value="Trifásico">Trifásico</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label>MPPTs</Label><Input type="number" value={form.mppt_count} onChange={(e) => set("mppt_count", e.target.value)} placeholder="2" /></div>
          <div className="space-y-1"><Label>Strings por MPPT</Label><Input type="number" value={form.strings_por_mppt} onChange={(e) => set("strings_por_mppt", e.target.value)} placeholder="1" /></div>
          <div className="space-y-1"><Label>Tensão Entrada Máx (V)</Label><Input type="number" value={form.tensao_entrada_max_v} onChange={(e) => set("tensao_entrada_max_v", e.target.value)} placeholder="1100" /></div>
          <div className="space-y-1"><Label>Corrente Entrada Máx (A)</Label><Input type="number" step="0.1" value={form.corrente_entrada_max_a} onChange={(e) => set("corrente_entrada_max_a", e.target.value)} /></div>
          <div className="space-y-1"><Label>Tensão Saída (V)</Label><Input type="number" value={form.tensao_saida_v} onChange={(e) => set("tensao_saida_v", e.target.value)} placeholder="220" /></div>
          <div className="space-y-1"><Label>Corrente de Saída (A)</Label><Input type="number" step="0.1" value={form.corrente_saida_a} onChange={(e) => set("corrente_saida_a", e.target.value)} /></div>
          <div className="space-y-1"><Label>Tensão MPPT mín (V)</Label><Input type="number" value={form.tensao_mppt_min_v} onChange={(e) => set("tensao_mppt_min_v", e.target.value)} /></div>
          <div className="space-y-1"><Label>Tensão MPPT máx (V)</Label><Input type="number" value={form.tensao_mppt_max_v} onChange={(e) => set("tensao_mppt_max_v", e.target.value)} /></div>
          <div className="space-y-1"><Label>Potência Máxima (kW)</Label><Input type="number" step="0.01" value={form.potencia_maxima_kw} onChange={(e) => set("potencia_maxima_kw", e.target.value)} /></div>
          <div className="space-y-1"><Label>Fator de Potência</Label><Input type="number" step="0.01" value={form.fator_potencia} onChange={(e) => set("fator_potencia", e.target.value)} placeholder="1.0" /></div>
          <div className="space-y-1"><Label>Eficiência Máx (%)</Label><Input type="number" step="0.01" value={form.eficiencia_max_percent} onChange={(e) => set("eficiencia_max_percent", e.target.value)} placeholder="98.40" /></div>
          <div className="space-y-1"><Label>Garantia (anos)</Label><Input type="number" value={form.garantia_anos} onChange={(e) => set("garantia_anos", e.target.value)} placeholder="5" /></div>
          <div className="space-y-1"><Label>Peso (kg)</Label><Input type="number" step="0.1" value={form.peso_kg} onChange={(e) => set("peso_kg", e.target.value)} /></div>
          <div className="space-y-1"><Label>Proteção IP</Label><Input value={form.ip_protection as string} onChange={(e) => set("ip_protection", e.target.value)} placeholder="IP65" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>URL do Datasheet</Label><Input value={form.datasheet_url} onChange={(e) => set("datasheet_url", e.target.value)} placeholder="https://..." /></div>
          <div className="space-y-1"><Label>Status</Label><Select value={form.status} onValueChange={(v) => set("status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rascunho">Rascunho</SelectItem><SelectItem value="revisao">Em revisão</SelectItem><SelectItem value="publicado">Publicado</SelectItem></SelectContent></Select></div>
        </FormGrid>
      </FormModalTemplate>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir Inversor</AlertDialogTitle><AlertDialogDescription>Excluir "{deleting?.fabricante} {deleting?.modelo}"?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleting && deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InversorImportDialog open={distImportOpen} onOpenChange={setDistImportOpen} existingInversores={inversores} />
      <BatchEnrichDialog open={batchEnrichOpen} onOpenChange={setBatchEnrichOpen} equipmentType="inversor" draftIds={inversores.filter(i => i.status === "rascunho").map(i => i.id)} />
      <InversorCompareModal inversores={compareInversores} open={compareOpen} onOpenChange={(v) => { setCompareOpen(v); if (!v) setCompareIds(new Set()); }} />
      <InversorViewModal inversor={viewItem} open={!!viewItem} onOpenChange={v => !v && setViewItem(null)} />
    </div>
  );
}
