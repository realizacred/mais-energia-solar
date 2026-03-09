/**
 * UCFormDialog — Create/Edit UC dialog with sections, CEP auto-fill, and input masks.
 */
import { useState, useEffect, useCallback } from "react";
import { useCepLookup } from "@/hooks/useCepLookup";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { unitService, type UCRecord } from "@/services/unitService";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Zap, FileText, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editingUC: UCRecord | null;
  onSuccess: () => void;
}

const GRUPOS = ["A1", "A2", "A3", "A3a", "A4", "AS", "B1", "B2", "B3", "B4"];
const MODALIDADES = ["Convencional", "Horossazonal Branca", "Horossazonal Verde", "Horossazonal Azul"];
const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

const EMPTY_FORM = {
  codigo_uc: "", nome: "", tipo_uc: "consumo", concessionaria_id: "",
  classificacao_grupo: "", classificacao_subgrupo: "", modalidade_tarifaria: "",
  observacoes: "", ativo: true,
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
};

/** Mask CEP: 00000-000 */
function maskCep(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return digits.slice(0, 5) + "-" + digits.slice(5);
}

export function UCFormDialog({ open, onOpenChange, editingUC, onSuccess }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: concessionarias = [] } = useQuery({
    queryKey: ["concessionarias_select"],
    queryFn: async () => {
      const { data } = await supabase.from("concessionarias").select("id, nome, estado").eq("ativo", true).order("nome");
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!open) return;
    if (editingUC) {
      const end = editingUC.endereco || {};
      setForm({
        codigo_uc: editingUC.codigo_uc,
        nome: editingUC.nome,
        tipo_uc: editingUC.tipo_uc,
        concessionaria_id: editingUC.concessionaria_id || "",
        classificacao_grupo: editingUC.classificacao_grupo || "",
        classificacao_subgrupo: editingUC.classificacao_subgrupo || "",
        modalidade_tarifaria: editingUC.modalidade_tarifaria || "",
        observacoes: editingUC.observacoes || "",
        ativo: editingUC.status === "active",
        cep: end.cep || "", logradouro: end.logradouro || "",
        numero: end.numero || "", complemento: end.complemento || "",
        bairro: end.bairro || "", cidade: end.cidade || "", estado: end.estado || "",
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
  }, [editingUC, open]);

  const set = (k: string) => (e: any) =>
    setForm(f => ({ ...f, [k]: typeof e === "string" ? e : e.target.value }));

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCep(e.target.value);
    setForm(f => ({ ...f, cep: masked }));
  };

  const { lookup: lookupCep } = useCepLookup();

  const fetchCep = useCallback(async () => {
    setFetchingCep(true);
    const result = await lookupCep(form.cep);
    if (result === null) {
      const digits = form.cep.replace(/\D/g, "");
      if (digits.length === 8) {
        toast({ title: "CEP não encontrado", variant: "destructive" });
      }
    } else {
      setForm(f => ({
        ...f,
        logradouro: result.rua || f.logradouro,
        bairro: result.bairro || f.bairro,
        cidade: result.cidade || f.cidade,
        estado: result.estado || f.estado,
        complemento: result.complemento || f.complemento,
      }));
    }
    setFetchingCep(false);
  }, [form.cep, toast, lookupCep]);

  // Auto-fetch on CEP complete
  useEffect(() => {
    const digits = form.cep.replace(/\D/g, "");
    if (digits.length === 8) fetchCep();
  }, [form.cep]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!form.codigo_uc.trim() || !form.nome.trim()) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const conc = concessionarias.find(c => c.id === form.concessionaria_id);
      const payload: any = {
        codigo_uc: form.codigo_uc.trim(),
        nome: form.nome.trim(),
        tipo_uc: form.tipo_uc,
        concessionaria_id: form.concessionaria_id || null,
        concessionaria_nome: conc?.nome || null,
        classificacao_grupo: form.classificacao_grupo || null,
        classificacao_subgrupo: form.classificacao_subgrupo || null,
        modalidade_tarifaria: form.modalidade_tarifaria || null,
        observacoes: form.observacoes || null,
        status: form.ativo ? "active" : "inactive",
        endereco: {
          cep: form.cep, logradouro: form.logradouro, numero: form.numero,
          complemento: form.complemento, bairro: form.bairro, cidade: form.cidade, estado: form.estado,
        },
      };

      if (editingUC) {
        await unitService.update(editingUC.id, payload);
        toast({ title: "UC atualizada com sucesso" });
      } else {
        await unitService.create(payload);
        toast({ title: "UC criada com sucesso" });
      }
      onSuccess();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message || String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>{editingUC ? "Editar UC" : "Nova Unidade Consumidora"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* ── Section 1: Dados da UC ── */}
          <section className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Zap className="w-4 h-4 text-primary" />
              Dados da UC
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Código da UC <span className="text-destructive">*</span></Label>
                <Input value={form.codigo_uc} onChange={set("codigo_uc")} placeholder="Ex: 0012345678" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome / Denominação <span className="text-destructive">*</span></Label>
                <Input value={form.nome} onChange={set("nome")} placeholder="Nome da unidade" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo da UC</Label>
                <Select value={form.tipo_uc} onValueChange={set("tipo_uc")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consumo">Consumo</SelectItem>
                    <SelectItem value="gd_geradora">GD Geradora</SelectItem>
                    <SelectItem value="beneficiaria">Beneficiária</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Concessionária</Label>
                <Select value={form.concessionaria_id} onValueChange={set("concessionaria_id")}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {concessionarias.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome} {c.estado ? `(${c.estado})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* ── Section 2: Classificação Tarifária ── */}
          <section className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              Classificação Tarifária
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Grupo</Label>
                <Select value={form.classificacao_grupo} onValueChange={set("classificacao_grupo")}>
                  <SelectTrigger><SelectValue placeholder="Ex: B1" /></SelectTrigger>
                  <SelectContent>
                    {GRUPOS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subgrupo</Label>
                <Input value={form.classificacao_subgrupo} onChange={set("classificacao_subgrupo")} placeholder="Ex: Residencial" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modalidade Tarifária</Label>
                <Select value={form.modalidade_tarifaria} onValueChange={set("modalidade_tarifaria")}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {MODALIDADES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* ── Section 3: Endereço ── */}
          <section className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              Endereço
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">CEP</Label>
                <div className="relative">
                  <Input
                    value={form.cep}
                    onChange={handleCepChange}
                    placeholder="00000-000"
                    maxLength={9}
                    autoComplete="off"
                  />
                  {fetchingCep && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                  {!fetchingCep && form.cep.replace(/\D/g, "").length === 8 && (
                    <Search
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground cursor-pointer hover:text-primary"
                      onClick={fetchCep}
                    />
                  )}
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Logradouro</Label>
                <Input value={form.logradouro} onChange={set("logradouro")} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Número</Label>
                <Input value={form.numero} onChange={set("numero")} autoComplete="off" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Complemento</Label>
                <Input value={form.complemento} onChange={set("complemento")} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bairro</Label>
                <Input value={form.bairro} onChange={set("bairro")} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cidade</Label>
                <Input value={form.cidade} onChange={set("cidade")} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <Select value={form.estado} onValueChange={set("estado")}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* ── Section 4: Observações & Status ── */}
          <section className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Observações</Label>
              {editingUC && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Ativo</Label>
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm(f => ({ ...f, ativo: v }))} />
                </div>
              )}
            </div>
            <Textarea value={form.observacoes} onChange={set("observacoes")} rows={3} placeholder="Notas internas sobre esta UC..." />
          </section>
        </div>

        <Separator />
        <DialogFooter className="px-6 pb-6 pt-3 flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? "Salvando..." : editingUC ? "Salvar Alterações" : "Criar UC"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
