import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Search, Zap, Globe, Building2, FileSpreadsheet, Wand2 } from "lucide-react";
import { EnrichButton } from "./shared/EnrichButton";
import { BatchEnrichDialog } from "./shared/BatchEnrichDialog";
import { useToast } from "@/hooks/use-toast";
import { OtimizadorImportDialog } from "./otimizadores/OtimizadorImportDialog";
import {
  useOtimizadoresCatalogo,
  useSalvarOtimizador,
  useDeletarOtimizador,
  useToggleOtimizador,
  type Otimizador,
} from "@/hooks/useOtimizadoresCatalogo";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [distImportOpen, setDistImportOpen] = useState(false);
  const [batchEnrichOpen, setBatchEnrichOpen] = useState(false);
  const [editing, setEditing] = useState<Otimizador | null>(null);
  const [deleting, setDeleting] = useState<Otimizador | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: otimizadores = [], isLoading } = useOtimizadoresCatalogo();
  const saveMutation = useSalvarOtimizador();
  const deleteMutation = useDeletarOtimizador();
  const toggleMutation = useToggleOtimizador();

  const fabricantes = useMemo(() => {
    const set = new Set(otimizadores.map((o) => o.fabricante));
    return Array.from(set).sort();
  }, [otimizadores]);

  const filtered = otimizadores.filter((o) => {
    const matchSearch = !search ||
      `${o.fabricante} ${o.modelo}`.toLowerCase().includes(search.toLowerCase());
    const matchAtivo = filterAtivo === "all" || (filterAtivo === "ativo" ? o.ativo : !o.ativo);
    const matchFab = filterFabricante === "all" || o.fabricante === filterFabricante;
    return matchSearch && matchAtivo && matchFab;
  });

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
      id: editing?.id,
      data: {
        fabricante: form.fabricante.trim(),
        modelo: form.modelo.trim(),
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
      onSuccess: () => {
        toast({ title: editing ? "Otimizador atualizado" : "Otimizador cadastrado" });
        setDialogOpen(false);
      },
      onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  };

  const set = (key: string, val: string | boolean) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Zap}
        title="Otimizadores"
        description={`${otimizadores.length} otimizadores cadastrados (${fabricantes.length} fabricantes)`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBatchEnrichOpen(true)} className="gap-2">
              <Wand2 className="w-4 h-4" /> Buscar specs IA
            </Button>
            <Button variant="outline" onClick={() => setDistImportOpen(true)} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" /> CSV Distribuidora
            </Button>
            <Button onClick={() => openDialog()} className="gap-2">
              <Plus className="w-4 h-4" /> Novo Otimizador
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
                <TableHead className="font-semibold text-foreground">Tensão Ent.</TableHead>
                <TableHead className="font-semibold text-foreground">Tensão Saída</TableHead>
                <TableHead className="font-semibold text-foreground">Eficiência</TableHead>
                <TableHead className="font-semibold text-foreground">Origem</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-16">
                    <div className="text-center text-muted-foreground">
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
                        <Zap className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-foreground">Nenhum otimizador encontrado</p>
                      <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre um novo otimizador.</p>
                      <Button size="sm" onClick={() => openDialog()} className="mt-4 gap-2">
                        <Plus className="w-4 h-4" /> Novo Otimizador
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.map((ot) => (
                <TableRow key={ot.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium text-foreground">{ot.fabricante}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{ot.modelo}</TableCell>
                  <TableCell>
                    {ot.potencia_wp ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {ot.potencia_wp} Wp
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{ot.tensao_entrada_max_v ? `${ot.tensao_entrada_max_v}V` : "—"}</TableCell>
                  <TableCell>{ot.tensao_saida_v ? `${ot.tensao_saida_v}V` : "—"}</TableCell>
                  <TableCell>
                    {ot.eficiencia_percent ? (
                      <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                        {ot.eficiencia_percent}%
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {isGlobal(ot) ? (
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
                      checked={ot.ativo}
                      disabled={isGlobal(ot)}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: ot.id, ativo: v })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {isGlobal(ot) ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <EnrichButton equipmentType="otimizador" equipmentId={ot.id} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(ot)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(ot)}>
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
            {filtered.length} de {otimizadores.length} otimizadores
          </p>
        )}

        <FormModalTemplate
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={editing ? "Editar Otimizador" : "Novo Otimizador"}
          icon={Zap}
          subtitle="Cadastre ou edite um otimizador"
          onSubmit={handleSave}
          submitLabel={editing ? "Salvar" : "Cadastrar"}
          saving={saveMutation.isPending}
          className="max-w-2xl"
        >
          <FormGrid>
            <div className="space-y-1 sm:col-span-2">
              <Label>Fabricante *</Label>
              <Input value={form.fabricante} onChange={(e) => set("fabricante", e.target.value)} placeholder="Ex: SolarEdge" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Modelo *</Label>
              <Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} placeholder="Ex: P370" />
            </div>
            <div className="space-y-1">
              <Label>Potência (Wp)</Label>
              <Input type="number" value={form.potencia_wp} onChange={(e) => set("potencia_wp", e.target.value)} placeholder="370" />
            </div>
            <div className="space-y-1">
              <Label>Tensão Entrada Máx (V)</Label>
              <Input type="number" value={form.tensao_entrada_max_v} onChange={(e) => set("tensao_entrada_max_v", e.target.value)} placeholder="60" />
            </div>
            <div className="space-y-1">
              <Label>Corrente Entrada Máx (A)</Label>
              <Input type="number" step="0.1" value={form.corrente_entrada_max_a} onChange={(e) => set("corrente_entrada_max_a", e.target.value)} placeholder="11" />
            </div>
            <div className="space-y-1">
              <Label>Tensão Saída (V)</Label>
              <Input type="number" value={form.tensao_saida_v} onChange={(e) => set("tensao_saida_v", e.target.value)} placeholder="60" />
            </div>
            <div className="space-y-1">
              <Label>Corrente Saída Máx (A)</Label>
              <Input type="number" step="0.1" value={form.corrente_saida_max_a} onChange={(e) => set("corrente_saida_max_a", e.target.value)} placeholder="15" />
            </div>
            <div className="space-y-1">
              <Label>Eficiência (%)</Label>
              <Input type="number" step="0.01" value={form.eficiencia_percent} onChange={(e) => set("eficiencia_percent", e.target.value)} placeholder="99.50" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Compatibilidade</Label>
              <Input value={form.compatibilidade} onChange={(e) => set("compatibilidade", e.target.value)} placeholder="Ex: SolarEdge, Huawei" />
            </div>
            <div className="space-y-1">
              <Label>Proteção IP</Label>
              <Input value={form.ip_protection} onChange={(e) => set("ip_protection", e.target.value)} placeholder="IP65" />
            </div>
            <div className="space-y-1">
              <Label>Dimensões (mm)</Label>
              <Input value={form.dimensoes_mm} onChange={(e) => set("dimensoes_mm", e.target.value)} placeholder="130x130x32" />
            </div>
            <div className="space-y-1">
              <Label>Peso (kg)</Label>
              <Input type="number" step="0.1" value={form.peso_kg} onChange={(e) => set("peso_kg", e.target.value)} placeholder="1.2" />
            </div>
            <div className="space-y-1">
              <Label>Garantia (anos)</Label>
              <Input type="number" value={form.garantia_anos} onChange={(e) => set("garantia_anos", e.target.value)} placeholder="25" />
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
              <AlertDialogTitle>Excluir Otimizador</AlertDialogTitle>
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

        <OtimizadorImportDialog
          open={distImportOpen}
          onOpenChange={setDistImportOpen}
          existingOtimizadores={otimizadores}
        />
        <BatchEnrichDialog
          open={batchEnrichOpen}
          onOpenChange={setBatchEnrichOpen}
          equipmentType="otimizador"
          draftIds={otimizadores.filter(o => o.status === "rascunho").map(o => o.id)}
        />
      </div>
    </div>
  );
}
