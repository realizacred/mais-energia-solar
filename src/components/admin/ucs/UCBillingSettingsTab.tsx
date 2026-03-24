/**
 * UCBillingSettingsTab — Unified "Recebimento de Faturas" + Alertas config for a UC.
 * Merges: Serviço de Gestão de Faturas, Faturas por E-mail, Leitura Automática, Alertas.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoiceService, type BillingEmailSettings, type BillingNotificationChannel } from "@/services/invoiceService";
import { supabase } from "@/integrations/supabase/client";
import { usePlanGuard } from "@/components/plan";
import { useDirtyForm } from "@/hooks/useDirtyForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Info, Eye, EyeOff, CalendarClock, Bell, Settings2, Send, Phone, CheckCircle2, XCircle, AlertTriangle, RefreshCw, FileSearch } from "lucide-react";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { formatDateTime, formatDate } from "@/lib/dateUtils";
import { SettingsHelpCard } from "./SettingsHelpCard";

interface Props {
  unitId: string;
  leituraAutomaticaEmail?: boolean;
}

const MONTH_NAMES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function sourceLabel(source: string | null | undefined): string {
  if (!source) return "desconhecida";
  if (source === "email" || source === "gmail") return "e-mail";
  if (source === "manual" || source === "upload") return "upload manual";
  return source;
}

function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case "valid": return "Processada com sucesso";
    case "received": return "Recebida, aguardando processamento";
    case "divergent": return "Processada com divergências";
    case "review": return "Aguardando revisão";
    case "failed": return "Falha no processamento";
    default: return status || "Desconhecido";
  }
}

function statusVariant(status: string | null | undefined): "success" | "destructive" | "warning" {
  switch (status) {
    case "valid": return "success";
    case "failed": return "destructive";
    default: return "warning";
  }
}

export function UCBillingSettingsTab({ unitId, leituraAutomaticaEmail }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { guardLimit, LimitDialog } = usePlanGuard();
  const [showPassword, setShowPassword] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["billing_settings", unitId],
    queryFn: () => invoiceService.getBillingSettings(unitId),
    staleTime: 1000 * 60 * 5,
  });

  // Fetch last invoice for status display
  const { data: lastInvoice } = useQuery({
    queryKey: ["last_invoice_for_status", unitId],
    queryFn: async () => {
      const { data } = await supabase
        .from("unit_invoices")
        .select("id, created_at, reference_month, reference_year, status, source")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const defaultForm = {
    billing_capture_email: "",
    forward_to_email: "",
    pdf_password: "",
    email_billing_enabled: false,
    notes: "",
    dia_leitura: "" as string,
    dias_antecedencia_alerta: "1",
    canal_notificacao: "whatsapp" as BillingNotificationChannel,
    servico_fatura_ativo: false,
  };

  const { form, setForm, isDirty, commitBaseline, resetTo } = useDirtyForm(defaultForm);

  useEffect(() => {
    if (settings) {
      resetTo({
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
  }, [settings, resetTo]);

  // Toggle leitura_automatica_email on the UC itself
  const toggleLeituraMut = useMutation({
    mutationFn: async (value: boolean) => {
      const { error } = await (supabase as any)
        .from("units_consumidoras")
        .update({ leitura_automatica_email: value })
        .eq("id", unitId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uc_detail"] });
      toast({ title: "Configuração atualizada" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err?.message, variant: "destructive" }),
  });

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
      commitBaseline();
      qc.invalidateQueries({ queryKey: ["billing_settings", unitId] });
      toast({ title: "Configurações salvas" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err?.message, variant: "destructive" }),
  });

  // Test button: invoke check-billing-emails for this UC
  const testReceiveMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("check-billing-emails", {
        body: { unit_id: unitId, manual: true },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["last_invoice_for_status", unitId] });
      toast({ title: "Teste concluído", description: "Verificação de e-mails executada. Veja o resultado abaixo." });
    },
    onError: (err: any) => toast({ title: "Erro no teste", description: err?.message, variant: "destructive" }),
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
    return formatDateTime(nextDate, { day: "2-digit", month: "long", year: "numeric" });
  })();

  // Determine overall status for display
  const isLeituraAtiva = leituraAutomaticaEmail ?? false;
  const isEmailAtivo = form.email_billing_enabled;

  // Build last invoice display
  const lastInvoiceLabel = lastInvoice
    ? `${MONTH_NAMES[(lastInvoice.reference_month ?? 1) - 1]}/${lastInvoice.reference_year} (via ${sourceLabel(lastInvoice.source)})`
    : null;

  const lastInvoiceStatusLabel = lastInvoice ? statusLabel(lastInvoice.status) : null;
  const lastInvoiceDate = lastInvoice?.created_at
    ? formatDate(lastInvoice.created_at)
    : null;

  return (
    <div className="space-y-4">
      {/* ─── Card 1: Recebimento de Faturas (unified) ─── */}
      <Card className="border-l-[3px] border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" /> Recebimento de Faturas
              </CardTitle>
              <CardDescription className="mt-1">
                Acompanhe o status e configure como esta UC recebe faturas.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Status overview — enhanced with real data */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
              {isLeituraAtiva ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" /> : <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">Leitura Automática</p>
                <p className="text-xs text-muted-foreground">
                  {isLeituraAtiva ? "Recebendo faturas automaticamente" : "Inativa"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
              {isEmailAtivo ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" /> : <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">Faturas por E-mail</p>
                <p className="text-xs text-muted-foreground">
                  {isEmailAtivo ? "Sistema ativo e funcionando" : "Não configurado"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
              {lastInvoice ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" /> : <AlertTriangle className="w-4 h-4 text-warning shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">Última Fatura</p>
                <p className="text-xs text-muted-foreground truncate">
                  {lastInvoiceLabel || "Nenhuma fatura recebida ainda"}
                </p>
              </div>
            </div>
          </div>

          {/* Detailed last invoice status */}
          {lastInvoice && (
            <div className="p-3 rounded-lg bg-muted/20 border border-border space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">Detalhes do último processamento</p>
                <StatusBadge variant={statusVariant(lastInvoice.status)} dot className="text-xs">
                  {lastInvoiceStatusLabel}
                </StatusBadge>
              </div>
              <p className="text-xs text-muted-foreground">
                Recebida em {lastInvoiceDate} • Fonte: {sourceLabel(lastInvoice.source)}
              </p>
            </div>
          )}

          <Separator />

          {/* Leitura Automática toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Recebimento automático de faturas</Label>
              <p className="text-xs text-muted-foreground">
                Quando ativo, o sistema recebe automaticamente suas faturas por e-mail e processa os dados.
              </p>
            </div>
            <Switch
              checked={isLeituraAtiva}
              onCheckedChange={(v) => toggleLeituraMut.mutate(v)}
              disabled={toggleLeituraMut.isPending}
            />
          </div>

          {/* Serviço de Gestão toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5" /> Serviço de Gestão de Faturas
              </Label>
              <p className="text-xs text-muted-foreground">
                Habilita registro mensal, alertas e relatórios para esta UC.
              </p>
            </div>
            <Switch
              checked={form.servico_fatura_ativo}
              onCheckedChange={async (v) => {
                if (v && !form.servico_fatura_ativo) {
                  const ok = await guardLimit("max_ucs_monitored");
                  if (!ok) return;
                }
                setForm(f => ({ ...f, servico_fatura_ativo: v }));
              }}
            />
          </div>

          {/* Leitura mensal + alertas — only if service is active */}
          {form.servico_fatura_ativo && (
            <>
              <Separator />
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

              <LastAlertInfo unitId={unitId} />
            </>
          )}

          <Separator />

          {/* E-mail settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Faturas por e-mail</Label>
              <Switch checked={form.email_billing_enabled} onCheckedChange={(v) => setForm(f => ({ ...f, email_billing_enabled: v }))} />
            </div>

            {form.email_billing_enabled && (
              <div className="space-y-4 pl-0">
                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail para cadastro na concessionária</Label>
                  <Input value={form.billing_capture_email} onChange={(e) => setForm(f => ({ ...f, billing_capture_email: e.target.value }))} placeholder="fatura-uc-xxx@seudominio.com" />
                  <p className="text-xs text-muted-foreground">Este é o endereço que deve ser cadastrado na concessionária para recebimento das faturas digitais.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail de encaminhamento</Label>
                  <Input value={form.forward_to_email} onChange={(e) => setForm(f => ({ ...f, forward_to_email: e.target.value }))} placeholder="cliente@email.com" />
                  <p className="text-xs text-muted-foreground">Endereço do cliente que receberá o repasse da fatura.</p>
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
              </div>
            )}

            {settings && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <StatusBadge variant={settings.setup_status === "active" ? "success" : settings.setup_status === "error" ? "destructive" : "warning"} dot>
                  {settings.setup_status === "active" ? "Ativo" : settings.setup_status === "error" ? "Erro" : "Pendente"}
                </StatusBadge>
                {settings.setup_status !== "active" && (
                  <span className="text-xs text-muted-foreground">
                    {!settings.email_billing_enabled
                      ? "— Ative o toggle acima para começar a receber faturas"
                      : !settings.billing_capture_email
                      ? "— Configure o e-mail de cadastro na concessionária"
                      : "— Aguardando primeira fatura ser recebida"}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !isDirty} className="w-full sm:w-auto">
              {saveMut.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
            <Button
              variant="outline"
              size="default"
              onClick={() => testReceiveMut.mutate()}
              disabled={testReceiveMut.isPending}
              className="w-full sm:w-auto gap-1.5"
            >
              {testReceiveMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
              {testReceiveMut.isPending ? "Verificando..." : "Testar recebimento"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Card 2: Alertas e Notificações ─── */}
      <AlertPhoneCard unitId={unitId} />

      {LimitDialog}
    </div>
  );
}

/** Sub-component: shows last reading alert and allows manual trigger */
function LastAlertInfo({ unitId }: { unitId: string }) {
  const { toast } = useToast();

  const { data: lastAlert } = useQuery({
    queryKey: ["unit_reading_alert", unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_reading_alerts" as any)
        .select("*")
        .eq("unit_id", unitId)
        .eq("alert_type", "leitura")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    staleTime: 1000 * 60 * 5,
  });

  const sendManual = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("billing-reading-alerts");
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Alertas de leitura processados" }),
    onError: (err: any) => toast({ title: "Erro", description: err?.message, variant: "destructive" }),
  });

  return (
    <div className="flex items-center justify-between pt-2 border-t border-border">
      <div className="text-xs text-muted-foreground">
        {lastAlert ? (
          <>
            Último alerta: <span className="font-medium text-foreground">
              {formatDate(lastAlert.sent_at)}
            </span>
            {" — "}
            <StatusBadge variant={lastAlert.status === "sent" ? "success" : lastAlert.status === "failed" ? "destructive" : "warning"} className="text-xs">
              {lastAlert.status === "sent" ? "Enviado" : lastAlert.status === "failed" ? "Falha no envio" : "Pulado"}
            </StatusBadge>
          </>
        ) : (
          "Nenhum alerta enviado ainda"
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => sendManual.mutate()}
        disabled={sendManual.isPending}
      >
        <Send className="w-3 h-3 mr-1" />
        {sendManual.isPending ? "Enviando..." : "Testar alerta"}
      </Button>
    </div>
  );
}

/** Sub-component: Alert phone number for the UC */
function AlertPhoneCard({ unitId }: { unitId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [initialPhone, setInitialPhone] = useState("");

  const { data: ucData, isLoading } = useQuery({
    queryKey: ["uc_telefone_alertas", unitId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("units_consumidoras")
        .select("telefone_alertas")
        .eq("id", unitId)
        .single();
      if (error) throw error;
      return data as { telefone_alertas: string | null };
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch last energy alert for this UC
  const { data: lastEnergyAlert } = useQuery({
    queryKey: ["last_energy_alert", unitId],
    queryFn: async () => {
      const { data } = await supabase
        .from("energy_alerts" as any)
        .select("id, alert_type, severity, created_at, resolved_at, status")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (ucData) {
      const val = ucData.telefone_alertas || "";
      setPhone(val);
      setInitialPhone(val);
    }
  }, [ucData]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("units_consumidoras")
        .update({ telefone_alertas: phone || null })
        .eq("id", unitId);
      if (error) throw error;
    },
    onSuccess: () => {
      setInitialPhone(phone);
      qc.invalidateQueries({ queryKey: ["uc_telefone_alertas", unitId] });
      toast({ title: "Telefone para alertas salvo" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err?.message, variant: "destructive" }),
  });

  const isDirty = phone !== initialPhone;
  const hasPhone = !!phone.trim();

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" /> Alertas e Notificações
            </CardTitle>
            <CardDescription className="mt-1">
              Número que receberá notificações via WhatsApp quando houver alerta energético crítico.
            </CardDescription>
          </div>
          <Badge variant="outline" className={`text-xs ${hasPhone ? "border-success/30 text-success" : "border-warning/30 text-warning"}`}>
            {hasPhone ? "Configurado" : "Não configurado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Telefone (WhatsApp)</Label>
          <PhoneInput
            value={phone}
            onChange={setPhone}
            placeholder="(00) 00000-0000"
          />
          <p className="text-xs text-muted-foreground">
            Se não preenchido, o administrador será notificado.
          </p>
        </div>

        {/* Last alert info */}
        <div className="p-3 rounded-lg bg-muted/20 border border-border">
          <p className="text-xs font-medium text-foreground mb-1">Último alerta energético</p>
          {lastEnergyAlert ? (
            <div className="flex items-center gap-2">
              <StatusBadge
                variant={lastEnergyAlert.resolved_at ? "success" : lastEnergyAlert.severity === "critical" ? "destructive" : "warning"}
                dot
                className="text-xs"
              >
                {lastEnergyAlert.resolved_at ? "Resolvido" : lastEnergyAlert.severity === "critical" ? "Crítico" : "Atenção"}
              </StatusBadge>
              <span className="text-xs text-muted-foreground">
                {formatDate(lastEnergyAlert.created_at)} • {lastEnergyAlert.alert_type}
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum alerta registrado — sistema funcionando normalmente</p>
          )}
        </div>

        <Button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !isDirty}
          size="sm"
        >
          {saveMut.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}
