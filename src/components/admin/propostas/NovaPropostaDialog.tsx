import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PropostaFormData } from "@/hooks/usePropostas";

interface Vendedor {
  id: string;
  nome: string;
}

interface NovaPropostaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PropostaFormData) => Promise<boolean>;
  creating: boolean;
}

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export function NovaPropostaDialog({
  open,
  onOpenChange,
  onSubmit,
  creating,
}: NovaPropostaDialogProps) {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [form, setForm] = useState<PropostaFormData>({
    nome: "",
    cliente_nome: "",
    cliente_celular: "",
    cliente_cidade: "",
    cliente_estado: "",
    cliente_email: "",
    potencia_kwp: 0,
    numero_modulos: 0,
    modelo_modulo: "",
    modelo_inversor: "",
    preco_total: 0,
    economia_mensal: 0,
    geracao_mensal_kwh: 0,
    payback_anos: 0,
    distribuidora: "",
    vendedor_id: "",
  });

  useEffect(() => {
    if (open) {
      (supabase as any)
        .from("consultores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome")
        .then(({ data }: any) => setVendedores(data || []));
    }
  }, [open]);

  const handleChange = (field: keyof PropostaFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.nome.trim() || !form.cliente_nome.trim()) return;
    const success = await onSubmit(form);
    if (success) {
      onOpenChange(false);
      setForm({
        nome: "",
        cliente_nome: "",
        cliente_celular: "",
        cliente_cidade: "",
        cliente_estado: "",
        cliente_email: "",
        potencia_kwp: 0,
        numero_modulos: 0,
        modelo_modulo: "",
        modelo_inversor: "",
        preco_total: 0,
        economia_mensal: 0,
        geracao_mensal_kwh: 0,
        payback_anos: 0,
        distribuidora: "",
        vendedor_id: "",
      });
    }
  };

  const isValid = form.nome.trim() && form.cliente_nome.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Proposta</DialogTitle>
          <DialogDescription>
            Preencha os dados para criar uma proposta comercial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nome da proposta */}
          <div className="space-y-1.5">
            <Label>Nome da Proposta *</Label>
            <Input
              placeholder="Ex: Proposta Solar - João Silva"
              value={form.nome}
              onChange={(e) => handleChange("nome", e.target.value)}
            />
          </div>

          {/* Dados do cliente */}
          <div className="border rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Dados do Cliente
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  placeholder="Nome completo"
                  value={form.cliente_nome}
                  onChange={(e) => handleChange("cliente_nome", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Celular</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={form.cliente_celular}
                  onChange={(e) => handleChange("cliente_celular", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  placeholder="cliente@email.com"
                  value={form.cliente_email}
                  onChange={(e) => handleChange("cliente_email", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input
                  placeholder="Cidade"
                  value={form.cliente_cidade}
                  onChange={(e) => handleChange("cliente_cidade", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={form.cliente_estado}
                  onValueChange={(v) => handleChange("cliente_estado", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Dados técnicos */}
          <div className="border rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Sistema Fotovoltaico
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Potência (kWp)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.potencia_kwp || ""}
                  onChange={(e) => handleChange("potencia_kwp", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nº Módulos</Label>
                <Input
                  type="number"
                  value={form.numero_modulos || ""}
                  onChange={(e) => handleChange("numero_modulos", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Módulo</Label>
                <Input
                  placeholder="Ex: Canadian 550W"
                  value={form.modelo_modulo}
                  onChange={(e) => handleChange("modelo_modulo", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Inversor</Label>
                <Input
                  placeholder="Ex: Growatt 5kW"
                  value={form.modelo_inversor}
                  onChange={(e) => handleChange("modelo_inversor", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Distribuidora</Label>
                <Input
                  placeholder="Ex: CEMIG"
                  value={form.distribuidora}
                  onChange={(e) => handleChange("distribuidora", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Geração (kWh/mês)</Label>
                <Input
                  type="number"
                  value={form.geracao_mensal_kwh || ""}
                  onChange={(e) => handleChange("geracao_mensal_kwh", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Financeiro */}
          <div className="border rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Financeiro
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Preço Total (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.preco_total || ""}
                  onChange={(e) => handleChange("preco_total", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Economia Mensal (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.economia_mensal || ""}
                  onChange={(e) => handleChange("economia_mensal", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payback (anos)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.payback_anos || ""}
                  onChange={(e) => handleChange("payback_anos", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Consultor</Label>
                <Select
                  value={form.vendedor_id}
                  onValueChange={(v) => handleChange("vendedor_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendedores.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={creating || !isValid}>
            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Proposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
