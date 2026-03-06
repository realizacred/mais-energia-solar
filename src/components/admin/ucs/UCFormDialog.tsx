/**
 * UCFormDialog — Create/Edit UC dialog with structured address fields.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { unitService, type UCRecord } from "@/services/unitService";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editingUC: UCRecord | null;
  onSuccess: () => void;
}

const GRUPOS = ["A1", "A2", "A3", "A3a", "A4", "AS", "B1", "B2", "B3", "B4"];
const MODALIDADES = ["Convencional", "Horossazonal Branca", "Horossazonal Verde", "Horossazonal Azul"];

export function UCFormDialog({ open, onOpenChange, editingUC, onSuccess }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    codigo_uc: "",
    nome: "",
    tipo_uc: "consumo" as string,
    concessionaria_id: "" as string,
    classificacao_grupo: "",
    classificacao_subgrupo: "",
    modalidade_tarifaria: "",
    observacoes: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
  });

  const { data: concessionarias = [] } = useQuery({
    queryKey: ["concessionarias_select"],
    queryFn: async () => {
      const { data } = await supabase.from("concessionarias").select("id, nome, estado").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  useEffect(() => {
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
        cep: end.cep || "",
        logradouro: end.logradouro || "",
        numero: end.numero || "",
        complemento: end.complemento || "",
        bairro: end.bairro || "",
        cidade: end.cidade || "",
        estado: end.estado || "",
      });
    } else {
      setForm({ codigo_uc: "", nome: "", tipo_uc: "consumo", concessionaria_id: "", classificacao_grupo: "", classificacao_subgrupo: "", modalidade_tarifaria: "", observacoes: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" });
    }
  }, [editingUC, open]);

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
        endereco: {
          cep: form.cep, logradouro: form.logradouro, numero: form.numero,
          complemento: form.complemento, bairro: form.bairro, cidade: form.cidade, estado: form.estado,
        },
      };

      if (editingUC) {
        await unitService.update(editingUC.id, payload);
        toast({ title: "UC atualizada" });
      } else {
        await unitService.create(payload);
        toast({ title: "UC criada com sucesso" });
      }
      onSuccess();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: typeof e === "string" ? e : e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingUC ? "Editar UC" : "Nova Unidade Consumidora"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Código da UC *</Label>
            <Input value={form.codigo_uc} onChange={set("codigo_uc")} placeholder="Ex: 0012345678" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome / Denominação *</Label>
            <Input value={form.nome} onChange={set("nome")} placeholder="Nome da unidade" />
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
          <div className="space-y-1.5">
            <Label className="text-xs">Grupo de Classificação</Label>
            <Select value={form.classificacao_grupo} onValueChange={set("classificacao_grupo")}>
              <SelectTrigger><SelectValue placeholder="Ex: B1" /></SelectTrigger>
              <SelectContent>
                {GRUPOS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Subgrupo</Label>
            <Input value={form.classificacao_subgrupo} onChange={set("classificacao_subgrupo")} placeholder="Ex: Residencial" />
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

          {/* Address */}
          <div className="col-span-full">
            <p className="text-xs font-medium text-muted-foreground mb-2 mt-2">Endereço</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CEP</Label>
            <Input value={form.cep} onChange={set("cep")} placeholder="00000-000" />
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <Label className="text-xs">Logradouro</Label>
            <Input value={form.logradouro} onChange={set("logradouro")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Número</Label>
            <Input value={form.numero} onChange={set("numero")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Complemento</Label>
            <Input value={form.complemento} onChange={set("complemento")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bairro</Label>
            <Input value={form.bairro} onChange={set("bairro")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cidade</Label>
            <Input value={form.cidade} onChange={set("cidade")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <Input value={form.estado} onChange={set("estado")} placeholder="UF" maxLength={2} />
          </div>

          <div className="col-span-full space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.observacoes} onChange={set("observacoes")} rows={3} />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : editingUC ? "Salvar" : "Criar UC"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
