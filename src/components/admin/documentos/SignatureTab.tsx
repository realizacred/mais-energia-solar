import { useState, useEffect } from "react";
import { formatPhone } from "@/lib/validations";
import { formatCpfCnpj } from "@/lib/cpfCnpjUtils";
import type React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Mail, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Signer, AuthMethod, SignatureSettings } from "./types";

// ── Shared helper ────────────────────────────────────────────
async function getTenantIdOrThrow(): Promise<{ tenantId: string; userId: string }> {
  const { data: profile } = await supabase.from("profiles").select("tenant_id").single();
  const tenantId = profile?.tenant_id;
  if (!tenantId) throw new Error("Tenant não encontrado");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Usuário não autenticado");
  return { tenantId, userId: user.id };
}

const PROVIDERS = [
  { value: "docusign", label: "DocuSign" },
  { value: "clicksign", label: "ClickSign" },
  { value: "zapsign", label: "ZapSign" },
  { value: "autentique", label: "Autentique" },
];

const AUTH_ICONS: Record<AuthMethod, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  whatsapp: <MessageCircle className="h-3.5 w-3.5" />,
  sms: <Phone className="h-3.5 w-3.5" />,
};

export function SignatureTab() {
  return (
    <div className="space-y-6">
      <SignatureConfig />
      <SignersList />
    </div>
  );
}

function SignatureConfig() {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState("zapsign");
  const [apiToken, setApiToken] = useState("");
  const [sandbox, setSandbox] = useState(true);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [hasExistingWebhook, setHasExistingWebhook] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["signature_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("signature_settings").select("tenant_id, enabled, provider, sandbox_mode, api_token_encrypted, webhook_secret_encrypted, updated_by").maybeSingle();
      if (error) throw error;
      return data as unknown as SignatureSettings | null;
    },
  });

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setProvider(settings.provider || "zapsign");
      setSandbox(settings.sandbox_mode);
      // SECURITY: Never populate token fields with stored values
      setApiToken("");
      setWebhookSecret("");
      setHasExistingToken(!!settings.api_token_encrypted);
      setHasExistingWebhook(!!settings.webhook_secret_encrypted);
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const { tenantId, userId } = await getTenantIdOrThrow();

      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        enabled,
        provider,
        sandbox_mode: sandbox,
        updated_by: userId,
      };

      // Only update secrets if user typed a new value
      if (apiToken.trim()) {
        payload.api_token_encrypted = apiToken.trim();
      }
      if (webhookSecret.trim()) {
        payload.webhook_secret_encrypted = webhookSecret.trim();
      }

      if (settings) {
        const { error } = await supabase.from("signature_settings").update(payload).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("signature_settings").insert({
          ...payload,
          api_token_encrypted: apiToken.trim() || null,
          webhook_secret_encrypted: webhookSecret.trim() || null,
          created_by: userId,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signature_settings"] });
      toast.success("Configuração salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Configuração de Assinatura Eletrônica</CardTitle>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </CardHeader>
      {enabled && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Provedor</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value} className="text-sm">{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">API Token</Label>
              <Input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="h-9 text-sm"
                placeholder={hasExistingToken ? "•••••••• (salvo)" : "sk_live_..."}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={sandbox} onCheckedChange={setSandbox} />
              <Label className="text-xs">Modo Sandbox</Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Webhook Secret (opcional)</Label>
              <Input
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="h-9 text-sm"
                placeholder={hasExistingWebhook ? "•••••••• (salvo)" : "whsec_..."}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar configuração"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function SignersList() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Signer | null>(null);

  const { data: signers, isLoading } = useQuery({
    queryKey: ["signers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("signers").select("id, tenant_id, full_name, email, auth_method, cpf, birth_date, phone, options").order("full_name");
      if (error) throw error;
      return (data ?? []) as unknown as Signer[];
    },
  });

  const deleteSigner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("signers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signers"] });
      toast.success("Signatário removido");
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Signatários</CardTitle>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-3.5 w-3.5" /> Cadastrar signatário
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><LoadingSpinner /></div>
        ) : !signers || signers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhum signatário cadastrado</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">E-mail</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Método</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">CPF</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {signers.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{s.full_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.email}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant="outline" className="text-[10px] gap-1">
                        {AUTH_ICONS[s.auth_method]} {s.auth_method}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{s.cpf || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(s); setModalOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSigner.mutate(s.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <SignerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        signer={editing}
        onSaved={() => {
          setModalOpen(false);
          qc.invalidateQueries({ queryKey: ["signers"] });
        }}
      />
    </Card>
  );
}

// ── Signer Modal ──────────────────────────────────────────
interface SignerModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  signer: Signer | null;
  onSaved: () => void;
}

function SignerModal({ open, onOpenChange, signer, onSaved }: SignerModalProps) {
  const [authMethod, setAuthMethod] = useState<AuthMethod>("email");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [hasCpf, setHasCpf] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [docOficial, setDocOficial] = useState(false);
  const [selfie, setSelfie] = useState(false);
  const [manuscrita, setManuscrita] = useState(false);
  const [facial, setFacial] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (signer) {
      setAuthMethod(signer.auth_method);
      setEmail(signer.email);
      setFullName(signer.full_name);
      setCpf(signer.cpf || "");
      setHasCpf(!!signer.cpf);
      setBirthDate(signer.birth_date || "");
      setPhone(signer.phone || "");
      const opts = signer.options || {};
      setDocOficial(!!opts.doc_oficial);
      setSelfie(!!opts.selfie);
      setManuscrita(!!opts.manuscrita);
      setFacial(!!opts.facial);
    } else {
      setAuthMethod("email"); setEmail(""); setFullName(""); setCpf("");
      setHasCpf(false); setBirthDate(""); setPhone("");
      setDocOficial(false); setSelfie(false); setManuscrita(false); setFacial(false);
    }
  }, [signer, open]);

  const handleSave = async () => {
    if (!fullName.trim() || !email.trim()) { toast.error("Nome e e-mail obrigatórios"); return; }
    setSaving(true);
    try {
      const { tenantId, userId } = await getTenantIdOrThrow();

      const payload = {
        tenant_id: tenantId,
        auth_method: authMethod,
        email: email.trim(),
        full_name: fullName.trim(),
        cpf: hasCpf ? cpf.trim() || null : null,
        birth_date: birthDate || null,
        phone: phone.trim() || null,
        options: { doc_oficial: docOficial, selfie, manuscrita, facial },
        updated_by: userId,
      };

      if (signer?.id) {
        const { error } = await supabase.from("signers").update(payload).eq("id", signer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("signers").insert({ ...payload, created_by: userId } as any);
        if (error) throw error;
      }

      toast.success(signer ? "Signatário atualizado" : "Signatário cadastrado");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{signer ? "Editar signatário" : "Cadastrar signatário"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Método de autenticação</Label>
            <Select value={authMethod} onValueChange={(v) => setAuthMethod(v as AuthMethod)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email" className="text-sm">E-mail</SelectItem>
                <SelectItem value="whatsapp" className="text-sm">WhatsApp</SelectItem>
                <SelectItem value="sms" className="text-sm">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail *</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-sm" placeholder="email@exemplo.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome completo *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={hasCpf} onCheckedChange={(v) => setHasCpf(!!v)} />
            <Label className="text-xs">Signatário possui CPF</Label>
          </div>
          {hasCpf && (
            <div className="space-y-1.5">
              <Label className="text-xs">CPF</Label>
              <Input value={cpf} onChange={(e) => setCpf(formatCpfCnpj(e.target.value))} className="h-9 text-sm" placeholder="000.000.000-00" maxLength={14} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Data de nascimento</Label>
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Celular</Label>
            <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} className="h-9 text-sm" placeholder="(00) 00000-0000" maxLength={15} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Autenticações opcionais</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2"><Checkbox checked={docOficial} onCheckedChange={(v) => setDocOficial(!!v)} /><Label className="text-xs">Documento oficial</Label></div>
              <div className="flex items-center gap-2"><Checkbox checked={selfie} onCheckedChange={(v) => setSelfie(!!v)} /><Label className="text-xs">Selfie com documento</Label></div>
              <div className="flex items-center gap-2"><Checkbox checked={manuscrita} onCheckedChange={(v) => setManuscrita(!!v)} /><Label className="text-xs">Assinatura manuscrita</Label></div>
              <div className="flex items-center gap-2"><Checkbox checked={facial} onCheckedChange={(v) => setFacial(!!v)} /><Label className="text-xs">Reconhecimento facial</Label></div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Fechar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : signer ? "Salvar" : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
