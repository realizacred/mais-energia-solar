import { useState, useMemo } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import { Plus, Pencil, Trash2, Search, Battery, Eye, X, Package, CheckCircle2, Sparkles, LayoutGrid, Table as TableIcon, Zap, Wand2, FileWarning, GitCompareArrows } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EnrichButton } from "./shared/EnrichButton";
import { BatchEnrichDialog } from "./shared/BatchEnrichDialog";
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
import { FormModalTemplate, FormSection } from "@/components/ui-kit/FormModalTemplate";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BateriaViewModal } from "./baterias/BateriaViewModal";
import { BateriaTableView } from "./baterias/BateriaTableView";
import { BateriaCompareModal } from "./baterias/BateriaCompareModal";
import { calcCompletudeBateria } from "@/utils/calcCompletudeBateria";

type ViewMode = "cards" | "table";

interface Bateria {
  id: string;
  fabricante: string;
  modelo: string;
  tipo_bateria: string | null;
  energia_kwh: number | null;
  dimensoes_mm: string | null;
  tensao_operacao_v: string | null;
  tensao_carga_v: number | null;
  tensao_nominal_v: number | null;
  potencia_max_saida_kw: number | null;
  corrente_max_descarga_a: number | null;
  corrente_max_carga_a: number | null;
  correntes_recomendadas_a: string | null;
  ativo: boolean;
  tenant_id?: string | null;
}

const EMPTY_FORM = {
  fabricante: "", modelo: "", tipo_bateria: "", energia_kwh: "", dimensoes_mm: "",
  tensao_operacao_v: "", tensao_carga_v: "", tensao_nominal_v: "",
  potencia_max_saida_kw: "", corrente_max_descarga_a: "", corrente_max_carga_a: "",
  correntes_recomendadas_a: "",
};

export function BateriasManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState("all");
  const [filterFabricante, setFilterFabricante] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterCapMin, setFilterCapMin] = useState("");
  const [filterCapMax, setFilterCapMax] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Bateria | null>(null);
  const [deleting, setDeleting] = useState<Bateria | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [viewItem, setViewItem] = useState<Bateria | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [batchEnrichOpen, setBatchEnrichOpen] = useState(false);

  const { data: baterias = [], isLoading } = useQuery({
    queryKey: ["baterias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("baterias")
        .select("id, tenant_id, fabricante, modelo, tipo_bateria, energia_kwh, tensao_nominal_v, tensao_carga_v, tensao_operacao_v, corrente_max_carga_a, corrente_max_descarga_a, correntes_recomendadas_a, potencia_max_saida_kw, dimensoes_mm, ativo, created_at, updated_at")
        .order("fabricante")
        .order("modelo");
      if (error) throw error;
      return data as Bateria[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editing) {
        const { error } = await supabase.from("baterias").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("baterias").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["baterias"] });
      toast({ title: editing ? "Bateria atualizada" : "Bateria cadastrada" });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("baterias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["baterias"] });
      toast({ title: "Bateria excluída" });
      setDeleting(null);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("baterias").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["baterias"] }),
  });

  const fabricantes = useMemo(() => {
    const set = new Set(baterias.map(b => b.fabricante));
    return Array.from(set).sort();
  }, [baterias]);

  const tipos = useMemo(() => {
    const set = new Set(baterias.map(b => b.tipo_bateria).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [baterias]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (search) c++;
    if (filterAtivo !== "all") c++;
    if (filterFabricante !== "all") c++;
    if (filterTipo !== "all") c++;
    if (filterCapMin) c++;
    if (filterCapMax) c++;
    return c;
  }, [search, filterAtivo, filterFabricante, filterTipo, filterCapMin, filterCapMax]);

  const clearFilters = () => {
    setSearch(""); setFilterAtivo("all"); setFilterFabricante("all");
    setFilterTipo("all"); setFilterCapMin(""); setFilterCapMax("");
  };

  const filtered = useMemo(() => baterias.filter((b) => {
    const matchSearch = !search || `${b.fabricante} ${b.modelo} ${b.tipo_bateria || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchAtivo = filterAtivo === "all" || (filterAtivo === "ativo" ? b.ativo : !b.ativo);
    const matchFab = filterFabricante === "all" || b.fabricante === filterFabricante;
    const matchTipo = filterTipo === "all" || b.tipo_bateria === filterTipo;
    const capMin = filterCapMin ? parseFloat(filterCapMin) : null;
    const capMax = filterCapMax ? parseFloat(filterCapMax) : null;
    const matchCapMin = capMin == null || (b.energia_kwh != null && b.energia_kwh >= capMin);
    const matchCapMax = capMax == null || (b.energia_kwh != null && b.energia_kwh <= capMax);
    return matchSearch && matchAtivo && matchFab && matchTipo && matchCapMin && matchCapMax;
  }), [baterias, search, filterAtivo, filterFabricante, filterTipo, filterCapMin, filterCapMax]);

  const kpis = useMemo(() => {
    const total = baterias.length;
    const ativos = baterias.filter(b => b.ativo).length;
    const inativos = total - ativos;
    const completos = baterias.filter(b => calcCompletudeBateria(b) >= 80).length;
    return { total, ativos, inativos, completos };
  }, [baterias]);

  const openDialog = (b?: Bateria) => {
    if (b) {
      setEditing(b);
      setForm({
        fabricante: b.fabricante, modelo: b.modelo,
        tipo_bateria: b.tipo_bateria || "", energia_kwh: b.energia_kwh ? String(b.energia_kwh) : "",
        dimensoes_mm: b.dimensoes_mm || "", tensao_operacao_v: b.tensao_operacao_v || "",
        tensao_carga_v: b.tensao_carga_v != null ? String(b.tensao_carga_v) : "",
        tensao_nominal_v: b.tensao_nominal_v ? String(b.tensao_nominal_v) : "",
        potencia_max_saida_kw: b.potencia_max_saida_kw != null ? String(b.potencia_max_saida_kw) : "",
        corrente_max_descarga_a: b.corrente_max_descarga_a ? String(b.corrente_max_descarga_a) : "",
        corrente_max_carga_a: b.corrente_max_carga_a ? String(b.corrente_max_carga_a) : "",
        correntes_recomendadas_a: b.correntes_recomendadas_a || "",
      });
    } else {
      setEditing(null);
      setForm(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.fabricante.trim() || !form.modelo.trim()) {
      toast({ title: "Preencha fabricante e modelo", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      fabricante: form.fabricante.trim(),
      modelo: form.modelo.trim(),
      tipo_bateria: form.tipo_bateria || null,
      energia_kwh: form.energia_kwh ? parseFloat(form.energia_kwh) : null,
      dimensoes_mm: form.dimensoes_mm || null,
      tensao_operacao_v: form.tensao_operacao_v || null,
      tensao_carga_v: form.tensao_carga_v !== "" ? parseFloat(form.tensao_carga_v) : null,
      tensao_nominal_v: form.tensao_nominal_v ? parseFloat(form.tensao_nominal_v) : null,
      potencia_max_saida_kw: form.potencia_max_saida_kw !== "" ? parseFloat(form.potencia_max_saida_kw) : null,
      corrente_max_descarga_a: form.corrente_max_descarga_a ? parseFloat(form.corrente_max_descarga_a) : null,
      corrente_max_carga_a: form.corrente_max_carga_a ? parseFloat(form.corrente_max_carga_a) : null,
      correntes_recomendadas_a: form.correntes_recomendadas_a || null,
    });
  };

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const toggleCompare = (id: string, checked: boolean) => {
    const next = new Set(compareIds);
    if (checked && next.size < 3) next.add(id); else next.delete(id);
    setCompareIds(next);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Battery}
        title="Baterias"
        description={`${baterias.length} baterias cadastradas (${fabricantes.length} fabricantes)`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {activeFilterCount > 0 && <Badge variant="secondary" className="gap-1">{activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""}</Badge>}
            <Button size="sm" onClick={() => openDialog()} className="gap-2"><Plus className="w-4 h-4" /> Nova Bateria</Button>
          </div>
        }
      />

      {/* KPIs */}
      {!isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-l-[3px] border-l-primary"><CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0"><Package className="w-4 h-4" /></div>
            <div><p className="text-xl font-bold text-foreground leading-none">{kpis.total}</p><p className="text-xs text-muted-foreground mt-1">Total baterias</p></div>
          </CardContent></Card>
          <Card className="border-l-[3px] border-l-success"><CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0"><CheckCircle2 className="w-4 h-4" /></div>
            <div><p className="text-xl font-bold text-foreground leading-none">{kpis.ativos}<span className="text-xs font-normal text-muted-foreground ml-1">({kpis.total ? Math.round((kpis.ativos / kpis.total) * 100) : 0}%)</span></p><p className="text-xs text-muted-foreground mt-1">Ativas</p></div>
          </CardContent></Card>
          <Card className="border-l-[3px] border-l-warning"><CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0"><Battery className="w-4 h-4" /></div>
            <div><p className="text-xl font-bold text-foreground leading-none">{kpis.inativos}<span className="text-xs font-normal text-muted-foreground ml-1">({kpis.total ? Math.round((kpis.inativos / kpis.total) * 100) : 0}%)</span></p><p className="text-xs text-muted-foreground mt-1">Inativas</p></div>
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
              <SelectContent><SelectItem value="all">Todos os tipos</SelectItem>{tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterAtivo} onValueChange={setFilterAtivo}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="ativo">Ativos</SelectItem><SelectItem value="inativo">Inativos</SelectItem></SelectContent>
            </Select>
            <Input type="number" placeholder="Min kWh" className="w-24 h-9" value={filterCapMin} onChange={(e) => setFilterCapMin(e.target.value)} />
            <Input type="number" placeholder="Max kWh" className="w-24 h-9" value={filterCapMax} onChange={(e) => setFilterCapMax(e.target.value)} />
            {activeFilterCount > 0 && <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={clearFilters}><X className="w-3 h-3" /> Limpar filtros</Button>}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3"><Battery className="w-6 h-6" /></div>
            <p className="font-medium text-foreground">Nenhuma bateria encontrada</p>
            <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre uma nova bateria.</p>
            <Button size="sm" onClick={() => openDialog()} className="mt-4 gap-2"><Plus className="w-4 h-4" /> Nova Bateria</Button>
          </div>
        ) : viewMode === "cards" ? (
          <VirtuosoGrid
            style={{ height: "calc(100vh - 320px)" }}
            totalCount={filtered.length}
            itemContent={(index) => {
              const bat = filtered[index];
              const comp = calcCompletudeBateria(bat);
              return (
                <Card key={bat.id} className={`group relative border border-border hover:border-primary/30 hover:shadow-sm transition-all ${!bat.ativo ? "opacity-50 grayscale" : ""}`}>
                  <div className="absolute top-3 right-3 flex gap-1 z-10">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(bat)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                  </div>
                  {compareIds.size < 3 && (
                    <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Checkbox checked={compareIds.has(bat.id)} onCheckedChange={(v) => toggleCompare(bat.id, !!v)} />
                    </div>
                  )}
                  <CardContent className="pt-4 pb-3 px-4 space-y-3">
                    <div className="pr-16">
                      <p className="text-xs text-muted-foreground">{bat.fabricante}</p>
                      <p className="font-semibold text-sm truncate" title={bat.modelo}>{bat.modelo}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {bat.energia_kwh && (
                        <Badge variant="outline" className="gap-1 font-mono text-xs bg-primary/10 text-primary border-primary/20"><Zap className="w-3 h-3" />{bat.energia_kwh} kWh</Badge>
                      )}
                      <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">{bat.tipo_bateria || "—"}</Badge>
                      {bat.tensao_nominal_v && <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">{bat.tensao_nominal_v} V</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {!bat.ativo && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Completude</span>
                        <span className={`text-xs font-medium ${comp >= 80 ? "text-success" : comp >= 60 ? "text-warning" : "text-destructive"}`}>{comp}%</span>
                      </div>
                      <Progress value={comp} className="h-1.5" />
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <span className="text-xs text-muted-foreground">{bat.ativo ? "Ativo" : "Inativo"}</span>
                      <Switch checked={bat.ativo} onCheckedChange={(v) => toggleMutation.mutate({ id: bat.id, ativo: v })} className="scale-90" />
                    </div>
                  </CardContent>
                </Card>
              );
            }}
            listClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-1"
          />
        ) : (
          <BateriaTableView baterias={filtered} onView={(b) => setViewItem(b)} onEdit={(b) => openDialog(b)} onDelete={(b) => setDeleting(b)} onToggle={(id, v) => toggleMutation.mutate({ id, ativo: v })} />
        )}

        {!isLoading && filtered.length > 0 && <p className="text-xs text-muted-foreground text-right">{filtered.length} de {baterias.length} baterias</p>}
      </div>

      {/* Form Dialog */}
      <FormModalTemplate
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Editar Bateria" : "Nova Bateria"}
        icon={Battery}
        subtitle="Cadastre ou edite uma bateria"
        onSubmit={handleSave}
        submitLabel={editing ? "Salvar" : "Cadastrar"}
        saving={saveMutation.isPending}
        className="max-w-4xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-5">
            <FormSection title="Identificação">
              <div className="space-y-3">
                <div className="space-y-1"><Label>Fabricante *</Label><Input value={form.fabricante} onChange={(e) => set("fabricante", e.target.value)} placeholder="Ex: UNIPOWER" /></div>
                <div className="space-y-1"><Label>Modelo *</Label><Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} placeholder="Ex: UPLFP48-100 3U" /></div>
                <div className="space-y-1"><Label>Tipo Bateria</Label><Input value={form.tipo_bateria} onChange={(e) => set("tipo_bateria", e.target.value)} placeholder="Baterias de Íon-Lítio" /></div>
              </div>
            </FormSection>

            <FormSection title="Energia">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Energia (kWh)</Label><Input type="number" step="0.1" value={form.energia_kwh} onChange={(e) => set("energia_kwh", e.target.value)} placeholder="5" /></div>
                <div className="space-y-1"><Label>Tensão Nominal (V)</Label><Input type="number" value={form.tensao_nominal_v} onChange={(e) => set("tensao_nominal_v", e.target.value)} placeholder="48" /></div>
                <div className="space-y-1"><Label>Tensão Operação (V)</Label><Input value={form.tensao_operacao_v} onChange={(e) => set("tensao_operacao_v", e.target.value)} placeholder="42 ~ 54" /></div>
                <div className="space-y-1"><Label>Tensão Carga (V)</Label><Input type="number" step="0.1" value={form.tensao_carga_v} onChange={(e) => set("tensao_carga_v", e.target.value)} placeholder="0" /></div>
              </div>
            </FormSection>
          </div>

          <div className="space-y-5">
            <FormSection title="Potência & Correntes">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Potência Máx. Saída (kW)</Label><Input type="number" step="0.1" value={form.potencia_max_saida_kw} onChange={(e) => set("potencia_max_saida_kw", e.target.value)} placeholder="0" /></div>
                <div className="space-y-1"><Label>Corrente Máx. Descarga (A)</Label><Input type="number" value={form.corrente_max_descarga_a} onChange={(e) => set("corrente_max_descarga_a", e.target.value)} placeholder="100" /></div>
                <div className="space-y-1"><Label>Corrente Máx. Carga (A)</Label><Input type="number" value={form.corrente_max_carga_a} onChange={(e) => set("corrente_max_carga_a", e.target.value)} placeholder="100" /></div>
                <div className="space-y-1"><Label>Correntes Recomendadas (A)</Label><Input value={form.correntes_recomendadas_a} onChange={(e) => set("correntes_recomendadas_a", e.target.value)} placeholder="Opcional" /></div>
              </div>
            </FormSection>

            <FormSection title="Físico">
              <div className="space-y-1"><Label>Dimensões (mm)</Label><Input value={form.dimensoes_mm} onChange={(e) => set("dimensoes_mm", e.target.value)} placeholder="390x442x140mm" /></div>
            </FormSection>
          </div>
        </div>
      </FormModalTemplate>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Bateria</AlertDialogTitle>
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

      <BateriaViewModal bateria={viewItem} open={!!viewItem} onOpenChange={v => !v && setViewItem(null)} />
    </div>
  );
}
