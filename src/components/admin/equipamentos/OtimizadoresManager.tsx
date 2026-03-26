import { useState, useMemo } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import { Plus, Pencil, Trash2, Search, Zap, Globe, Building2, FileSpreadsheet, Wand2, X, GitCompareArrows, Package, CheckCircle2, FileWarning, Sparkles, LayoutGrid, Table as TableIcon } from "lucide-react";
import { EnrichButton } from "./shared/EnrichButton";
import { BatchEnrichDialog } from "./shared/BatchEnrichDialog";
import { useToast } from "@/hooks/use-toast";
import { OtimizadorImportDialog } from "./otimizadores/OtimizadorImportDialog";
import { OtimizadorTableView } from "./otimizadores/OtimizadorTableView";
import { OtimizadorCompareModal } from "./otimizadores/OtimizadorCompareModal";
import {
  useOtimizadoresCatalogo, useSalvarOtimizador, useDeletarOtimizador, useToggleOtimizador, type Otimizador,
} from "@/hooks/useOtimizadoresCatalogo";
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
import { calcCompletudeOtimizador } from "@/utils/calcCompletudeOtimizador";

type ViewMode = "cards" | "table";

const EMPTY_FORM = {
  fabricante: "", modelo: "", potencia_wp: "",
  tensao_entrada_max_v: "", corrente_entrada_max_a: "",
  tensao_saida_v: "", corrente_saida_max_a: "",
  eficiencia_percent: "", compatibilidade: "",
  ip_protection: "IP65", dimensoes_mm: "", peso_kg: "",
  garantia_anos: "25", datasheet_url: "", status: "rascunho",
};

export function OtimizadoresManager() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState("all");
  const [filterFabricante, setFilterFabricante] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPotMin, setFilterPotMin] = useState("");
  const [filterPotMax, setFilterPotMax] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [distImportOpen, setDistImportOpen] = useState(false);
  const [batchEnrichOpen, setBatchEnrichOpen] = useState(false);
  const [editing, setEditing] = useState<Otimizador | null>(null);
  const [deleting, setDeleting] = useState<Otimizador | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  const { data: otimizadores = [], isLoading } = useOtimizadoresCatalogo();
  const saveMutation = useSalvarOtimizador();
  const deleteMutation = useDeletarOtimizador();
  const toggleMutation = useToggleOtimizador();

  const fabricantes = useMemo(() => {
    const set = new Set(otimizadores.map((o) => o.fabricante));
    return Array.from(set).sort();
  }, [otimizadores]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (search) c++; if (filterAtivo !== "all") c++; if (filterFabricante !== "all") c++;
    if (filterStatus !== "all") c++; if (filterPotMin) c++; if (filterPotMax) c++;
    return c;
  }, [search, filterAtivo, filterFabricante, filterStatus, filterPotMin, filterPotMax]);

  const clearFilters = () => {
    setSearch(""); setFilterAtivo("all"); setFilterFabricante("all");
    setFilterStatus("all"); setFilterPotMin(""); setFilterPotMax("");
  };

  const filtered = useMemo(() => otimizadores.filter((o) => {
    const matchSearch = !search || `${o.fabricante} ${o.modelo}`.toLowerCase().includes(search.toLowerCase());
    const matchAtivo = filterAtivo === "all" || (filterAtivo === "ativo" ? o.ativo : !o.ativo);
    const matchFab = filterFabricante === "all" || o.fabricante === filterFabricante;
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    const potMin = filterPotMin ? parseInt(filterPotMin) : null;
    const potMax = filterPotMax ? parseInt(filterPotMax) : null;
    const matchPotMin = potMin == null || (o.potencia_wp ?? 0) >= potMin;
    const matchPotMax = potMax == null || (o.potencia_wp ?? Infinity) <= potMax;
    return matchSearch && matchAtivo && matchFab && matchStatus && matchPotMin && matchPotMax;
  }), [otimizadores, search, filterAtivo, filterFabricante, filterStatus, filterPotMin, filterPotMax]);

  const kpis = useMemo(() => {
    const total = otimizadores.length;
    const publicados = otimizadores.filter(o => o.status === "publicado").length;
    const rascunhos = otimizadores.filter(o => o.status === "rascunho").length;
    const completos = otimizadores.filter(o => calcCompletudeOtimizador(o) >= 80).length;
    return { total, publicados, rascunhos, completos };
  }, [otimizadores]);

  const isGlobal = (o: Otimizador) => o.tenant_id === null;

  const openDialog = (ot?: Otimizador) => {
    if (ot) {
      setEditing(ot);
      setForm({
        fabricante: ot.fabricante, modelo: ot.modelo,
        potencia_wp: ot.potencia_wp ? String(ot.potencia_wp) : "",
        tensao_entrada_max_v: ot.tensao_entrada_max_v ? String(ot.tensao_entrada_max_v) : "",
        corrente_entrada_max_a: ot.corrente_entrada_max_a ? String(ot.corrente_entrada_max_a) : "",
        tensao_saida_v: ot.tensao_saida_v ? String(ot.tensao_saida_v) : "",
        corrente_saida_max_a: ot.corrente_saida_max_a ? String(ot.corrente_saida_max_a) : "",
        eficiencia_percent: ot.eficiencia_percent ? String(ot.eficiencia_percent) : "",
        compatibilidade: ot.compatibilidade || "",
        ip_protection: ot.ip_protection || "IP65",
        dimensoes_mm: ot.dimensoes_mm || "",
        peso_kg: ot.peso_kg ? String(ot.peso_kg) : "",
        garantia_anos: ot.garantia_anos ? String(ot.garantia_anos) : "25",
        datasheet_url: ot.datasheet_url || "",
        status: ot.status || "rascunho",
      });
    } else { setEditing(null); setForm(EMPTY_FORM); }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.fabricante.trim() || !form.modelo.trim()) {
      toast({ title: "Preencha fabricante e modelo", variant: "destructive" }); return;
    }
    saveMutation.mutate({
      id: editing?.id,
      data: {
        fabricante: form.fabricante.trim(), modelo: form.modelo.trim(),
        potencia_wp: form.potencia_wp ? parseInt(form.potencia_wp) : null,
        tensao_entrada_max_v: form.tensao_entrada_max_v ? parseInt(form.tensao_entrada_max_v) : null,
        corrente_entrada_max_a: form.corrente_entrada_max_a ? parseFloat(form.corrente_entrada_max_a) : null,
        tensao_saida_v: form.tensao_saida_v ? parseInt(form.tensao_saida_v) : null,
        corrente_saida_max_a: form.corrente_saida_max_a ? parseFloat(form.corrente_saida_max_a) : null,
        eficiencia_percent: form.eficiencia_percent ? parseFloat(form.eficiencia_percent) : null,
        compatibilidade: form.compatibilidade || null,
        ip_protection: form.ip_protection || null,
        dimensoes_mm: form.dimensoes_mm || null,
        peso_kg: form.peso_kg ? parseFloat(form.peso_kg) : null,
        garantia_anos: form.garantia_anos ? parseInt(form.garantia_anos) : null,
        datasheet_url: form.datasheet_url || null,
        status: form.status,
      },
    }, {
      onSuccess: () => { toast({ title: editing ? "Otimizador atualizado" : "Otimizador cadastrado" }); setDialogOpen(false); },
      onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  };

  const set = (key: string, val: string | boolean) => setForm((p) => ({ ...p, [key]: val }));

  const toggleCompare = (id: string, checked: boolean) => {
    const next = new Set(compareIds);
    if (checked && next.size < 3) next.add(id); else next.delete(id);
    setCompareIds(next);
  };

  const compareOtimizadores = useMemo(() => otimizadores.filter(o => compareIds.has(o.id)), [otimizadores, compareIds]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Zap}
        title="Otimizadores"
        description={`${otimizadores.length} otimizadores cadastrados (${fabricantes.length} fabricantes)`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {activeFilterCount > 0 && <Badge variant="secondary" className="gap-1">{activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""}</Badge>}
            <Button variant="outline" size="sm" onClick={() => setBatchEnrichOpen(true)} className="gap-2"><Wand2 className="w-4 h-4" /> Buscar specs IA</Button>
            <Button variant="outline" size="sm" onClick={() => setDistImportOpen(true)} className="gap-2"><FileSpreadsheet className="w-4 h-4" /> CSV Distribuidora</Button>
            <Button size="sm" onClick={() => openDialog()} className="gap-2"><Plus className="w-4 h-4" /> Novo Otimizador</Button>
          </div>
        }
      />

      {/* KPIs */}
      {!isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-l-[3px] border-l-primary"><CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0"><Package className="w-4 h-4" /></div>
            <div><p className="text-xl font-bold text-foreground leading-none">{kpis.total}</p><p className="text-xs text-muted-foreground mt-1">Total otimizadores</p></div>
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
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos status</SelectItem><SelectItem value="rascunho">Rascunho</SelectItem><SelectItem value="revisao">Revisão</SelectItem><SelectItem value="publicado">Publicado</SelectItem></SelectContent>
            </Select>
            <Select value={filterAtivo} onValueChange={setFilterAtivo}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="ativo">Ativos</SelectItem><SelectItem value="inativo">Inativos</SelectItem></SelectContent>
            </Select>
            <Input type="number" placeholder="Min W" className="w-24 h-9" value={filterPotMin} onChange={(e) => setFilterPotMin(e.target.value)} />
            <Input type="number" placeholder="Max W" className="w-24 h-9" value={filterPotMax} onChange={(e) => setFilterPotMax(e.target.value)} />
            {activeFilterCount > 0 && <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={clearFilters}><X className="w-3 h-3" /> Limpar filtros</Button>}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3"><Zap className="w-6 h-6" /></div>
            <p className="font-medium text-foreground">Nenhum otimizador encontrado</p>
            <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre um novo otimizador.</p>
            <Button size="sm" onClick={() => openDialog()} className="mt-4 gap-2"><Plus className="w-4 h-4" /> Novo Otimizador</Button>
          </div>
        ) : viewMode === "cards" ? (
          <VirtuosoGrid
            style={{ height: "calc(100vh - 320px)" }}
            totalCount={filtered.length}
            itemContent={(index) => {
              const ot = filtered[index];
              const comp = calcCompletudeOtimizador(ot);
              const statusColor = ot.status === "publicado" ? "bg-success/10 text-success border-success/20" : ot.status === "revisao" ? "bg-info/10 text-info border-info/20" : "bg-warning/10 text-warning border-warning/20";
              const statusLabel = ot.status === "publicado" ? "Publicado" : ot.status === "revisao" ? "Revisão" : "Rascunho";
              return (
                <Card key={ot.id} className="group relative border border-border hover:border-primary/30 hover:shadow-sm transition-all">
                  <div className="absolute top-3 right-3 flex gap-1 z-10">
                    <EnrichButton equipmentType="otimizador" equipmentId={ot.id} />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(ot)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                  </div>
                  {compareIds.size < 3 && (
                    <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Checkbox checked={compareIds.has(ot.id)} onCheckedChange={(v) => toggleCompare(ot.id, !!v)} />
                    </div>
                  )}
                  <CardContent className="pt-4 pb-3 px-4 space-y-3">
                    <div className="pr-16">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-muted-foreground">{ot.fabricante}</p>
                        {isGlobal(ot) ? <Globe className="w-3 h-3 text-muted-foreground" /> : <Building2 className="w-3 h-3 text-primary" />}
                      </div>
                      <p className="font-semibold text-sm truncate" title={ot.modelo}>{ot.modelo}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {ot.potencia_wp && <Badge variant="outline" className="gap-1 font-mono text-xs bg-primary/10 text-primary border-primary/20"><Zap className="w-3 h-3" />{ot.potencia_wp} W</Badge>}
                      {ot.eficiencia_percent && <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">{ot.eficiencia_percent}%</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {ot.compatibilidade && <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">{ot.compatibilidade}</Badge>}
                      <Badge className={`text-xs ${statusColor}`}>{statusLabel}</Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Completude</span>
                        <span className={`text-xs font-medium ${comp >= 80 ? "text-success" : comp >= 60 ? "text-warning" : "text-destructive"}`}>{comp}%</span>
                      </div>
                      <Progress value={comp} className="h-1.5" />
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <span className="text-xs text-muted-foreground">{ot.ativo ? "Ativo" : "Inativo"}</span>
                      <Switch checked={ot.ativo} onCheckedChange={(v) => toggleMutation.mutate({ id: ot.id, ativo: v })} className="scale-90" />
                    </div>
                  </CardContent>
                </Card>
              );
            }}
            listClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-1"
          />
        ) : (
          <OtimizadorTableView otimizadores={filtered} onEdit={(o) => openDialog(o)} onDelete={(o) => setDeleting(o)} onToggle={(id, v) => toggleMutation.mutate({ id, ativo: v })} />
        )}

        {!isLoading && filtered.length > 0 && <p className="text-xs text-muted-foreground text-right">{filtered.length} de {otimizadores.length} otimizadores</p>}
      </div>

      {compareIds.size >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <Button size="lg" className="gap-2 shadow-lg" onClick={() => setCompareOpen(true)}><GitCompareArrows className="w-4 h-4" /> Comparar ({compareIds.size})</Button>
        </div>
      )}

      <FormModalTemplate open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? "Editar Otimizador" : "Novo Otimizador"} icon={Zap} subtitle="Cadastre ou edite um otimizador" onSubmit={handleSave} submitLabel={editing ? "Salvar" : "Cadastrar"} saving={saveMutation.isPending} className="max-w-2xl">
        <FormGrid>
          <div className="space-y-1 sm:col-span-2"><Label>Fabricante *</Label><Input value={form.fabricante} onChange={(e) => set("fabricante", e.target.value)} placeholder="Ex: SolarEdge" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Modelo *</Label><Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} placeholder="Ex: P370" /></div>
          <div className="space-y-1"><Label>Potência (Wp)</Label><Input type="number" value={form.potencia_wp} onChange={(e) => set("potencia_wp", e.target.value)} placeholder="370" /></div>
          <div className="space-y-1"><Label>Tensão Entrada Máx (V)</Label><Input type="number" value={form.tensao_entrada_max_v} onChange={(e) => set("tensao_entrada_max_v", e.target.value)} placeholder="60" /></div>
          <div className="space-y-1"><Label>Corrente Entrada Máx (A)</Label><Input type="number" step="0.1" value={form.corrente_entrada_max_a} onChange={(e) => set("corrente_entrada_max_a", e.target.value)} placeholder="11" /></div>
          <div className="space-y-1"><Label>Tensão Saída (V)</Label><Input type="number" value={form.tensao_saida_v} onChange={(e) => set("tensao_saida_v", e.target.value)} placeholder="60" /></div>
          <div className="space-y-1"><Label>Corrente Saída Máx (A)</Label><Input type="number" step="0.1" value={form.corrente_saida_max_a} onChange={(e) => set("corrente_saida_max_a", e.target.value)} placeholder="15" /></div>
          <div className="space-y-1"><Label>Eficiência (%)</Label><Input type="number" step="0.01" value={form.eficiencia_percent} onChange={(e) => set("eficiencia_percent", e.target.value)} placeholder="99.50" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Compatibilidade</Label><Input value={form.compatibilidade} onChange={(e) => set("compatibilidade", e.target.value)} placeholder="Ex: SolarEdge, Huawei" /></div>
          <div className="space-y-1"><Label>Proteção IP</Label><Input value={form.ip_protection} onChange={(e) => set("ip_protection", e.target.value)} placeholder="IP65" /></div>
          <div className="space-y-1"><Label>Dimensões (mm)</Label><Input value={form.dimensoes_mm} onChange={(e) => set("dimensoes_mm", e.target.value)} placeholder="130x130x32" /></div>
          <div className="space-y-1"><Label>Peso (kg)</Label><Input type="number" step="0.1" value={form.peso_kg} onChange={(e) => set("peso_kg", e.target.value)} placeholder="1.2" /></div>
          <div className="space-y-1"><Label>Garantia (anos)</Label><Input type="number" value={form.garantia_anos} onChange={(e) => set("garantia_anos", e.target.value)} placeholder="25" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>URL do Datasheet</Label><Input value={form.datasheet_url} onChange={(e) => set("datasheet_url", e.target.value)} placeholder="https://..." /></div>
          <div className="space-y-1"><Label>Status</Label><Select value={form.status} onValueChange={(v) => set("status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rascunho">Rascunho</SelectItem><SelectItem value="revisao">Em revisão</SelectItem><SelectItem value="publicado">Publicado</SelectItem></SelectContent></Select></div>
        </FormGrid>
      </FormModalTemplate>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir Otimizador</AlertDialogTitle><AlertDialogDescription>Excluir "{deleting?.fabricante} {deleting?.modelo}"?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleting && deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OtimizadorImportDialog open={distImportOpen} onOpenChange={setDistImportOpen} existingOtimizadores={otimizadores} />
      <BatchEnrichDialog open={batchEnrichOpen} onOpenChange={setBatchEnrichOpen} equipmentType="otimizador" draftIds={otimizadores.filter(o => o.status === "rascunho").map(o => o.id)} />
      <OtimizadorCompareModal otimizadores={compareOtimizadores} open={compareOpen} onOpenChange={(v) => { setCompareOpen(v); if (!v) setCompareIds(new Set()); }} />
    </div>
  );
}
