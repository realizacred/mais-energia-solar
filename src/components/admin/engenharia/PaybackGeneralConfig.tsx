import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings2,
  Save,
  DollarSign,
  Zap,
  TrendingUp,
  Calendar,
  Info,
} from "lucide-react";

interface PaybackConfigData {
  id: string;
  custo_disponibilidade_monofasico: number;
  custo_disponibilidade_bifasico: number;
  custo_disponibilidade_trifasico: number;
  taxas_fixas_mensais: number;
  degradacao_anual_painel: number;
  reajuste_anual_tarifa: number;
  tarifa_fio_b_padrao: number;
}

export function PaybackGeneralConfig() {
  const [config, setConfig] = useState<PaybackConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("payback_config")
        .select("id, custo_disponibilidade_monofasico, custo_disponibilidade_bifasico, custo_disponibilidade_trifasico, taxas_fixas_mensais, degradacao_anual_painel, reajuste_anual_tarifa, tarifa_fio_b_padrao")
        .limit(1)
        .single();
      if (error) throw error;
      setConfig({
        id: data.id,
        custo_disponibilidade_monofasico: Number(data.custo_disponibilidade_monofasico),
        custo_disponibilidade_bifasico: Number(data.custo_disponibilidade_bifasico),
        custo_disponibilidade_trifasico: Number(data.custo_disponibilidade_trifasico),
        taxas_fixas_mensais: Number(data.taxas_fixas_mensais),
        degradacao_anual_painel: Number(data.degradacao_anual_painel),
        reajuste_anual_tarifa: Number(data.reajuste_anual_tarifa),
        tarifa_fio_b_padrao: Number(data.tarifa_fio_b_padrao),
      });
    } catch (error: any) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("payback_config")
        .update({
          custo_disponibilidade_monofasico: config.custo_disponibilidade_monofasico,
          custo_disponibilidade_bifasico: config.custo_disponibilidade_bifasico,
          custo_disponibilidade_trifasico: config.custo_disponibilidade_trifasico,
          taxas_fixas_mensais: config.taxas_fixas_mensais,
          degradacao_anual_painel: config.degradacao_anual_painel,
          reajuste_anual_tarifa: config.reajuste_anual_tarifa,
          tarifa_fio_b_padrao: config.tarifa_fio_b_padrao,
        })
        .eq("id", config.id);
      if (error) throw error;
      toast({ title: "Configuração salva!", description: "Parâmetros de payback atualizados." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof PaybackConfigData, value: number) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Spinner size="md" />
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Configuração não encontrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-primary" />
          <CardTitle>Configurações Gerais de Payback</CardTitle>
        </div>
        <CardDescription>
          Parâmetros padrão para cálculos de payback quando não configurados na concessionária.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info */}
        <div className="p-3 rounded-lg bg-info/5 border border-info/20 flex items-start gap-2">
          <Info className="w-4 h-4 text-info mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Estes valores são usados como fallback quando a concessionária específica não possui
            dados configurados. Valores da concessionária sempre têm prioridade.
          </p>
        </div>

        {/* Custo de Disponibilidade */}
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-warning" />
            Custo de Disponibilidade (conta mínima)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Monofásico (R$)</Label>
              <Input
                type="number"
                step="1"
                value={config.custo_disponibilidade_monofasico}
                onChange={(e) =>
                  updateField("custo_disponibilidade_monofasico", parseFloat(e.target.value) || 0)
                }
              />
              <p className="text-[10px] text-muted-foreground">~30 kWh × tarifa</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bifásico (R$)</Label>
              <Input
                type="number"
                step="1"
                value={config.custo_disponibilidade_bifasico}
                onChange={(e) =>
                  updateField("custo_disponibilidade_bifasico", parseFloat(e.target.value) || 0)
                }
              />
              <p className="text-[10px] text-muted-foreground">~50 kWh × tarifa</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Trifásico (R$)</Label>
              <Input
                type="number"
                step="1"
                value={config.custo_disponibilidade_trifasico}
                onChange={(e) =>
                  updateField("custo_disponibilidade_trifasico", parseFloat(e.target.value) || 0)
                }
              />
              <p className="text-[10px] text-muted-foreground">~100 kWh × tarifa</p>
            </div>
          </div>
        </div>

        {/* Taxas e Tarifas */}
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-primary" />
            Taxas e Tarifas
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Taxas Fixas Mensais (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={config.taxas_fixas_mensais}
                onChange={(e) => updateField("taxas_fixas_mensais", parseFloat(e.target.value) || 0)}
              />
              <p className="text-[10px] text-muted-foreground">
                Iluminação pública, CIP, etc.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tarifa Fio B Padrão (R$/kWh)</Label>
              <Input
                type="number"
                step="0.01"
                value={config.tarifa_fio_b_padrao}
                onChange={(e) => updateField("tarifa_fio_b_padrao", parseFloat(e.target.value) || 0)}
              />
              <p className="text-[10px] text-muted-foreground">
                Usado quando concessionária não tem Fio B configurado
              </p>
            </div>
          </div>
        </div>

        {/* Projeções */}
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-success" />
            Projeções de Longo Prazo
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Degradação Anual do Painel (%)</Label>
              <Input
                type="number"
                step="0.1"
                min={0}
                max={5}
                value={config.degradacao_anual_painel}
                onChange={(e) =>
                  updateField("degradacao_anual_painel", parseFloat(e.target.value) || 0)
                }
              />
              <p className="text-[10px] text-muted-foreground">
                Redução anual na geração (típico: 0.5-0.8%)
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reajuste Anual da Tarifa (%)</Label>
              <Input
                type="number"
                step="0.1"
                min={0}
                max={20}
                value={config.reajuste_anual_tarifa}
                onChange={(e) =>
                  updateField("reajuste_anual_tarifa", parseFloat(e.target.value) || 0)
                }
              />
              <p className="text-[10px] text-muted-foreground">
                Estimativa de reajuste médio anual (típico: 5-8%)
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
            Salvar Configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
