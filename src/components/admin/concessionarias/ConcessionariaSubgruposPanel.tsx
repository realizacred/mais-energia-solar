import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Zap, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

function getGrupoLabel(sub: string) {
  if (SUBGRUPOS_BT.includes(sub)) return "B";
  if (sub.startsWith("A")) return "A";
  return "?";
}

export function ConcessionariaSubgruposPanel({ concessionariaId, concessionariaNome }: Props) {
  const { toast } = useToast();
  const [tarifas, setTarifas] = useState<TarifaSubgrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<TarifaSubgrupo | null>(null);

  // Form state for new subgrupo
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
    if (open) fetchTarifas();
  }, [open, fetchTarifas]);

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
      .upsert([payload] as any, { onConflict: "concessionaria_id,subgrupo,tenant_id" });

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

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 rounded transition-colors">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">Tarifas por Subgrupo</span>
            <Badge variant="outline" className="text-[10px] ml-auto">{tarifas.length} subgrupos</Badge>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3">
            {loading ? (
              <div className="text-xs text-muted-foreground py-2">Carregando...</div>
            ) : (
              <>
                {/* BT Section */}
                {tarifasBT.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge className="text-[10px] bg-success/15 text-success border-0">Grupo B</Badge>
                      <span className="text-[10px] text-muted-foreground">Baixa Tensão</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] h-7">Sub</TableHead>
                          <TableHead className="text-[10px] h-7">Tarifa</TableHead>
                          <TableHead className="text-[10px] h-7">Fio B</TableHead>
                          <TableHead className="text-[10px] h-7">Origem</TableHead>
                          <TableHead className="text-[10px] h-7 w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tarifasBT.map(t => (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs font-mono py-1">{t.subgrupo}</TableCell>
                            <TableCell className="text-xs py-1">{t.tarifa_energia != null ? `R$ ${Number(t.tarifa_energia).toFixed(4)}` : "—"}</TableCell>
                            <TableCell className="text-xs py-1">{t.tarifa_fio_b != null ? `R$ ${Number(t.tarifa_fio_b).toFixed(4)}` : "—"}</TableCell>
                            <TableCell className="py-1">
                              <Badge variant={t.origem === "ANEEL" ? "default" : "secondary"} className="text-[9px]">{t.origem || "manual"}</Badge>
                            </TableCell>
                            <TableCell className="py-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleting(t)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* MT Section */}
                {tarifasMT.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge className="text-[10px] bg-primary/15 text-primary border-0">Grupo A</Badge>
                      <span className="text-[10px] text-muted-foreground">Média/Alta Tensão</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] h-7">Sub</TableHead>
                          <TableHead className="text-[10px] h-7">Mod.</TableHead>
                          <TableHead className="text-[10px] h-7">TE P</TableHead>
                          <TableHead className="text-[10px] h-7">TE FP</TableHead>
                          <TableHead className="text-[10px] h-7">TUSD P</TableHead>
                          <TableHead className="text-[10px] h-7">TUSD FP</TableHead>
                          <TableHead className="text-[10px] h-7">Dem.</TableHead>
                          <TableHead className="text-[10px] h-7 w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tarifasMT.map(t => (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs font-mono py-1">{t.subgrupo}</TableCell>
                            <TableCell className="text-[10px] py-1">{t.modalidade_tarifaria || "—"}</TableCell>
                            <TableCell className="text-xs py-1">{t.te_ponta != null ? t.te_ponta.toFixed(4) : "—"}</TableCell>
                            <TableCell className="text-xs py-1">{t.te_fora_ponta != null ? t.te_fora_ponta.toFixed(4) : "—"}</TableCell>
                            <TableCell className="text-xs py-1">{t.tusd_ponta != null ? t.tusd_ponta.toFixed(4) : "—"}</TableCell>
                            <TableCell className="text-xs py-1">{t.tusd_fora_ponta != null ? t.tusd_fora_ponta.toFixed(4) : "—"}</TableCell>
                            <TableCell className="text-xs py-1">{t.demanda_consumo_rs != null ? `R$ ${t.demanda_consumo_rs.toFixed(2)}` : "—"}</TableCell>
                            <TableCell className="py-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleting(t)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {tarifas.length === 0 && (
                  <div className="flex items-start gap-2 p-2 bg-muted/30 rounded text-xs text-muted-foreground">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Nenhum subgrupo cadastrado. Clique em "Sincronizar Tarifas" para popular automaticamente os subgrupos BT, ou adicione manualmente.</span>
                  </div>
                )}

                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => { resetForm(); setDialogOpen(true); }}>
                  <Plus className="w-3 h-3" />
                  Adicionar Subgrupo
                </Button>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

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
    </>
  );
}
