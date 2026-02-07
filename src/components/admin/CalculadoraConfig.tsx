import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Save, Loader2, Calculator, Zap, Leaf, DollarSign, Calendar } from "lucide-react";

interface CalculadoraConfigData {
  id: string;
  tarifa_media_kwh: number;
  custo_por_kwp: number;
  geracao_mensal_por_kwp: number;
  kg_co2_por_kwh: number;
  percentual_economia: number;
  vida_util_sistema: number;
}

export default function CalculadoraConfig() {
  const [config, setConfig] = useState<CalculadoraConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("calculadora_config")
        .select("*")
        .single();

      if (error) throw error;
      setConfig(data);
    } catch (error) {
      console.error("Erro ao buscar configuração:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a configuração da calculadora.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("calculadora_config")
        .update({
          tarifa_media_kwh: config.tarifa_media_kwh,
          custo_por_kwp: config.custo_por_kwp,
          geracao_mensal_por_kwp: config.geracao_mensal_por_kwp,
          kg_co2_por_kwh: config.kg_co2_por_kwh,
          percentual_economia: config.percentual_economia,
          vida_util_sistema: config.vida_util_sistema,
        })
        .eq("id", config.id);

      if (error) throw error;

      toast({
        title: "Configuração salva!",
        description: "Os parâmetros da calculadora foram atualizados.",
      });
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a configuração.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof CalculadoraConfigData, value: number) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
          <Calculator className="w-5 h-5 text-primary" />
          <CardTitle className="text-brand-blue">Configuração da Calculadora Solar</CardTitle>
        </div>
        <CardDescription>
          Ajuste os parâmetros utilizados nos cálculos de economia e investimento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Tarifa */}
          <div className="space-y-2">
            <Label htmlFor="tarifa" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Tarifa Média (R$/kWh)
            </Label>
            <Input
              id="tarifa"
              type="number"
              step="0.01"
              value={config.tarifa_media_kwh}
              onChange={(e) => updateField("tarifa_media_kwh", parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">Valor médio cobrado pelas concessionárias</p>
          </div>

          {/* Custo por kWp */}
          <div className="space-y-2">
            <Label htmlFor="custo" className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-secondary" />
              Custo por kWp (R$)
            </Label>
            <Input
              id="custo"
              type="number"
              step="100"
              value={config.custo_por_kwp}
              onChange={(e) => updateField("custo_por_kwp", parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">Custo médio de instalação por kWp</p>
          </div>

          {/* Geração mensal */}
          <div className="space-y-2">
            <Label htmlFor="geracao" className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Geração Mensal (kWh/kWp)
            </Label>
            <Input
              id="geracao"
              type="number"
              value={config.geracao_mensal_por_kwp}
              onChange={(e) => updateField("geracao_mensal_por_kwp", parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">kWh gerados por kWp instalado/mês</p>
          </div>

          {/* CO2 */}
          <div className="space-y-2">
            <Label htmlFor="co2" className="flex items-center gap-2">
              <Leaf className="w-4 h-4 text-green-600" />
              CO₂ por kWh (kg)
            </Label>
            <Input
              id="co2"
              type="number"
              step="0.001"
              value={config.kg_co2_por_kwh}
              onChange={(e) => updateField("kg_co2_por_kwh", parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">kg de CO₂ por kWh na rede elétrica</p>
          </div>

          {/* Percentual economia */}
          <div className="space-y-2">
            <Label htmlFor="economia" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Percentual Economia (%)
            </Label>
            <Input
              id="economia"
              type="number"
              min="0"
              max="100"
              value={config.percentual_economia}
              onChange={(e) => updateField("percentual_economia", parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">% de economia na conta de luz</p>
          </div>

          {/* Vida útil */}
          <div className="space-y-2">
            <Label htmlFor="vida" className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-secondary" />
              Vida Útil (anos)
            </Label>
            <Input
              id="vida"
              type="number"
              value={config.vida_util_sistema}
              onChange={(e) => updateField("vida_util_sistema", parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">Vida útil estimada do sistema</p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
