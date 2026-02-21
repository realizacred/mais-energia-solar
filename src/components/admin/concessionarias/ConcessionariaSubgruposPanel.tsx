import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Zap, Info, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

interface TarifaSubgrupo {
  id: string;
  concessionaria_id: string;
  subgrupo: string;
  modalidade_tarifaria: string | null;
  tarifa_energia: number | null;
  tarifa_fio_b: number | null;
  tarifacao_bt: number | null;
  te_ponta: number | null;
  te_fora_ponta: number | null;
  tusd_ponta: number | null;
  tusd_fora_ponta: number | null;
  demanda_consumo_rs: number | null;
  demanda_geracao_rs: number | null;
  origem: string | null;
  is_active: boolean | null;
  updated_at: string;
}

interface Props {
  concessionariaId: string;
  concessionariaNome: string;
}

const SUBGRUPOS_BT = ["B1", "B2", "B3"];
const SUBGRUPOS_MT = [
  "A1", "A2", "A3", "A3a", "A4", "AS",
  "A3a - Verde", "A3a - Azul", "A4 - Verde", "A4 - Azul",
];
const MODALIDADES = ["Convencional", "Branca", "Verde", "Azul"];

const isGrupoA = (sub: string) => sub.startsWith("A");

function formatVal(v: number | null, prefix = "R$ ", decimals = 4) {
  if (v == null) return "—";
  return `${prefix}${Number(v).toFixed(decimals)}`;
}

function OrigemBadge({ origem }: { origem: string | null }) {
  const label = origem || "manual";
  if (label === "ANEEL" || label === "sync_aneel") {
    return <Badge variant="outline" className="text-[9px] font-mono bg-info/10 text-info border-info/30">{label}</Badge>;
  }
  if (label === "auto_seed" || label === "sync") {
    return <Badge variant="outline" className="text-[9px] font-mono bg-muted text-muted-foreground border-border">{label}</Badge>;
  }
  return <Badge variant="outline" className="text-[9px] font-mono bg-warning/10 text-warning border-warning/30">{label}</Badge>;
}

/** Color config per modalidade */
function getModalidadeColor(modalidade: string | null) {
  switch (modalidade?.toLowerCase()) {
    case "verde": return { bg: "bg-success/8", border: "border-success/25", accent: "text-success", badgeBg: "bg-success/15 text-success border-success/30" };
    case "azul": return { bg: "bg-info/8", border: "border-info/25", accent: "text-info", badgeBg: "bg-info/15 text-info border-info/30" };
    case "branca": return { bg: "bg-muted/60", border: "border-border", accent: "text-muted-foreground", badgeBg: "bg-muted text-muted-foreground border-border" };
    default: return { bg: "bg-card", border: "border-border", accent: "text-primary", badgeBg: "bg-primary/10 text-primary border-primary/30" };
  }
}

export function ConcessionariaSubgruposPanel({ concessionariaId, concessionariaNome }: Props) {
  const { toast } = useToast();
  const [tarifas, setTarifas] = useState<TarifaSubgrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<TarifaSubgrupo | null>(null);

  const [form, setForm] = useState({
    subgrupo: "",
    modalidade_tarifaria: "Convencional",
    tarifa_energia: "",
    tarifa_fio_b: "",
    te_ponta: "",
    te_fora_ponta: "",
    tusd_ponta: "",
    tusd_fora_ponta: "",
    demanda_consumo_rs: "",
    demanda_geracao_rs: "",
  });

  const fetchTarifas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("concessionaria_tarifas_subgrupo")
      .select("*")
      .eq("concessionaria_id", concessionariaId)
      .order("subgrupo");
    if (!error && data) setTarifas(data as TarifaSubgrupo[]);
    setLoading(false);
  }, [concessionariaId]);

  useEffect(() => {
    fetchTarifas();
  }, [fetchTarifas]);

  const tarifasBT = tarifas.filter(t => !isGrupoA(t.subgrupo));
  const tarifasMT = tarifas.filter(t => isGrupoA(t.subgrupo));

  const resetForm = () => setForm({
    subgrupo: "", modalidade_tarifaria: "Convencional",
    tarifa_energia: "", tarifa_fio_b: "",
    te_ponta: "", te_fora_ponta: "",
    tusd_ponta: "", tusd_fora_ponta: "",
    demanda_consumo_rs: "", demanda_geracao_rs: "",
  });

  const handleSave = async () => {
    if (!form.subgrupo) {
      toast({ title: "Selecione um subgrupo", variant: "destructive" });
      return;
    }
    const parseNum = (v: string) => v.trim() ? parseFloat(v) : null;
    const payload = {
      concessionaria_id: concessionariaId,
      subgrupo: form.subgrupo,
      modalidade_tarifaria: form.modalidade_tarifaria || null,
      tarifa_energia: parseNum(form.tarifa_energia),
      tarifa_fio_b: parseNum(form.tarifa_fio_b),
      te_ponta: parseNum(form.te_ponta),
      te_fora_ponta: parseNum(form.te_fora_ponta),
      tusd_ponta: parseNum(form.tusd_ponta),
      tusd_fora_ponta: parseNum(form.tusd_fora_ponta),
      demanda_consumo_rs: parseNum(form.demanda_consumo_rs),
      demanda_geracao_rs: parseNum(form.demanda_geracao_rs),
      origem: "manual",
      is_active: true,
    };
    const { error } = await supabase
      .from("concessionaria_tarifas_subgrupo")
      .upsert([payload] as any, { onConflict: "tenant_id,concessionaria_id,subgrupo,modalidade_tarifaria" });
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Subgrupo salvo com sucesso" });
    setDialogOpen(false);
    resetForm();
    fetchTarifas();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase
      .from("concessionaria_tarifas_subgrupo")
      .delete()
      .eq("id", deleting.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Subgrupo excluído" });
      fetchTarifas();
    }
    setDeleting(null);
  };

  const selectedIsGrupoA = isGrupoA(form.subgrupo);

  if (loading) {
    return (
      <div className="p-4 text-xs text-muted-foreground animate-pulse">
        Carregando tarifas por subgrupo...
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Tarifas por Subgrupo</span>
            <Badge variant="outline" className="text-[10px]">{tarifas.length} subgrupos</Badge>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="w-3 h-3" />
            Adicionar
          </Button>
        </div>

        {tarifas.length === 0 && (
          <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground border border-border/50">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-info" />
            <span>Nenhum subgrupo cadastrado. Clique em <strong>"Sincronizar ANEEL"</strong> para popular automaticamente, ou adicione manualmente.</span>
          </div>
        )}

        {/* Grupo B — Cards */}
        {tarifasBT.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="text-[10px] bg-success/15 text-success border-0 font-semibold">Grupo B</Badge>
              <span className="text-[11px] text-muted-foreground">Baixa Tensão — Convencional</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tarifasBT.map(t => (
                <div key={t.id} className="rounded-lg border border-success/20 bg-success/5 p-3.5 flex flex-col gap-2 group hover:shadow-md transition-all hover:border-success/40">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold font-mono text-foreground">{t.subgrupo}</span>
                    <div className="flex items-center gap-1.5">
                      <OrigemBadge origem={t.origem} />
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDeleting(t)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Tarifa Energia</span>
                    <span className="text-right font-semibold text-foreground">{formatVal(t.tarifa_energia)}</span>
                    <span className="text-muted-foreground">Fio B (TUSD)</span>
                    <span className="text-right font-semibold text-foreground">{formatVal(t.tarifa_fio_b)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grupo A — Cards */}
        {tarifasMT.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="text-[10px] bg-primary/15 text-primary border-0 font-semibold">Grupo A</Badge>
              <span className="text-[11px] text-muted-foreground">Média / Alta Tensão — Ponta e Fora Ponta</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {tarifasMT.map(t => {
                const colors = getModalidadeColor(t.modalidade_tarifaria);
                return (
                  <div key={t.id} className={`rounded-lg border ${colors.border} ${colors.bg} p-4 space-y-3 group hover:shadow-md transition-all`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold font-mono text-foreground">{t.subgrupo}</span>
                        {t.modalidade_tarifaria && (
                          <Badge variant="outline" className={`text-[10px] font-semibold ${colors.badgeBg}`}>{t.modalidade_tarifaria}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <OrigemBadge origem={t.origem} />
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDeleting(t)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* TE */}
                      <div className="rounded-md bg-background/60 border border-border/40 p-2.5 space-y-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.accent}`}>TE (R$/kWh)</span>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Ponta</span>
                          <span className="font-semibold text-foreground">{formatVal(t.te_ponta, "", 4)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">F. Ponta</span>
                          <span className="font-semibold text-foreground">{formatVal(t.te_fora_ponta, "", 4)}</span>
                        </div>
                      </div>
                      {/* TUSD */}
                      <div className="rounded-md bg-background/60 border border-border/40 p-2.5 space-y-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.accent}`}>TUSD (R$/kWh)</span>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Ponta</span>
                          <span className="font-semibold text-foreground">{formatVal(t.tusd_ponta, "", 4)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">F. Ponta</span>
                          <span className="font-semibold text-foreground">{formatVal(t.tusd_fora_ponta, "", 4)}</span>
                        </div>
                      </div>
                    </div>
                    {/* Demanda */}
                    {(t.demanda_consumo_rs != null || t.demanda_geracao_rs != null) && (
                      <div className="flex gap-6 text-xs pt-2 border-t border-border/40">
                        <div>
                          <span className="text-muted-foreground">Dem. Consumo: </span>
                          <span className="font-semibold text-foreground">{formatVal(t.demanda_consumo_rs, "R$ ", 2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Dem. Geração: </span>
                          <span className="font-semibold text-foreground">{formatVal(t.demanda_geracao_rs, "R$ ", 2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add subgrupo dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Adicionar Subgrupo — {concessionariaNome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Subgrupo *</Label>
                <Select value={form.subgrupo} onValueChange={v => setForm(f => ({ ...f, subgrupo: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_header_bt" disabled className="text-[10px] font-bold text-muted-foreground">─ Grupo B (BT) ─</SelectItem>
                    {SUBGRUPOS_BT.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    <SelectItem value="_header_mt" disabled className="text-[10px] font-bold text-muted-foreground">─ Grupo A (MT) ─</SelectItem>
                    {SUBGRUPOS_MT.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modalidade</Label>
                <Select value={form.modalidade_tarifaria} onValueChange={v => setForm(f => ({ ...f, modalidade_tarifaria: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODALIDADES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* BT fields */}
            {!selectedIsGrupoA && form.subgrupo && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tarifa Energia (R$/kWh)</Label>
                  <Input type="number" step="0.0001" className="h-8 text-xs" value={form.tarifa_energia} onChange={e => setForm(f => ({ ...f, tarifa_energia: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fio B (R$/kWh)</Label>
                  <Input type="number" step="0.0001" className="h-8 text-xs" value={form.tarifa_fio_b} onChange={e => setForm(f => ({ ...f, tarifa_fio_b: e.target.value }))} />
                </div>
              </div>
            )}

            {/* MT fields */}
            {selectedIsGrupoA && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">TE Ponta (R$/kWh)</Label>
                    <Input type="number" step="0.0001" className="h-8 text-xs" value={form.te_ponta} onChange={e => setForm(f => ({ ...f, te_ponta: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">TE Fora Ponta (R$/kWh)</Label>
                    <Input type="number" step="0.0001" className="h-8 text-xs" value={form.te_fora_ponta} onChange={e => setForm(f => ({ ...f, te_fora_ponta: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">TUSD Ponta (R$/kWh)</Label>
                    <Input type="number" step="0.0001" className="h-8 text-xs" value={form.tusd_ponta} onChange={e => setForm(f => ({ ...f, tusd_ponta: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">TUSD Fora Ponta (R$/kWh)</Label>
                    <Input type="number" step="0.0001" className="h-8 text-xs" value={form.tusd_fora_ponta} onChange={e => setForm(f => ({ ...f, tusd_fora_ponta: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Demanda Consumo (R$/kW)</Label>
                    <Input type="number" step="0.01" className="h-8 text-xs" value={form.demanda_consumo_rs} onChange={e => setForm(f => ({ ...f, demanda_consumo_rs: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Demanda Geração (R$/kW)</Label>
                    <Input type="number" step="0.01" className="h-8 text-xs" value={form.demanda_geracao_rs} onChange={e => setForm(f => ({ ...f, demanda_geracao_rs: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            {!form.subgrupo && (
              <p className="text-xs text-muted-foreground italic">Selecione um subgrupo para ver os campos disponíveis.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir subgrupo {deleting?.subgrupo}?</AlertDialogTitle>
            <AlertDialogDescription>
              A tarifa do subgrupo {deleting?.subgrupo} de {concessionariaNome} será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
