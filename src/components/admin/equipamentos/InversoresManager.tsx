import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Search, Cpu, Globe, Building2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { LoadingState } from "@/components/ui-kit/LoadingState";

interface Inversor {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_nominal_kw: number;
  tipo: string;
  tensao_entrada_max_v: number | null;
  corrente_entrada_max_a: number | null;
  mppt_count: number | null;
  strings_por_mppt: number | null;
  fases: string;
  tensao_saida_v: number | null;
  eficiencia_max_percent: number | null;
  garantia_anos: number | null;
  peso_kg: number | null;
  dimensoes_mm: string | null;
  wifi_integrado: boolean | null;
  ip_protection: string | null;
  ativo: boolean;
  tenant_id: string | null;
}

const EMPTY_FORM = {
  fabricante: "", modelo: "", potencia_nominal_kw: "", tipo: "String",
  tensao_entrada_max_v: "", corrente_entrada_max_a: "",
  mppt_count: "2", strings_por_mppt: "1", fases: "Monofásico",
  tensao_saida_v: "220", eficiencia_max_percent: "",
  garantia_anos: "5", peso_kg: "", dimensoes_mm: "",
  wifi_integrado: true, ip_protection: "IP65",
};

export function InversoresManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState("all");
  const [filterFabricante, setFilterFabricante] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Inversor | null>(null);
  const [deleting, setDeleting] = useState<Inversor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: inversores = [], isLoading } = useQuery({
    queryKey: ["inversores-catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inversores_catalogo")
        .select("id, tenant_id, fabricante, modelo, potencia_nominal_kw, tipo, fases, mppt_count, strings_por_mppt, tensao_entrada_max_v, tensao_saida_v, corrente_entrada_max_a, eficiencia_max_percent, peso_kg, dimensoes_mm, garantia_anos, ip_protection, wifi_integrado, ativo, created_at, updated_at")
        .order("fabricante")
        .order("potencia_nominal_kw");
      if (error) throw error;
      return data as Inversor[];
    },
  });

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

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editing) {
        const { error } = await supabase.from("inversores_catalogo").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inversores_catalogo").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inversores-catalogo"] });
      toast({ title: editing ? "Inversor atualizado" : "Inversor cadastrado" });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inversores_catalogo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inversores-catalogo"] });
      toast({ title: "Inversor excluído" });
      setDeleting(null);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("inversores_catalogo").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inversores-catalogo"] }),
  });

  const openDialog = (inv?: Inversor) => {
    if (inv) {
      setEditing(inv);
      setForm({
        fabricante: inv.fabricante, modelo: inv.modelo,
        potencia_nominal_kw: String(inv.potencia_nominal_kw),
        tipo: inv.tipo,
        tensao_entrada_max_v: inv.tensao_entrada_max_v ? String(inv.tensao_entrada_max_v) : "",
        corrente_entrada_max_a: inv.corrente_entrada_max_a ? String(inv.corrente_entrada_max_a) : "",
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
      fabricante: form.fabricante.trim(),
      modelo: form.modelo.trim(),
      potencia_nominal_kw: parseFloat(form.potencia_nominal_kw),
      tipo: form.tipo,
      tensao_entrada_max_v: form.tensao_entrada_max_v ? parseInt(form.tensao_entrada_max_v) : null,
      corrente_entrada_max_a: form.corrente_entrada_max_a ? parseFloat(form.corrente_entrada_max_a) : null,
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
    });
  };

  const set = (key: string, val: string | boolean) => setForm((p) => ({ ...p, [key]: val }));

  const formatPotencia = (kw: number) => kw < 1 ? `${(kw * 1000).toFixed(0)} W` : `${kw} kW`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5" /> Inversores
          </CardTitle>
          <CardDescription className="mt-1">
            {inversores.length} inversores cadastrados ({fabricantes.length} fabricantes).
            Registros globais são compartilhados — adicione customizados para sua empresa.
          </CardDescription>
        </div>
        <Button onClick={() => openDialog()} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Inversor
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fabricante</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Potência</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fases</TableHead>
                <TableHead>MPPTs</TableHead>
                <TableHead>Eficiência</TableHead>
                <TableHead>Garantia</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={11} className="py-8"><LoadingState message="Carregando inversores..." /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  Nenhum inversor encontrado.
                </TableCell></TableRow>
              ) : filtered.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.fabricante}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{inv.modelo}</TableCell>
                  <TableCell><Badge variant="outline">{formatPotencia(inv.potencia_nominal_kw)}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{inv.tipo}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{inv.fases}</TableCell>
                  <TableCell>{inv.mppt_count || "—"}</TableCell>
                  <TableCell>{inv.eficiencia_max_percent ? `${inv.eficiencia_max_percent}%` : "—"}</TableCell>
                  <TableCell className="text-xs">{inv.garantia_anos ? `${inv.garantia_anos}a` : "—"}</TableCell>
                  <TableCell>
                    {isGlobal(inv) ? (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Globe className="w-3 h-3" /> Global
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-1 text-xs">
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

        {/* Dialog */}
        <FormModalTemplate
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={editing ? "Editar Inversor" : "Novo Inversor"}
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
              <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
                onClick={() => deleting && deleteMutation.mutate(deleting.id)}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
