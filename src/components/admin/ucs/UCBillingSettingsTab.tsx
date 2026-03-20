/**
 * UCBillingSettingsTab — Billing email settings + service config for a UC.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoiceService, type BillingEmailSettings, type BillingNotificationChannel } from "@/services/invoiceService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Info, Eye, EyeOff, CalendarClock, Bell, Settings2 } from "lucide-react";

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
    dia_leitura: "" as string,
    dias_antecedencia_alerta: "1",
    canal_notificacao: "whatsapp" as BillingNotificationChannel,
    servico_fatura_ativo: false,
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["billing_settings", unitId],
    queryFn: () => invoiceService.getBillingSettings(unitId),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        billing_capture_email: settings.billing_capture_email || "",
        forward_to_email: settings.forward_to_email || "",
        pdf_password: "",
        email_billing_enabled: settings.email_billing_enabled,
        notes: settings.notes || "",
        dia_leitura: settings.dia_leitura != null ? String(settings.dia_leitura) : "",
        dias_antecedencia_alerta: String(settings.dias_antecedencia_alerta ?? 1),
        canal_notificacao: settings.canal_notificacao || "whatsapp",
        servico_fatura_ativo: settings.servico_fatura_ativo ?? false,
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
      dia_leitura: form.dia_leitura ? parseInt(form.dia_leitura, 10) : null,
      dias_antecedencia_alerta: parseInt(form.dias_antecedencia_alerta, 10) || 1,
      canal_notificacao: form.canal_notificacao,
      servico_fatura_ativo: form.servico_fatura_ativo,
    } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing_settings", unitId] });
      toast({ title: "Configurações salvas" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err?.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  // Compute next reading date for display
  const nextReadingDisplay = (() => {
    if (!form.dia_leitura) return null;
    const dia = parseInt(form.dia_leitura, 10);
    if (isNaN(dia) || dia < 1 || dia > 31) return null;
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), dia);
    const nextDate = thisMonth > now ? thisMonth : new Date(now.getFullYear(), now.getMonth() + 1, dia);
    return nextDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  })();

  return (
    <div className="space-y-4">
      {/* Card: Serviço de Gestão de Faturas */}
      <Card className="border-l-[3px] border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" /> Serviço de Gestão de Faturas
            </CardTitle>
            <Switch
              checked={form.servico_fatura_ativo}
              onCheckedChange={(v) => setForm(f => ({ ...f, servico_fatura_ativo: v }))}
            />
          </div>
          <CardDescription>Ative para habilitar registro mensal, alertas e relatórios para esta UC</CardDescription>
        </CardHeader>
        {form.servico_fatura_ativo && (
          <CardContent className="space-y-4 pt-0">
            <Separator />

            {/* Dia da leitura */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" /> Dia da leitura mensal
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.dia_leitura}
                  onChange={(e) => setForm(f => ({ ...f, dia_leitura: e.target.value }))}
                  placeholder="Ex: 15"
                />
                {nextReadingDisplay && (
                  <p className="text-xs text-muted-foreground">
                    Próxima leitura: <span className="font-medium text-foreground">{nextReadingDisplay}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Bell className="w-3 h-3" /> Dias de antecedência
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={15}
                  value={form.dias_antecedencia_alerta}
                  onChange={(e) => setForm(f => ({ ...f, dias_antecedencia_alerta: e.target.value }))}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">Avisar X dias antes da leitura</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Canal de notificação</Label>
                <Select
                  value={form.canal_notificacao}
                  onValueChange={(v) => setForm(f => ({ ...f, canal_notificacao: v as BillingNotificationChannel }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Card: Info */}
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

      {/* Card: Faturas por E-mail */}
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
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 h-auto w-auto p-0 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
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