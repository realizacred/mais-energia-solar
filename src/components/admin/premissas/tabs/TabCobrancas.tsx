import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, CreditCard, Landmark, Receipt, Settings2, Copy, Link, MessageSquare, Wrench } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { TenantPremises } from "@/hooks/useTenantPremises";
import { useWebhookUrl } from "@/hooks/useWebhookConfig";
import { toast } from "sonner";

interface Props {
  premises: TenantPremises;
  onChange: React.Dispatch<React.SetStateAction<TenantPremises>>;
}

const GATEWAYS = [
  { value: "pagseguro", label: "PagSeguro" },
  { value: "asaas", label: "Asaas" },
  { value: "inter", label: "Banco Inter" },
  { value: "sicoob", label: "Sicoob" },
] as const;

function TokenField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          onClick={() => setShow((v) => !v)}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function SandboxToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Modo sandbox (testes)</p>
        <p className="text-xs text-muted-foreground">
          Quando ativado, usa ambiente de testes do gateway.
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function WebhookUrlField({ gateway }: { gateway: string }) {
  const url = useWebhookUrl(gateway);
  if (!url) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    toast.success("URL do webhook copiada!");
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
        <Link className="h-3.5 w-3.5" />
        URL do Webhook
      </Label>
      <div className="flex gap-2">
        <Input readOnly value={url} className="text-xs font-mono bg-muted/30" />
        <Button type="button" variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Configure esta URL no painel do gateway para receber notificações de pagamento.
      </p>
    </div>
  );
}

export function TabCobrancas({ premises, onChange }: Props) {
  const set = <K extends keyof TenantPremises>(key: K, value: TenantPremises[K]) => {
    onChange((prev) => ({ ...prev, [key]: value }));
  };

  const gw = premises.gateway_preferido || "pagseguro";

  return (
    <div className="space-y-6">
      {/* Gateway preferido */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            Gateway preferido
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Selecione o gateway padrão para geração de cobranças.
          </p>
        </CardHeader>
        <CardContent>
          <Select value={gw} onValueChange={(v) => set("gateway_preferido", v)}>
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GATEWAYS.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* PagSeguro */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            PagSeguro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TokenField
            label="Token PagSeguro"
            value={premises.pagseguro_token || ""}
            onChange={(v) => set("pagseguro_token", v)}
            placeholder="Cole aqui o token do PagSeguro"
          />
          <SandboxToggle
            checked={premises.pagseguro_sandbox ?? true}
            onCheckedChange={(v) => set("pagseguro_sandbox", v)}
          />
          <WebhookUrlField gateway="pagseguro" />
        </CardContent>
      </Card>

      {/* Asaas */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            Asaas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TokenField
            label="Token Asaas"
            value={premises.asaas_token || ""}
            onChange={(v) => set("asaas_token", v)}
            placeholder="Cole aqui o token do Asaas"
          />
          <SandboxToggle
            checked={premises.asaas_sandbox ?? true}
            onCheckedChange={(v) => set("asaas_sandbox", v)}
          />
          <WebhookUrlField gateway="asaas" />
        </CardContent>
      </Card>
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <Landmark className="w-5 h-5 text-primary" />
            </div>
            Banco Inter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Client ID</Label>
            <Input
              value={premises.inter_client_id || ""}
              onChange={(e) => set("inter_client_id", e.target.value)}
              placeholder="Client ID do Banco Inter"
            />
          </div>
          <TokenField
            label="Client Secret"
            value={premises.inter_client_secret || ""}
            onChange={(v) => set("inter_client_secret", v)}
            placeholder="Client Secret do Banco Inter"
          />
          <SandboxToggle
            checked={premises.inter_sandbox ?? true}
            onCheckedChange={(v) => set("inter_sandbox", v)}
          />
        </CardContent>
      </Card>

      {/* Sicoob */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <Landmark className="w-5 h-5 text-primary" />
            </div>
            Sicoob
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Client ID</Label>
            <Input
              value={premises.sicoob_client_id || ""}
              onChange={(e) => set("sicoob_client_id", e.target.value)}
              placeholder="Client ID do Sicoob"
            />
          </div>
          <SandboxToggle
            checked={premises.sicoob_sandbox ?? true}
            onCheckedChange={(v) => set("sicoob_sandbox", v)}
          />
        </CardContent>
      </Card>

      {/* Configurações de cobrança */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <Settings2 className="w-5 h-5 text-primary" />
            </div>
            Configurações de cobrança
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Valores padrão aplicados a novas cobranças geradas.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Multa por atraso (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={premises.cobranca_multa_percentual ?? 2}
                onChange={(e) => set("cobranca_multa_percentual", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Juros ao mês (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={premises.cobranca_juros_percentual ?? 1}
                onChange={(e) => set("cobranca_juros_percentual", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Dias até 1º vencimento</Label>
              <Input
                type="number"
                step="1"
                min="1"
                value={premises.cobranca_dias_vencimento ?? 30}
                onChange={(e) => set("cobranca_dias_vencimento", parseInt(e.target.value) || 30)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notificações WA de pagamento */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            Notificações de Pagamento (WhatsApp)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Receba notificações automáticas via WhatsApp quando pagamentos forem registrados.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Notificar ao receber pagamento</p>
              <p className="text-xs text-muted-foreground">
                Envia mensagem quando um pagamento é registrado.
              </p>
            </div>
            <Switch
              checked={premises.wa_notif_pagamento ?? true}
              onCheckedChange={(v) => set("wa_notif_pagamento", v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Notificar ao quitar recebimento</p>
              <p className="text-xs text-muted-foreground">
                Envia mensagem quando um recebimento é totalmente quitado.
              </p>
            </div>
            <Switch
              checked={premises.wa_notif_quitado ?? true}
              onCheckedChange={(v) => set("wa_notif_quitado", v)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Número para notificações</Label>
            <Input
              value={premises.wa_notif_numero || ""}
              onChange={(e) => set("wa_notif_numero", e.target.value)}
              placeholder="Ex: 5531999998888 (com DDI)"
            />
            <p className="text-[10px] text-muted-foreground">
              Deixe vazio para usar o número principal do WhatsApp conectado.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Templates WA de instalação */}
      <InstalacaoTemplatesCard premises={premises} set={set} />
    </div>
  );
}

const INSTALACAO_VARS = [
  { key: "{{nome_cliente}}", desc: "Nome do cliente" },
  { key: "{{data}}", desc: "Data da instalação" },
  { key: "{{hora}}", desc: "Hora da instalação" },
  { key: "{{consultor}}", desc: "Nome do consultor" },
  { key: "{{motivo}}", desc: "Motivo do reagendamento (só reagendamento)" },
];

function InstalacaoTemplatesCard({
  premises,
  set,
}: {
  premises: Props["premises"];
  set: <K extends keyof Props["premises"]>(key: K, value: Props["premises"][K]) => void;
}) {
  const insertVar = useCallback((
    fieldRef: React.RefObject<HTMLTextAreaElement | null>,
    fieldKey: "wa_template_agendamento_instalacao" | "wa_template_reagendamento_instalacao",
    varKey: string,
  ) => {
    const el = fieldRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const newVal = el.value.slice(0, start) + varKey + el.value.slice(end);
    set(fieldKey, newVal);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + varKey.length, start + varKey.length);
    });
  }, [set]);

  const agendRef = useRef<HTMLTextAreaElement>(null);
  const reagendRef = useRef<HTMLTextAreaElement>(null);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
            <Wrench className="w-5 h-5 text-primary" />
          </div>
          Notificações de Instalação (WhatsApp)
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Templates das mensagens enviadas ao cliente quando uma instalação é agendada ou reagendada.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Variáveis disponíveis */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Variáveis disponíveis (clique para inserir):</p>
          <div className="flex flex-wrap gap-1.5">
            {INSTALACAO_VARS.map((v) => (
              <button
                key={v.key}
                type="button"
                className="group"
                title={v.desc}
                onClick={() => {
                  insertVar(agendRef, "wa_template_agendamento_instalacao", v.key);
                }}
              >
                <Badge
                  variant="outline"
                  className="cursor-pointer text-xs transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                >
                  {v.key}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        {/* Template agendamento */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Template de agendamento</Label>
          <Textarea
            ref={agendRef}
            value={premises.wa_template_agendamento_instalacao || ""}
            onChange={(e) => set("wa_template_agendamento_instalacao", e.target.value)}
            placeholder="Olá {{nome_cliente}}! Sua instalação solar está agendada para {{data}} às {{hora}}..."
            className="min-h-[80px]"
          />
          <p className="text-[10px] text-muted-foreground">
            Enviada quando uma instalação é agendada pela primeira vez.
          </p>
        </div>

        {/* Template reagendamento */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Template de reagendamento</Label>
          <Textarea
            ref={reagendRef}
            value={premises.wa_template_reagendamento_instalacao || ""}
            onChange={(e) => set("wa_template_reagendamento_instalacao", e.target.value)}
            placeholder="Olá {{nome_cliente}}! Sua instalação foi reagendada para {{data}} às {{hora}}. Motivo: {{motivo}}..."
            className="min-h-[80px]"
          />
          <p className="text-[10px] text-muted-foreground">
            Enviada quando uma instalação é reagendada. Use {"{{motivo}}"} para incluir a justificativa.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
