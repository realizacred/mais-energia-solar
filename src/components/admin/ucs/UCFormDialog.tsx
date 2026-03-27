/**
 * UCFormDialog — Create/Edit UC dialog with sections, CEP auto-fill, and input masks.
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/EmailInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { unitService, type UCRecord } from "@/services/unitService";
import { useConcessionarias } from "@/hooks/useConcessionarias";
import { useClientesList } from "@/hooks/useFormSelects";
import { Loader2, MapPin, Zap, FileText, Sun, Mail, UserPlus, Search, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AddressFields, type AddressData } from "@/components/shared/AddressFields";
import { InlineClienteCreateModal } from "./InlineClienteCreateModal";

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
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [address, setAddress] = useState<AddressData>({ ...EMPTY_ADDRESS });

  const { data: concessionarias = [] } = useConcessionarias();
  const { data: clientes = [] } = useClientesList();
  const [clientSearch, setClientSearch] = useState("");
  const [showCreateCliente, setShowCreateCliente] = useState(false);

  const filteredClientes = useMemo(() => {
    if (!clientSearch.trim()) return clientes;
    const q = clientSearch.toLowerCase();
    return clientes.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      (c.telefone || "").includes(q) ||
      (c.cpf_cnpj || "").includes(q) ||
      (c.email || "").toLowerCase().includes(q)
    );
  }, [clientes, clientSearch]);

  const selectedCliente = clientes.find(c => c.id === form.cliente_id);

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
        onSuccess();
      } else {
        const created = await unitService.create(payload);
        toast({ title: "UC criada com sucesso" });
        onSuccess();
        if (created?.id) {
          navigate(`/admin/ucs/${created.id}`);
        }
      }
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message || String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
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
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {/* Row 1: Dados da UC + Classificação */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Dados da UC — §2 bg-muted/30 */}
            <section className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3 min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-primary" />
                Dados da UC
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 min-w-0">
                  <Label className="text-[11px]">Código da UC <span className="text-destructive">*</span></Label>
                  <Input value={form.codigo_uc} onChange={set("codigo_uc")} placeholder="Ex: 0012345678" autoComplete="off" />
                </div>
                <div className="space-y-1 min-w-0">
                  <Label className="text-[11px]">Nome / Denominação <span className="text-destructive">*</span></Label>
                  <Input value={form.nome} onChange={set("nome")} placeholder="Nome da unidade" autoComplete="off" />
                </div>
                <div className="space-y-1 min-w-0">
                  <Label className="text-[11px]">Tipo da UC</Label>
                  <Select value={form.tipo_uc} onValueChange={set("tipo_uc")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beneficiaria">Beneficiária</SelectItem>
                      <SelectItem value="gd_geradora">GD Geradora</SelectItem>
                      <SelectItem value="mista">Mista (Geradora + Consumo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-0">
                  <Label className="text-[11px]">Concessionária <span className="text-destructive">*</span></Label>
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
            <section className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3 min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-primary" />
                Classificação Tarifária
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 min-w-0">
                  <Label className="text-[11px]">Grupo</Label>
                  <Select value={form.classificacao_grupo} onValueChange={set("classificacao_grupo")}>
                    <SelectTrigger><SelectValue placeholder="Ex: B1" /></SelectTrigger>
                    <SelectContent>
                      {GRUPOS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-0">
                  <Label className="text-[11px]">Subgrupo</Label>
                  <Input value={form.classificacao_subgrupo} onChange={set("classificacao_subgrupo")} placeholder="Ex: Residencial" autoComplete="off" />
                </div>
                <div className="space-y-1 min-w-0">
                  <Label className="text-[11px]">Modalidade Tarifária</Label>
                  <Select value={form.modalidade_tarifaria} onValueChange={set("modalidade_tarifaria")}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {MODALIDADES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="pt-0.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold">Observações</Label>
                  {editingUC && (
                    <div className="flex items-center gap-1.5 px-1">
                      <Label className="text-[11px] text-muted-foreground">Ativo</Label>
                      <Switch checked={form.ativo} onCheckedChange={(v) => setForm(f => ({ ...f, ativo: v }))} />
                    </div>
                  )}
                </div>
                <Textarea value={form.observacoes} onChange={set("observacoes")} rows={2} placeholder="Notas internas..." className="text-sm" />
              </div>
            </section>
          </div>

          {/* Row 2: GD + Faturamento + Cliente */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* GD */}
            <section className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3 min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Sun className="w-3 h-3 text-primary" />
                Geração Distribuída
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 min-w-0">
                  <Label className="text-[11px]">Papel GD</Label>
                  <Select value={form.papel_gd} onValueChange={set("papel_gd")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="geradora">Geradora</SelectItem>
                      <SelectItem value="beneficiaria">Beneficiária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-0">
                  <Label className="text-[11px]">Categoria GD</Label>
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
            <section className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3 min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-primary" />
                Faturamento
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-[11px]">Cliente</Label>
                  {form.cliente_id && selectedCliente ? (
                    <div className="flex items-center gap-2 p-2 rounded-md border border-border bg-background text-sm">
                      <span className="flex-1 truncate text-foreground font-medium">{selectedCliente.nome}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={() => setForm(f => ({ ...f, cliente_id: "" }))}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          placeholder="Buscar por nome, telefone, CPF..."
                          className="pl-8 h-8 text-xs"
                        />
                      </div>
                      {clientSearch.trim() && (
                        <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-background">
                          {filteredClientes.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-2 text-center">Nenhum cliente encontrado</p>
                          ) : (
                            filteredClientes.slice(0, 8).map(c => (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                                onClick={() => { setForm(f => ({ ...f, cliente_id: c.id })); setClientSearch(""); }}
                              >
                                <span className="font-medium text-foreground truncate">{c.nome}</span>
                                {c.telefone && <span className="text-muted-foreground text-[10px] ml-2 shrink-0">{c.telefone}</span>}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      {!clientSearch.trim() && (
                        <Select value="none" onValueChange={(v) => { if (v !== "none") setForm(f => ({ ...f, cliente_id: v })); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="ou selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {clientes.slice(0, 50).map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-[11px]"
                        onClick={() => setShowCreateCliente(true)}
                      >
                        <UserPlus className="w-3 h-3 mr-1.5" />
                        Cadastrar novo cliente
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-1 min-w-0">
                  <Label className="text-[11px]">E-mail da Fatura</Label>
                  <EmailInput value={form.email_fatura || ""} onChange={(v) => setForm(f => ({ ...f, email_fatura: v }))} placeholder="fatura@email.com" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Leitura automática por e-mail</Label>
                  <Switch checked={form.leitura_automatica_email} onCheckedChange={(v) => setForm(f => ({ ...f, leitura_automatica_email: v }))} />
                </div>
              </div>
            </section>
          </div>

          {/* Row 3: Endereço — §13 AddressFields */}
          <section className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-primary" />
              Endereço
            </p>
            <AddressFields value={address} onChange={setAddress} />
          </section>
        </div>

        {/* Footer — §25 */}
        <div className="flex justify-end gap-2 p-3 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? "Salvando..." : editingUC ? "Salvar Alterações" : "Criar UC"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <InlineClienteCreateModal
      open={showCreateCliente}
      onOpenChange={setShowCreateCliente}
      existingClientes={clientes}
      onCreated={(id) => setForm(f => ({ ...f, cliente_id: id }))}
    />
    </>
  );
}
