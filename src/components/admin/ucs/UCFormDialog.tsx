/**
 * UCFormDialog — Create/Edit UC dialog with sections, CEP auto-fill, and input masks.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { unitService, type UCRecord } from "@/services/unitService";
import { useConcessionarias } from "@/hooks/useConcessionarias";
import { useClientesList } from "@/hooks/useFormSelects";
import { Loader2, MapPin, Zap, FileText, Sun, Mail } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AddressFields, type AddressData } from "@/components/shared/AddressFields";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editingUC: UCRecord | null;
  onSuccess: () => void;
}

const GRUPOS = ["A1", "A2", "A3", "A3a", "A4", "AS", "B1", "B2", "B3", "B4"];
const MODALIDADES = ["Convencional", "Horossazonal Branca", "Horossazonal Verde", "Horossazonal Azul"];

const EMPTY_FORM = {
  codigo_uc: "", nome: "", tipo_uc: "beneficiaria", concessionaria_id: "",
  classificacao_grupo: "", classificacao_subgrupo: "", modalidade_tarifaria: "",
  observacoes: "", ativo: true,
  papel_gd: "none", categoria_gd: "", email_fatura: "", leitura_automatica_email: false,
  cliente_id: "",
};

const EMPTY_ADDRESS: AddressData = {
  cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
};

export function UCFormDialog({ open, onOpenChange, editingUC, onSuccess }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [address, setAddress] = useState<AddressData>({ ...EMPTY_ADDRESS });

  const { data: concessionarias = [] } = useConcessionarias();
  const { data: clientes = [] } = useClientesList();

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
        papel_gd: editingUC.papel_gd || "none",
        categoria_gd: editingUC.categoria_gd || "",
        email_fatura: editingUC.email_fatura || "",
        leitura_automatica_email: editingUC.leitura_automatica_email ?? false,
        cliente_id: editingUC.cliente_id || "",
      });
      setAddress({
        cep: end.cep || "", rua: end.logradouro || end.rua || "",
        numero: end.numero || "", complemento: end.complemento || "",
        bairro: end.bairro || "", cidade: end.cidade || "", estado: end.estado || "",
      });
    } else {
      setForm({ ...EMPTY_FORM });
      setAddress({ ...EMPTY_ADDRESS });
    }
  }, [editingUC, open]);

  const set = (k: string) => (e: any) =>
    setForm(f => ({ ...f, [k]: typeof e === "string" ? e : e.target.value }));

  async function handleSave() {
    if (!form.codigo_uc.trim() || !form.nome.trim()) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (!form.concessionaria_id) {
      toast({ title: "Concessionária é obrigatória", variant: "destructive" });
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
        papel_gd: form.papel_gd,
        categoria_gd: form.categoria_gd || null,
        email_fatura: form.email_fatura.trim() || null,
        leitura_automatica_email: form.leitura_automatica_email,
        cliente_id: form.cliente_id || null,
        endereco: {
          cep: address.cep, logradouro: address.rua, numero: address.numero,
          complemento: address.complemento, bairro: address.bairro,
          cidade: address.cidade, estado: address.estado,
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
      <DialogContent className="w-[90vw] max-w-[1100px] p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Header — §25 */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {editingUC ? "Editar Unidade Consumidora" : "Nova Unidade Consumidora"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {editingUC ? "Atualize os dados da unidade consumidora" : "Cadastre uma nova unidade consumidora"}
            </p>
          </div>
        </DialogHeader>

        {/* Body — §39 flex-1 min-h-0 overflow-y-auto */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
          {/* Row 1: Dados da UC + Classificação */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Dados da UC — §2 bg-muted/30 */}
            <section className="rounded-lg border border-border bg-muted/30 p-5 space-y-4 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-primary" />
                Dados da UC
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">Código da UC <span className="text-destructive">*</span></Label>
                  <Input value={form.codigo_uc} onChange={set("codigo_uc")} placeholder="Ex: 0012345678" autoComplete="off" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">Nome / Denominação <span className="text-destructive">*</span></Label>
                  <Input value={form.nome} onChange={set("nome")} placeholder="Nome da unidade" autoComplete="off" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">Tipo da UC</Label>
                  <Select value={form.tipo_uc} onValueChange={set("tipo_uc")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beneficiaria">Beneficiária</SelectItem>
                      <SelectItem value="gd_geradora">GD Geradora</SelectItem>
                      <SelectItem value="mista">Mista (Geradora + Consumo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">Concessionária <span className="text-destructive">*</span></Label>
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

            {/* Classificação Tarifária — §2 bg-muted/30 */}
            <section className="rounded-lg border border-border bg-muted/30 p-5 space-y-4 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Classificação Tarifária
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">Grupo</Label>
                  <Select value={form.classificacao_grupo} onValueChange={set("classificacao_grupo")}>
                    <SelectTrigger><SelectValue placeholder="Ex: B1" /></SelectTrigger>
                    <SelectContent>
                      {GRUPOS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">Subgrupo</Label>
                  <Input value={form.classificacao_subgrupo} onChange={set("classificacao_subgrupo")} placeholder="Ex: Residencial" autoComplete="off" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">Modalidade Tarifária</Label>
                  <Select value={form.modalidade_tarifaria} onValueChange={set("modalidade_tarifaria")}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {MODALIDADES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="pt-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Observações</Label>
                  {editingUC && (
                    <div className="flex items-center gap-2 px-1">
                      <Label className="text-xs text-muted-foreground">Ativo</Label>
                      <Switch checked={form.ativo} onCheckedChange={(v) => setForm(f => ({ ...f, ativo: v }))} />
                    </div>
                  )}
                </div>
                <Textarea value={form.observacoes} onChange={set("observacoes")} rows={3} placeholder="Notas internas..." />
              </div>
            </section>
          </div>

          {/* Row 2: GD + Faturamento + Cliente */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* GD */}
            <section className="rounded-lg border border-border bg-muted/30 p-5 space-y-4 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Sun className="w-3.5 h-3.5 text-primary" />
                Geração Distribuída
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">Papel GD</Label>
                  <Select value={form.papel_gd} onValueChange={set("papel_gd")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="geradora">Geradora</SelectItem>
                      <SelectItem value="beneficiaria">Beneficiária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">Categoria GD</Label>
                  <Select value={form.categoria_gd || "none"} onValueChange={(v) => setForm(f => ({ ...f, categoria_gd: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="gd1">GD I</SelectItem>
                      <SelectItem value="gd2">GD II</SelectItem>
                      <SelectItem value="gd3">GD III</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Faturamento */}
            <section className="rounded-lg border border-border bg-muted/30 p-5 space-y-4 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-primary" />
                Faturamento
              </p>
              <div className="space-y-4">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">Cliente</Label>
                  <Select value={form.cliente_id || "none"} onValueChange={(v) => setForm(f => ({ ...f, cliente_id: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o cliente..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {clientes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs">E-mail da Fatura</Label>
                  <Input type="email" value={form.email_fatura} onChange={set("email_fatura")} placeholder="fatura@email.com" autoComplete="off" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Leitura automática por e-mail</Label>
                  <Switch checked={form.leitura_automatica_email} onCheckedChange={(v) => setForm(f => ({ ...f, leitura_automatica_email: v }))} />
                </div>
              </div>
            </section>
          </div>

          {/* Row 3: Endereço — §13 AddressFields */}
          <section className="rounded-lg border border-border bg-muted/30 p-5 space-y-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              Endereço
            </p>
            <AddressFields value={address} onChange={setAddress} />
          </section>
        </div>

        {/* Footer — §25 */}
        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? "Salvando..." : editingUC ? "Salvar Alterações" : "Criar UC"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
