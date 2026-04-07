/**
 * Modal de envio para assinatura eletrônica.
 * Exibe signatários pré-resolvidos (Contratante/Contratada) e permite editar antes de enviar.
 * §25: modal com w-[90vw] — RB-07
 * §DS-06: formulários em grid
 */

import { useState, useEffect } from "react";
import { Send, Loader2, UserCheck, Building2, AlertTriangle, Plus, Trash2, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import type { GeneratedDocRow } from "@/hooks/useProjetoDocumentos";

export interface SignerEntry {
  name: string;
  email: string;
  cpf?: string;
  phone?: string;
  role: "contratante" | "contratada" | "testemunha";
}

interface SignatureModalProps {
  open: boolean;
  onClose: () => void;
  doc: GeneratedDocRow | null;
  dealId: string;
  onSend: (signers: SignerEntry[]) => void;
  isPending: boolean;
}

const ROLE_LABELS: Record<string, { label: string; icon: typeof User }> = {
  contratante: { label: "Contratante", icon: UserCheck },
  contratada: { label: "Contratada", icon: Building2 },
  testemunha: { label: "Testemunha", icon: User },
};

export function SignatureModal({ open, onClose, doc, dealId, onSend, isPending }: SignatureModalProps) {
  const [signers, setSigners] = useState<SignerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Auto-resolve signers when modal opens
  useEffect(() => {
    if (!open || !doc) return;
    resolveSigners();
  }, [open, doc?.id]);

  const resolveSigners = async () => {
    setLoading(true);
    setWarnings([]);
    const resolved: SignerEntry[] = [];
    const warns: string[] = [];

    try {
      const { tenantId } = await getCurrentTenantId();

      // 1. Resolve Contratante (client)
      // dealId is a deals.id — resolve customer via multiple fallback paths
      let clienteId: string | null = null;

      // Path A: deals.customer_id (most direct)
      const { data: deal } = await supabase
        .from("deals")
        .select("customer_id, projeto_id")
        .eq("id", dealId)
        .maybeSingle();

      if (deal?.customer_id) {
        clienteId = deal.customer_id;
      }

      // Path B: deals.projeto_id → projetos.cliente_id
      if (!clienteId && deal?.projeto_id) {
        const { data: projeto } = await supabase
          .from("projetos")
          .select("cliente_id")
          .eq("id", deal.projeto_id)
          .maybeSingle();
        clienteId = projeto?.cliente_id || null;
      }

      // Path C: generated_documents.deal_id → propostas_nativas → cliente_id
      if (!clienteId && doc?.deal_id) {
        const { data: proposta } = await supabase
          .from("propostas_nativas")
          .select("cliente_id")
          .or(`deal_id.eq.${doc.deal_id},projeto_id.eq.${doc.deal_id}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        clienteId = proposta?.cliente_id || null;
      }

      if (clienteId) {
        const { data: cliente } = await supabase
          .from("clientes")
          .select("nome, email, cpf_cnpj, telefone")
          .eq("id", clienteId)
          .maybeSingle();

        if (cliente) {
          resolved.push({
            name: cliente.nome || "",
            email: cliente.email || "",
            cpf: cliente.cpf_cnpj || "",
            phone: cliente.telefone || "",
            role: "contratante",
          });
          if (!cliente.email) {
            warns.push("Cliente sem e-mail cadastrado. Preencha antes de enviar.");
          }
        }
      } else {
        warns.push("Cliente não encontrado para este projeto.");
      }

      // 2. Resolve Contratada (representative from brand_settings)
      const { data: brand } = await supabase
        .from("brand_settings")
        .select("representante_legal, representante_email, representante_cpf, representante_cargo")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (brand?.representante_legal) {
        resolved.push({
          name: brand.representante_legal,
          email: brand.representante_email || "",
          cpf: brand.representante_cpf || "",
          role: "contratada",
        });
        if (!brand.representante_email) {
          warns.push("Representante legal sem e-mail. Configure em Configurações → Representante Legal.");
        }
      } else {
        warns.push("Representante legal não configurado. Configure em Configurações → Representante Legal.");
      }

      setSigners(resolved);
      setWarnings(warns);
    } catch {
      setWarnings(["Erro ao carregar dados dos signatários."]);
    } finally {
      setLoading(false);
    }
  };

  const updateSigner = (index: number, field: keyof SignerEntry, value: string) => {
    setSigners(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const removeSigner = (index: number) => {
    setSigners(prev => prev.filter((_, i) => i !== index));
  };

  const addSigner = () => {
    setSigners(prev => [...prev, { name: "", email: "", role: "testemunha" }]);
  };

  const canSend = signers.length > 0 && signers.every(s => s.name.trim() && s.email.trim());

  const handleSend = () => {
    if (!canSend) return;
    onSend(signers);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[90vw] max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Enviar para assinatura eletrônica
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {doc?.title} — Confirme os signatários antes de enviar
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto min-h-0">
          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-1.5">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Signers List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando signatários...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {signers.map((signer, idx) => {
                const RoleIcon = ROLE_LABELS[signer.role]?.icon || User;
                return (
                  <div key={idx} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RoleIcon className="h-4 w-4 text-primary" />
                        <Badge variant="outline" className="text-xs">
                          {ROLE_LABELS[signer.role]?.label || signer.role}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeSigner(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo *</Label>
                        <Select
                          value={signer.role}
                          onValueChange={(v) => updateSigner(idx, "role", v)}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contratante">Contratante</SelectItem>
                            <SelectItem value="contratada">Contratada</SelectItem>
                            <SelectItem value="testemunha">Testemunha</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nome completo *</Label>
                        <Input
                          className="h-9 text-sm"
                          value={signer.name}
                          onChange={(e) => updateSigner(idx, "name", e.target.value)}
                          placeholder="Nome do signatário"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">E-mail *</Label>
                        <Input
                          className="h-9 text-sm"
                          type="email"
                          value={signer.email}
                          onChange={(e) => updateSigner(idx, "email", e.target.value)}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">CPF</Label>
                        <Input
                          className="h-9 text-sm"
                          value={signer.cpf || ""}
                          onChange={(e) => updateSigner(idx, "cpf", e.target.value)}
                          placeholder="000.000.000-00"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <Button
                variant="outline"
                className="w-full gap-1.5"
                onClick={addSigner}
              >
                <Plus className="h-4 w-4" />
                Adicionar signatário
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend || isPending || loading}
            className="gap-1.5"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isPending ? "Enviando..." : "Enviar para assinatura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
