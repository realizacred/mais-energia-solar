/**
 * WaSaveContactModal — Salvar contato a partir de uma conversa WhatsApp.
 *
 * Fluxo (RB-76, SSOT):
 * 1. Pré-preenche nome/telefone vindos da conversa.
 * 2. Faz dedup paralelo em leads + clientes via telefone normalizado / e-mail / CPF / nome.
 * 3. Permite "Usar este" para vincular à conversa sem duplicar.
 * 4. Permite criar novo Lead OU novo Cliente (escolha do usuário).
 * 5. Após salvar, vincula automaticamente em wa_conversations.lead_id/cliente_id
 *    e invalida queries — sem window.location.reload, sem window.open.
 *
 * Reutiliza: PhoneInput, CpfCnpjInput, EmailInput, useClientesList, ui/Dialog.
 * Não cria novo backend. Não duplica catálogo.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Building2, AlertTriangle, Loader2, CheckCircle2, Search } from "lucide-react";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import { EmailInput } from "@/components/ui/EmailInput";
import { onlyDigits, isValidCpfCnpj } from "@/lib/cpfCnpjUtils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Mode = "lead" | "cliente";

interface Match {
  id: string;
  nome: string;
  telefone: string | null;
  email?: string | null;
  type: "lead" | "cliente";
  matchField: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conversationId: string | null;
  initialPhone?: string | null;   // E.164 ou bruto
  initialName?: string | null;
  onLinked: (link: { leadId: string | null; clienteId: string | null }) => void;
}

const stripCountry = (raw: string) => {
  const d = onlyDigits(raw || "");
  return d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
};

const variantsFor = (digits: string): string[] => {
  const out = new Set<string>();
  if (digits) out.add(digits);
  // 11 dígitos com 9 → também sem 9
  if (digits.length === 11 && digits[2] === "9") out.add(digits.slice(0, 2) + digits.slice(3));
  // 10 dígitos → também com 9
  if (digits.length === 10) out.add(digits.slice(0, 2) + "9" + digits.slice(2));
  // últimos 8 como fallback
  if (digits.length >= 8) out.add(digits.slice(-8));
  return [...out];
};

export function WaSaveContactModal({
  open, onOpenChange, conversationId, initialPhone, initialName, onLinked,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>("lead");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(initialName?.trim() || "");
    setTelefone(stripCountry(initialPhone || ""));
    setEmail("");
    setCpfCnpj("");
    setMode("lead");
  }, [open, initialPhone, initialName]);

  const phoneDigits = useMemo(() => onlyDigits(telefone), [telefone]);
  const phoneVariants = useMemo(() => variantsFor(phoneDigits), [phoneDigits]);

  // Dedup paralelo em leads + clientes
  const { data: matches = [], isFetching: dedupLoading } = useQuery({
    queryKey: ["wa-save-contact-dedup", phoneVariants, email.trim().toLowerCase(), onlyDigits(cpfCnpj), nome.trim().toLowerCase()],
    queryFn: async (): Promise<Match[]> => {
      const out: Match[] = [];
      const normEmail = email.trim().toLowerCase();
      const normCpf = onlyDigits(cpfCnpj);
      const normNome = nome.trim();

      const orFilters = (target: "lead" | "cliente") => {
        const f: string[] = [];
        for (const v of phoneVariants) {
          if (v.length >= 8) {
            f.push(`telefone_normalized.ilike.%${v}%`);
            f.push(`telefone.ilike.%${v}%`);
          }
        }
        if (normEmail.length >= 5) f.push(`email.ilike.${normEmail}`);
        if (target === "cliente" && normCpf.length >= 11) f.push(`cpf_cnpj.ilike.%${normCpf}%`);
        if (normNome.length >= 4) f.push(`nome.ilike.%${normNome}%`);
        return f;
      };

      const leadFilters = orFilters("lead");
      const cliFilters = orFilters("cliente");

      const [leadsRes, cliRes] = await Promise.all([
        leadFilters.length
          ? supabase.from("leads").select("id, nome, telefone, email").or([...new Set(leadFilters)].join(",")).limit(8)
          : Promise.resolve({ data: [], error: null } as any),
        cliFilters.length
          ? supabase.from("clientes").select("id, nome, telefone, email").or([...new Set(cliFilters)].join(",")).limit(8)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const matchField = phoneDigits.length >= 8 ? "Telefone" : normEmail ? "E-mail" : normCpf ? "CPF/CNPJ" : "Nome";
      for (const l of (leadsRes.data || []) as any[]) {
        out.push({ id: l.id, nome: l.nome, telefone: l.telefone, email: l.email, type: "lead", matchField });
      }
      for (const c of (cliRes.data || []) as any[]) {
        out.push({ id: c.id, nome: c.nome, telefone: c.telefone, email: c.email, type: "cliente", matchField });
      }
      return out;
    },
    enabled: open && (phoneDigits.length >= 8 || email.trim().length >= 5 || onlyDigits(cpfCnpj).length >= 11 || nome.trim().length >= 4),
    staleTime: 10 * 1000,
  });

  const cpfValid = !cpfCnpj || isValidCpfCnpj(cpfCnpj);
  const canSave = nome.trim().length >= 2 && phoneDigits.length >= 10 && cpfValid && !saving;

  const linkConversation = async (link: { leadId: string | null; clienteId: string | null }) => {
    if (conversationId) {
      const { error } = await supabase
        .from("wa_conversations")
        .update({ lead_id: link.leadId, cliente_id: link.clienteId })
        .eq("id", conversationId);
      if (error) throw error;
    }
    onLinked(link);
    await queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
  };

  const handleUseExisting = async (m: Match) => {
    setSaving(true);
    try {
      await linkConversation(
        m.type === "lead"
          ? { leadId: m.id, clienteId: null }
          : { leadId: null, clienteId: m.id },
      );
      toast({ title: "Contato vinculado", description: `${m.nome} vinculado à conversa.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao vincular", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (mode === "cliente") {
        const { data, error } = await supabase
          .from("clientes")
          .insert({
            nome: nome.trim(),
            telefone: telefone.trim(),
            email: email.trim() || null,
            cpf_cnpj: cpfCnpj.trim() || null,
            cliente_code: `CLI-${Date.now()}`,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ["clientes_list"] });
        await linkConversation({ leadId: null, clienteId: data.id });
        toast({ title: "Cliente criado", description: `${nome} cadastrado e vinculado.` });
      } else {
        // Lead — campos NOT NULL: estado, cidade, area, tipo_telhado, rede_atendimento,
        // media_consumo, consumo_previsto. Defaults mínimos seguros.
        const { data, error } = await supabase
          .from("leads")
          .insert({
            nome: nome.trim(),
            telefone: telefone.trim(),
            email: email.trim() || null,
            estado: "—",
            cidade: "—",
            area: 0,
            tipo_telhado: "—",
            rede_atendimento: "—",
            media_consumo: 0,
            consumo_previsto: 0,
            origem: "WhatsApp",
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ["leads"] });
        await linkConversation({ leadId: data.id, clienteId: null });
        toast({ title: "Lead criado", description: `${nome} cadastrado e vinculado.` });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Salvar contato
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vincule à conversa um lead ou cliente existente, ou crie um novo.
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            {/* Possíveis correspondências */}
            {(matches.length > 0 || dedupLoading) && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-warning">
                  {dedupLoading ? (
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span className="text-xs font-medium">
                    {dedupLoading ? "Buscando contatos existentes..." : "Possíveis correspondências"}
                  </span>
                </div>
                {!dedupLoading && matches.slice(0, 6).map((m) => (
                  <div key={`${m.type}-${m.id}`} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground truncate">
                      <strong>{m.nome}</strong>
                      <Badge variant="outline" className="ml-1.5 text-[10px]">
                        {m.type === "lead" ? "Lead" : "Cliente"}
                      </Badge>
                      <span className="ml-1.5 text-muted-foreground">· {m.matchField}</span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] shrink-0"
                      onClick={() => handleUseExisting(m)}
                      disabled={saving}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Usar este
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Tipo de cadastro */}
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="w-full">
                <TabsTrigger value="lead" className="flex-1 gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> Novo lead
                </TabsTrigger>
                <TabsTrigger value="cliente" className="flex-1 gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Novo cliente
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px]">Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" autoFocus />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Telefone *</Label>
                <PhoneInput value={telefone} onChange={setTelefone} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">E-mail</Label>
                <EmailInput value={email} onChange={setEmail} placeholder="email@exemplo.com" />
              </div>
              {mode === "cliente" && (
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px]">CPF/CNPJ</Label>
                  <CpfCnpjInput value={cpfCnpj} onChange={setCpfCnpj} />
                  {cpfCnpj && !cpfValid && (
                    <p className="text-[10px] text-destructive">CPF/CNPJ inválido</p>
                  )}
                </div>
              )}
            </div>

            {mode === "lead" && (
              <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                <Search className="w-3 h-3 mt-0.5 shrink-0" />
                Campos adicionais (cidade, consumo, área) podem ser preenchidos depois no cadastro do lead.
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!canSave}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? "Salvando..." : mode === "cliente" ? "Criar cliente e vincular" : "Criar lead e vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
