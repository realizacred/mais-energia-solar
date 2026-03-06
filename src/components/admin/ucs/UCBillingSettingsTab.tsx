/**
 * UCBillingSettingsTab — Billing email settings for a UC.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoiceService, type BillingEmailSettings } from "@/services/invoiceService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Info, Eye, EyeOff } from "lucide-react";

interface Props {
  unitId: string;
}

export function UCBillingSettingsTab({ unitId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    billing_capture_email: "",
    forward_to_email: "",
    pdf_password: "",
    email_billing_enabled: false,
    notes: "",
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["billing_settings", unitId],
    queryFn: () => invoiceService.getBillingSettings(unitId),
  });

  useEffect(() => {
    if (settings) {
      setForm({
        billing_capture_email: settings.billing_capture_email || "",
        forward_to_email: settings.forward_to_email || "",
        pdf_password: settings.pdf_password || "",
        email_billing_enabled: settings.email_billing_enabled,
        notes: settings.notes || "",
      });
    }
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: () => invoiceService.upsertBillingSettings(unitId, {
      billing_capture_email: form.billing_capture_email || null,
      forward_to_email: form.forward_to_email || null,
      pdf_password: form.pdf_password || null,
      email_billing_enabled: form.email_billing_enabled,
      setup_status: form.email_billing_enabled ? "active" : "pending",
      notes: form.notes || null,
    } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing_settings", unitId] });
      toast({ title: "Configurações de fatura salvas" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err?.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <Card className="border-info/20 bg-info/5">
        <CardContent className="flex items-start gap-3 py-4">
          <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>E-mail para cadastro na concessionária:</strong> é o endereço que deve ser cadastrado na concessionária para recebimento das faturas digitais.</p>
            <p><strong>E-mail de encaminhamento:</strong> endereço do cliente que receberá o repasse da fatura, quando configurado.</p>
            <p className="text-xs">Esse processo vale para novas faturas após a ativação. Faturas antigas podem precisar de upload manual.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" /> Faturas por E-mail</CardTitle>
          <CardDescription>Configure o recebimento automático de faturas da concessionária</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Ativar faturas por e-mail</Label>
            <Switch checked={form.email_billing_enabled} onCheckedChange={(v) => setForm(f => ({ ...f, email_billing_enabled: v }))} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">E-mail para cadastro na concessionária</Label>
            <Input value={form.billing_capture_email} onChange={(e) => setForm(f => ({ ...f, billing_capture_email: e.target.value }))} placeholder="fatura-uc-xxx@seudominio.com" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">E-mail de encaminhamento</Label>
            <Input value={form.forward_to_email} onChange={(e) => setForm(f => ({ ...f, forward_to_email: e.target.value }))} placeholder="cliente@email.com" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Lock className="w-3 h-3" /> Senha para abrir PDF da fatura</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.pdf_password}
                onChange={(e) => setForm(f => ({ ...f, pdf_password: e.target.value }))}
                placeholder="Senha do PDF (ex: CPF do titular)"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>

          {settings && (
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <StatusBadge variant={settings.setup_status === "active" ? "success" : settings.setup_status === "error" ? "destructive" : "warning"} dot>
                {settings.setup_status === "active" ? "Ativo" : settings.setup_status === "error" ? "Erro" : "Pendente"}
              </StatusBadge>
            </div>
          )}

          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="w-full sm:w-auto">
            {saveMut.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
