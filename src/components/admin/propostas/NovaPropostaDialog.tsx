import { useState, useEffect, useCallback, useRef } from "react";
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
import { Spinner } from "@/components/ui-kit/Spinner";
import { Badge } from "@/components/ui/badge";
import { Search, UserCheck, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PropostaFormData } from "@/hooks/usePropostas";
import { cn } from "@/lib/utils";

interface Vendedor {
  id: string;
  nome: string;
}

interface FoundRecord {
  source: "cliente" | "lead";
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  cidade?: string | null;
  estado?: string | null;
  potencia_kwp?: number | null;
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

  // Phone lookup state
  const [phoneLookupResults, setPhoneLookupResults] = useState<FoundRecord[]>([]);
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false);
  const [phoneLookupDone, setPhoneLookupDone] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FoundRecord | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      (supabase as any)
        .from("consultores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome")
        .then(({ data }: any) => setVendedores(data || []));
    } else {
      // Reset on close
      setPhoneLookupResults([]);
      setPhoneLookupDone(false);
      setSelectedRecord(null);
    }
  }, [open]);

  const searchByPhone = useCallback(async (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneLookupResults([]);
      setPhoneLookupDone(false);
      return;
    }

    setPhoneLookupLoading(true);
    setPhoneLookupDone(false);
    try {
      // Search clientes
      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, nome, telefone, email, cidade, estado, potencia_kwp")
        .or(`telefone.ilike.%${digits.slice(-9)}%,telefone_normalized.ilike.%${digits.slice(-9)}%`)
        .limit(5);

      // Search leads
      const { data: leads } = await (supabase as any)
        .from("leads")
        .select("id, nome, telefone, email, cidade, estado")
        .ilike("telefone", `%${digits.slice(-9)}%`)
        .limit(5);

      const results: FoundRecord[] = [];

      (clientes || []).forEach((c: any) => {
        results.push({
          source: "cliente",
          id: c.id,
          nome: c.nome,
          telefone: c.telefone,
          email: c.email,
          cidade: c.cidade,
          estado: c.estado,
          potencia_kwp: c.potencia_kwp,
        });
      });

      (leads || []).forEach((l: any) => {
        // Avoid duplicates if same phone already found in clientes
        if (!results.some(r => r.telefone?.replace(/\D/g, "") === l.telefone?.replace(/\D/g, ""))) {
          results.push({
            source: "lead",
            id: l.id,
            nome: l.nome,
            telefone: l.telefone,
            email: l.email,
            cidade: l.cidade,
            estado: l.estado,
          });
        }
      });

      setPhoneLookupResults(results);
      setPhoneLookupDone(true);
    } catch (err) {
      console.error("Phone lookup error:", err);
      setPhoneLookupDone(true);
    } finally {
      setPhoneLookupLoading(false);
    }
  }, []);

  const handlePhoneChange = (value: string) => {
    handleChange("cliente_celular", value);
    setSelectedRecord(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchByPhone(value), 500);
  };

  const applyRecord = (record: FoundRecord) => {
    setSelectedRecord(record);
    setForm((prev) => ({
      ...prev,
      cliente_nome: record.nome || prev.cliente_nome,
      cliente_celular: record.telefone || prev.cliente_celular,
      cliente_email: record.email || prev.cliente_email,
      cliente_cidade: record.cidade || prev.cliente_cidade,
      cliente_estado: record.estado || prev.cliente_estado,
      potencia_kwp: record.potencia_kwp || prev.potencia_kwp,
    }));
    setPhoneLookupResults([]);
  };

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

            {/* Phone field with lookup */}
            <div className="space-y-1.5">
              <Label>Celular</Label>
              <div className="relative">
                <Input
                  placeholder="(00) 00000-0000"
                  value={form.cliente_celular}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="pr-8"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {phoneLookupLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Selected record indicator */}
              {selectedRecord && (
                <div className="flex items-center gap-1.5 text-[11px] text-success">
                  <UserCheck className="h-3 w-3" />
                  <span>
                    Dados preenchidos de {selectedRecord.source === "cliente" ? "cliente" : "lead"}: <strong>{selectedRecord.nome}</strong>
                  </span>
                </div>
              )}

              {/* Lookup results */}
              {phoneLookupResults.length > 0 && (
                <div className="border border-border rounded-lg bg-popover shadow-md overflow-hidden">
                  <div className="px-3 py-1.5 bg-muted/50 border-b border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Cadastros encontrados
                    </p>
                  </div>
                  {phoneLookupResults.map((record) => (
                    <button
                      key={`${record.source}-${record.id}`}
                      type="button"
                      onClick={() => applyRecord(record)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/40 last:border-b-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{record.nome}</p>
                          <p className="text-[10px] text-muted-foreground">{record.telefone}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] shrink-0",
                            record.source === "cliente"
                              ? "bg-success/10 text-success border-success/20"
                              : "bg-info/10 text-info border-info/20"
                          )}
                        >
                          {record.source === "cliente" ? "Cliente" : "Lead"}
                        </Badge>
                      </div>
                      {(record.cidade || record.email) && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {[record.cidade, record.estado].filter(Boolean).join(", ")}
                          {record.email && ` • ${record.email}`}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* No results */}
              {phoneLookupDone && phoneLookupResults.length === 0 && form.cliente_celular.replace(/\D/g, "").length >= 10 && !selectedRecord && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <AlertCircle className="h-3 w-3" />
                  <span>Nenhum cadastro encontrado para este telefone</span>
                </div>
              )}
            </div>

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
            {creating && <Spinner size="sm" className="mr-2" />}
            Criar Proposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
