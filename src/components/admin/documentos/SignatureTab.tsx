import { useState, useEffect } from "react";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import type React from "react";
import {
  useSignatureSettings,
  useSigners,
  useSaveSignatureSettings,
  useDeleteSigner,
  useSaveSigner,
} from "@/hooks/useSignatureData";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Mail, Phone, MessageCircle, Copy, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { EmailInput } from "@/components/ui/EmailInput";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Signer, AuthMethod } from "./types";

const PROVIDERS = [
  { value: "clicksign", label: "ClickSign" },
  { value: "zapsign", label: "ZapSign" },
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
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState("zapsign");
  const [apiToken, setApiToken] = useState("");
  const [sandbox, setSandbox] = useState(true);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [hasExistingWebhook, setHasExistingWebhook] = useState(false);

  const { data: settings, isLoading } = useSignatureSettings();
  const save = useSaveSignatureSettings();

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

  const handleSave = () => {
    save.mutate(
      { settings: settings ?? null, enabled, provider, sandbox, apiToken, webhookSecret },
      {
        onSuccess: () => toast.success("Configuração salva"),
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  if (isLoading) return (
    <Card className="p-6 space-y-4">
      <Skeleton className="h-5 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
      </div>
    </Card>
  );

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
          {/* Webhook URL */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Link className="h-3 w-3" />
              URL do Webhook (configurar no Clicksign/ZapSign)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signature-webhook`}
                className="h-9 text-sm font-mono text-muted-foreground bg-muted/50"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signature-webhook`
                  );
                  toast.success("URL copiada!");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar configuração"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function SignersList() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Signer | null>(null);

  const { data: signers, isLoading } = useSigners();
  const deleteSigner = useDeleteSigner();

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
          <div className="space-y-2 py-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
          </div>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteSigner.mutate(s.id, {
                            onSuccess: () => toast.success("Signatário removido"),
                          })}
                        >
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
        onSaved={() => setModalOpen(false)}
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

  const saveSigner = useSaveSigner();

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

  const handleSave = () => {
    if (!fullName.trim() || !email.trim()) { toast.error("Nome e e-mail obrigatórios"); return; }

    const payload = {
      auth_method: authMethod,
      email: email.trim(),
      full_name: fullName.trim(),
      cpf: hasCpf ? cpf.trim() || null : null,
      birth_date: birthDate || null,
      phone: phone.trim() || null,
      options: { doc_oficial: docOficial, selfie, manuscrita, facial },
    };

    saveSigner.mutate(
      { signerId: signer?.id, payload },
      {
        onSuccess: () => {
          toast.success(signer ? "Signatário atualizado" : "Signatário cadastrado");
          onSaved();
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md">
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
            <EmailInput value={email} onChange={setEmail} required className="h-9 text-sm" />
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
            <CpfCnpjInput
              value={cpf}
              onChange={setCpf}
              label="CPF"
              showValidation
            />
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Data de nascimento</Label>
            <DateInput value={birthDate} onChange={setBirthDate} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Celular</Label>
            <PhoneInput value={phone} onChange={setPhone} className="h-9 text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Autenticações opcionais</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2"><Checkbox checked={docOficial} onCheckedChange={(v) => setDocOficial(!!v)} /><Label className="text-xs">Documento oficial</Label></div>
              <div className="flex items-center gap-2"><Checkbox checked={selfie} onCheckedChange={(v) => setSelfie(!!v)} /><Label className="text-xs">Selfie com documento</Label></div>
              <div className="flex items-center gap-2"><Checkbox checked={manuscrita} onCheckedChange={(v) => setManuscrita(!!v)} /><Label className="text-xs">Assinatura manuscrita</Label></div>
              <div className="flex items-center gap-2"><Checkbox checked={facial} onCheckedChange={(v) => setFacial(!!v)} /><Label className="text-xs">Reconhecimento facial</Label></div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saveSigner.isPending}>Fechar</Button>
          <Button onClick={handleSave} disabled={saveSigner.isPending}>{saveSigner.isPending ? "Salvando…" : signer ? "Salvar" : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
