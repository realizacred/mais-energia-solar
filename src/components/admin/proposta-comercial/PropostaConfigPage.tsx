import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PropostaConfig {
  proposta_tem_validade: boolean;
  proposta_validade_dias: number;
  proposta_exibir_expirada: boolean;
}

const DEFAULTS: PropostaConfig = {
  proposta_tem_validade: true,
  proposta_validade_dias: 10,
  proposta_exibir_expirada: false,
};

export function PropostaConfigPage() {
  const [config, setConfig] = useState<PropostaConfig>(DEFAULTS);
  const [configId, setConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("proposta_config" as any)
        .select("id, proposta_tem_validade, proposta_validade_dias, proposta_exibir_expirada")
        .limit(1)
        .maybeSingle();

      if (data) {
        const d = data as any;
        setConfigId(d.id);
        setConfig({
          proposta_tem_validade: d.proposta_tem_validade ?? DEFAULTS.proposta_tem_validade,
          proposta_validade_dias: d.proposta_validade_dias ?? DEFAULTS.proposta_validade_dias,
          proposta_exibir_expirada: d.proposta_exibir_expirada ?? DEFAULTS.proposta_exibir_expirada,
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
      if (configId) {
        const { error } = await supabase
          .from("proposta_config" as any)
          .update({
            proposta_tem_validade: config.proposta_tem_validade,
            proposta_validade_dias: config.proposta_validade_dias,
            proposta_exibir_expirada: config.proposta_exibir_expirada,
          })
          .eq("id", configId);
        if (error) throw error;
      } else {
        // Get tenant_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .limit(1)
          .single();
        if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

        const { error } = await supabase.from("proposta_config" as any).insert({
          tenant_id: profile.tenant_id,
          proposta_tem_validade: config.proposta_tem_validade,
          proposta_validade_dias: config.proposta_validade_dias,
          proposta_exibir_expirada: config.proposta_exibir_expirada,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Configurações de Proposta</h1>
        <p className="text-sm text-muted-foreground">
          Defina regras de validade e exibição das propostas comerciais.
        </p>
      </div>

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

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
