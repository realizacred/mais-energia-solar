/**
 * ApiConfigDialog — Create/Edit API integration config.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { integrationApiService, type IntegrationApiConfig } from "@/services/integrationApiService";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editingConfig: IntegrationApiConfig | null;
  onSuccess: () => void;
}

const TUYA_REGIONS = [
  { value: "https://openapi.tuyaus.com", label: "América Ocidental (US) — Recomendado para Brasil" },
  { value: "https://openapi-ueaz.tuyaus.com", label: "América Oriental (US-East)" },
  { value: "https://openapi.tuyaeu.com", label: "Europa Central (EU)" },
  { value: "https://openapi-weaz.tuyaeu.com", label: "Europa Ocidental (EU-West)" },
  { value: "https://openapi.tuyacn.com", label: "China (CN)" },
  { value: "https://openapi.tuyain.com", label: "Índia (IN)" },
  { value: "https://openapi-sg.tuyaus.com", label: "Singapura (SG)" },
];

export function ApiConfigDialog({ open, onOpenChange, editingConfig, onSuccess }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [form, setForm] = useState({
    provider: "tuya",
    name: "",
    region: "",
    base_url: "",
    client_id: "",
    client_secret: "",
  });

  const isEdit = !!editingConfig;

  useEffect(() => {
    if (editingConfig) {
      setForm({
        provider: editingConfig.provider,
        name: editingConfig.name,
        region: editingConfig.region || "",
        base_url: editingConfig.base_url || "",
        client_id: "", // masked, user must re-enter to change
        client_secret: "",
      });
    } else {
      setForm({ provider: "tuya", name: "", region: "", base_url: TUYA_REGIONS[0].value, client_id: "", client_secret: "" });
    }
    setShowSecret(false);
  }, [editingConfig, open]);

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Informe o nome da conexão", variant: "destructive" });
      return;
    }
    if (!isEdit && (!form.client_id.trim() || !form.client_secret.trim())) {
      toast({ title: "Preencha as credenciais", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const updates: any = {
          name: form.name.trim(),
          region: form.region || null,
          base_url: form.base_url || null,
        };
        // Only update credentials if user provided new values
        if (form.client_id.trim() && form.client_secret.trim()) {
          updates.credentials = { client_id: form.client_id.trim(), client_secret: form.client_secret.trim() };
        }
        await integrationApiService.update(editingConfig!.id, updates);
        toast({ title: "Integração atualizada" });
      } else {
        await integrationApiService.create({
          provider: form.provider,
          name: form.name.trim(),
          region: form.region || null,
          base_url: form.base_url || null,
          credentials: { client_id: form.client_id.trim(), client_secret: form.client_secret.trim() },
        });
        toast({ title: "Integração criada" });
      }
      onSuccess();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Integração" : "Nova Integração de API"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Provedor</Label>
              <Select value={form.provider} onValueChange={(v) => setForm(f => ({ ...f, provider: v }))} disabled={isEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tuya">Tuya Smart</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da conexão *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Tuya Produção" />
            </div>
          </div>

          {form.provider === "tuya" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Região / Base URL</Label>
              <Select value={form.base_url} onValueChange={(v) => setForm(f => ({ ...f, base_url: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a região" /></SelectTrigger>
                <SelectContent>
                  {TUYA_REGIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Credenciais {isEdit && "(deixe em branco para manter as atuais)"}</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Client ID / Access ID</Label>
              <Input value={form.client_id} onChange={(e) => setForm(f => ({ ...f, client_id: e.target.value }))} placeholder={isEdit ? "••••••••" : "Insira o Client ID"} autoComplete="new-password" data-lpignore="true" data-form-type="other" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client Secret / Access Secret</Label>
              <div className="relative">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={form.client_secret}
                  onChange={(e) => setForm(f => ({ ...f, client_secret: e.target.value }))}
                  placeholder={isEdit ? "••••••••" : "Insira o Client Secret"}
                  className="pr-10"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-form-type="other"
                />
                <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : isEdit ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
