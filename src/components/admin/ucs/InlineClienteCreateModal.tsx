/**
 * InlineClienteCreateModal — Create a new client inline without leaving the UC form.
 * Includes duplicate detection by CPF/CNPJ, telefone and email.
 * §25: w-[90vw] obrigatório. §16: queries in hooks. RB-01: semantic colors.
 */
import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { UserPlus, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { ClienteOption } from "@/hooks/useFormSelects";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existingClientes: ClienteOption[];
  onCreated: (clienteId: string) => void;
}

interface DuplicateMatch {
  id: string;
  nome: string;
  campo: string;
  valor: string;
}

export function InlineClienteCreateModal({ open, onOpenChange, existingClientes, onCreated }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");

  // Duplicate detection against existing clients
  const duplicates = useMemo(() => {
    const matches: DuplicateMatch[] = [];
    if (!nome && !telefone && !email && !cpfCnpj) return matches;

    const normalize = (s: string) => (s || "").replace(/\D/g, "").toLowerCase();
    const normTel = normalize(telefone);
    const normCpf = normalize(cpfCnpj);
    const normEmail = (email || "").trim().toLowerCase();
    const normNome = (nome || "").trim().toLowerCase();

    for (const c of existingClientes) {
      if (normCpf.length >= 8 && normalize(c.cpf_cnpj || "") === normCpf) {
        matches.push({ id: c.id, nome: c.nome, campo: "CPF/CNPJ", valor: cpfCnpj });
      } else if (normTel.length >= 8 && normalize(c.telefone || "").includes(normTel)) {
        matches.push({ id: c.id, nome: c.nome, campo: "Telefone", valor: telefone });
      } else if (normEmail.length >= 5 && (c.email || "").trim().toLowerCase() === normEmail) {
        matches.push({ id: c.id, nome: c.nome, campo: "E-mail", valor: email });
      } else if (normNome.length >= 5 && (c.nome || "").trim().toLowerCase() === normNome) {
        matches.push({ id: c.id, nome: c.nome, campo: "Nome", valor: nome });
      }
    }
    return matches;
  }, [nome, telefone, email, cpfCnpj, existingClientes]);

  const canSave = nome.trim().length >= 2 && telefone.trim().length >= 8;

  const handleUseExisting = (clienteId: string) => {
    onCreated(clienteId);
    resetAndClose();
  };

  const handleCreate = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("clientes")
        .insert({
          nome: nome.trim(),
          telefone: telefone.trim(),
          email: email.trim() || null,
          cpf_cnpj: cpfCnpj.trim() || null,
          cliente_code: `CLI-${Date.now()}`, // trigger will override
        } as any)
        .select("id")
        .single();

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["clientes_list"] });
      toast({ title: "Cliente criado", description: `${nome} cadastrado com sucesso.` });
      onCreated(data.id);
      resetAndClose();
    } catch (err: any) {
      toast({ title: "Erro ao criar cliente", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetAndClose = () => {
    setNome(""); setTelefone(""); setEmail(""); setCpfCnpj("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else onOpenChange(o); }}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Cadastrar Novo Cliente
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Preencha os dados mínimos para vincular à UC
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            {/* Duplicate warnings */}
            {duplicates.length > 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-medium">Possíveis duplicados encontrados</span>
                </div>
                {duplicates.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">
                      <strong>{d.nome}</strong>
                      <Badge variant="outline" className="ml-1.5 text-[10px]">{d.campo}</Badge>
                    </span>
                    <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => handleUseExisting(d.id)}>
                      Usar este
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px]">Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" autoFocus />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Telefone *</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">CPF/CNPJ</Label>
                <Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px]">E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={resetAndClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!canSave || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? "Salvando..." : "Criar e Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
