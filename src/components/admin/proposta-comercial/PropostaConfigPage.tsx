import { useState, useEffect } from "react";
import { Save, Settings, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEmailTemplates } from "@/hooks/useProposalTemplates";

interface PropostaConfig {
  proposta_tem_validade: boolean;
  proposta_validade_dias: number;
  proposta_exibir_expirada: boolean;
  auto_envio_ativo: boolean;
  auto_envio_canal: string;
  auto_envio_template_id: string | null;
  auto_envio_delay_minutos: number;
}

const DEFAULTS: PropostaConfig = {
  proposta_tem_validade: true,
  proposta_validade_dias: 10,
  proposta_exibir_expirada: false,
  auto_envio_ativo: false,
  auto_envio_canal: "whatsapp",
  auto_envio_template_id: null,
  auto_envio_delay_minutos: 0,
};

const DELAY_OPTIONS = [
  { value: "0", label: "Imediatamente" },
  { value: "5", label: "5 minutos" },
  { value: "15", label: "15 minutos" },
  { value: "60", label: "1 hora" },
];

export function PropostaConfigPage() {
  const [config, setConfig] = useState<PropostaConfig>(DEFAULTS);
  const [configId, setConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { data: emailTemplates } = useEmailTemplates();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("proposta_config" as any)
        .select("id, proposta_tem_validade, proposta_validade_dias, proposta_exibir_expirada, auto_envio_ativo, auto_envio_canal, auto_envio_template_id, auto_envio_delay_minutos")
        .limit(1)
        .maybeSingle();

      if (data) {
        const d = data as any;
        setConfigId(d.id);
        setConfig({
          proposta_tem_validade: d.proposta_tem_validade ?? DEFAULTS.proposta_tem_validade,
          proposta_validade_dias: d.proposta_validade_dias ?? DEFAULTS.proposta_validade_dias,
          proposta_exibir_expirada: d.proposta_exibir_expirada ?? DEFAULTS.proposta_exibir_expirada,
          auto_envio_ativo: d.auto_envio_ativo ?? DEFAULTS.auto_envio_ativo,
          auto_envio_canal: d.auto_envio_canal ?? DEFAULTS.auto_envio_canal,
          auto_envio_template_id: d.auto_envio_template_id ?? DEFAULTS.auto_envio_template_id,
          auto_envio_delay_minutos: d.auto_envio_delay_minutos ?? DEFAULTS.auto_envio_delay_minutos,
        });
      }
    } catch (err) {
      console.error("Error loading config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        proposta_tem_validade: config.proposta_tem_validade,
        proposta_validade_dias: config.proposta_validade_dias,
        proposta_exibir_expirada: config.proposta_exibir_expirada,
        auto_envio_ativo: config.auto_envio_ativo,
        auto_envio_canal: config.auto_envio_canal,
        auto_envio_template_id: config.auto_envio_template_id || null,
        auto_envio_delay_minutos: config.auto_envio_delay_minutos,
      };

      if (configId) {
        const { error } = await supabase
          .from("proposta_config" as any)
          .update(payload)
          .eq("id", configId);
        if (error) throw error;
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .limit(1)
          .single();
        if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

        const { error } = await supabase.from("proposta_config" as any).insert({
          tenant_id: profile.tenant_id,
          ...payload,
        });
        if (error) throw error;
      }
      toast({ title: "Configurações salvas com sucesso!" });
      loadConfig();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Filter templates by selected canal
  const filteredTemplates = (emailTemplates || []).filter((t) =>
    t.canal === config.auto_envio_canal || t.canal === "ambos"
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Configurações de Proposta</h1>
          <p className="text-sm text-muted-foreground">
            Defina regras de validade, exibição e automação de envio das propostas comerciais.
          </p>
        </div>
      </div>

      {/* Validade */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Validade da Proposta</CardTitle>
          <CardDescription>
            Controle se as propostas devem ter prazo de validade e como se comportam após expirar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">As propostas devem ter validade?</Label>
              <p className="text-xs text-muted-foreground">
                Se ativado, cada proposta terá uma data de expiração.
              </p>
            </div>
            <Switch
              checked={config.proposta_tem_validade}
              onCheckedChange={(v) => setConfig((c) => ({ ...c, proposta_tem_validade: v }))}
            />
          </div>

          {config.proposta_tem_validade && (
            <>
              <div className="space-y-2">
                <Label className="text-sm">Dias de validade (padrão)</Label>
                <div className="flex items-center gap-2 max-w-xs">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={config.proposta_validade_dias}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        proposta_validade_dias: Math.max(1, Number(e.target.value) || 10),
                      }))
                    }
                    className="h-9 w-24"
                  />
                  <span className="text-sm text-muted-foreground">dias</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    Clientes podem visualizar propostas expiradas?
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Se desativado, o link mostrará "Proposta expirada" após a validade.
                  </p>
                </div>
                <Switch
                  checked={config.proposta_exibir_expirada}
                  onCheckedChange={(v) => setConfig((c) => ({ ...c, proposta_exibir_expirada: v }))}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Automação de Envio */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-warning" />
            <CardTitle className="text-base">Automação de Envio</CardTitle>
          </div>
          <CardDescription>
            Configure o envio automático da proposta ao cliente após a geração do arquivo.
            A execução automática será implementada em breve — por enquanto apenas salve a configuração.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Enviar automaticamente ao gerar proposta</Label>
              <p className="text-xs text-muted-foreground">
                Quando ativado, a proposta será enviada automaticamente após a geração do arquivo.
              </p>
            </div>
            <Switch
              checked={config.auto_envio_ativo}
              onCheckedChange={(v) => setConfig((c) => ({ ...c, auto_envio_ativo: v }))}
            />
          </div>

          {config.auto_envio_ativo && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Canal padrão</Label>
                <Select
                  value={config.auto_envio_canal}
                  onValueChange={(v) => setConfig((c) => ({ ...c, auto_envio_canal: v, auto_envio_template_id: null }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Template padrão</Label>
                <Select
                  value={config.auto_envio_template_id || ""}
                  onValueChange={(v) => setConfig((c) => ({ ...c, auto_envio_template_id: v || null }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Usar padrão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Usar template padrão</SelectItem>
                    {filteredTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome} {t.is_default ? "(padrão)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Delay após geração</Label>
                <Select
                  value={String(config.auto_envio_delay_minutos)}
                  onValueChange={(v) => setConfig((c) => ({ ...c, auto_envio_delay_minutos: Number(v) }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELAY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
