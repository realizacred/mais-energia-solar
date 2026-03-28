/**
 * ClienteEditModal — modal de edição completa do cliente
 * Reutiliza hooks existentes (useSalvarCliente) e componentes (AddressFields, PhoneInput, etc.)
 * §25: w-[90vw], §36: scroll interno, RB-09: componentes existentes
 */
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui-kit/Spinner";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { EmailInput } from "@/components/ui-kit/inputs/EmailInput";
import { AddressFields } from "@/components/shared/AddressFields";
import { Users } from "lucide-react";
import { useSalvarCliente } from "@/hooks/useClientes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ClienteEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  onSaved?: () => void;
}

interface FormState {
  nome: string;
  telefone: string;
  email: string;
  cpf_cnpj: string;
  data_nascimento: string;
  cep: string;
  estado: string;
  cidade: string;
  bairro: string;
  rua: string;
  numero: string;
  complemento: string;
  observacoes: string;
}

const EMPTY_FORM: FormState = {
  nome: "", telefone: "", email: "", cpf_cnpj: "", data_nascimento: "",
  cep: "", estado: "", cidade: "", bairro: "", rua: "", numero: "", complemento: "",
  observacoes: "",
};

export function ClienteEditModal({ open, onOpenChange, clienteId, onSaved }: ClienteEditModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const salvarCliente = useSalvarCliente();
  const queryClient = useQueryClient();

  // Load client data when modal opens
  useEffect(() => {
    if (!open || !clienteId) return;
    setLoading(true);
    supabase
      .from("clientes")
      .select("nome, telefone, email, cpf_cnpj, data_nascimento, cep, estado, cidade, bairro, rua, numero, complemento, observacoes")
      .eq("id", clienteId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast({ title: "Erro ao carregar cliente", variant: "destructive" });
          onOpenChange(false);
          return;
        }
        setForm({
          nome: data.nome || "",
          telefone: data.telefone || "",
          email: data.email || "",
          cpf_cnpj: data.cpf_cnpj || "",
          data_nascimento: data.data_nascimento || "",
          cep: data.cep || "",
          estado: data.estado || "",
          cidade: data.cidade || "",
          bairro: data.bairro || "",
          rua: data.rua || "",
          numero: data.numero || "",
          complemento: data.complemento || "",
          observacoes: data.observacoes || "",
        });
        setLoading(false);
      });
  }, [open, clienteId]);

  const handleSubmit = async () => {
    if (!form.nome || !form.telefone) {
      toast({ title: "Nome e telefone são obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await salvarCliente.mutateAsync({
        id: clienteId,
        data: {
          nome: form.nome,
          telefone: form.telefone,
          email: form.email || null,
          cpf_cnpj: form.cpf_cnpj || null,
          data_nascimento: form.data_nascimento || null,
          cep: form.cep || null,
          estado: form.estado || null,
          cidade: form.cidade || null,
          bairro: form.bairro || null,
          rua: form.rua || null,
          numero: form.numero || null,
          complemento: form.complemento || null,
          observacoes: form.observacoes || null,
        },
      });
      toast({ title: "Cliente atualizado!" });
      // Invalidate deal queries to refresh customer data in ProjetoDetalhe
      queryClient.invalidateQueries({ queryKey: ["deal-detail"] });
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* §25 Header */}
        <DialogHeader className="flex flex-row items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-bold text-foreground">
              Editar Cliente
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Atualize os dados cadastrais do cliente</p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="md" />
            </div>
          ) : (
            <div className="px-4 py-3.5 space-y-4">
              {/* Dados Pessoais */}
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Dados pessoais</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Nome <span className="text-destructive">*</span></Label>
                    <Input
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Telefone <span className="text-destructive">*</span></Label>
                    <PhoneInput
                      value={form.telefone}
                      onChange={(raw) => setForm({ ...form, telefone: raw })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">E-mail</Label>
                    <EmailInput
                      value={form.email}
                      onChange={(v) => setForm({ ...form, email: v })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">CPF/CNPJ</Label>
                    <CpfCnpjInput
                      value={form.cpf_cnpj}
                      onChange={(v) => setForm({ ...form, cpf_cnpj: v })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Data de Nascimento</Label>
                    <DateInput
                      value={form.data_nascimento}
                      onChange={(v) => setForm({ ...form, data_nascimento: v })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-2.5 border-t border-border pt-3.5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Endereço</p>
                <AddressFields
                  value={{
                    cep: form.cep,
                    rua: form.rua,
                    numero: form.numero,
                    complemento: form.complemento,
                    bairro: form.bairro,
                    cidade: form.cidade,
                    estado: form.estado,
                  }}
                  onChange={(addr) => {
                    setForm(prev => ({
                      ...prev,
                      cep: addr.cep,
                      rua: addr.rua,
                      numero: addr.numero,
                      complemento: addr.complemento,
                      bairro: addr.bairro,
                      cidade: addr.cidade,
                      estado: addr.estado,
                    }));
                  }}
                />
              </div>

              {/* Observações */}
              <div className="space-y-1 border-t border-border pt-3.5">
                <Label className="text-[11px] font-medium text-muted-foreground">Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  rows={2}
                  className="text-sm min-h-[48px] resize-y"
                />
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-muted/30 shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || loading}>
            {saving && <Spinner size="sm" className="mr-1.5" />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
