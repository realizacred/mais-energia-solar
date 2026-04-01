import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, CreditCard, Landmark, Receipt, Settings2, Copy, Link } from "lucide-react";
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
    </div>
  );
}
