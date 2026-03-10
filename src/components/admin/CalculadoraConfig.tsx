import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Save, Calculator, Zap, Leaf, DollarSign, Calendar, Info } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { motion } from "framer-motion";

interface CalcFields {
  id?: string;
  tarifa: number;
  custo_por_kwp: number;
  geracao_mensal_por_kwp: number;
  kg_co2_por_kwh: number;
  percentual_economia: number;
  vida_util_sistema: number;
}

const DEFAULTS: CalcFields = {
  tarifa: 0.99,
  custo_por_kwp: 5500,
  geracao_mensal_por_kwp: 130,
  kg_co2_por_kwh: 0.084,
  percentual_economia: 90,
  vida_util_sistema: 25,
};

export default function CalculadoraConfig() {
  const [config, setConfig] = useState<CalcFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("tenant_premises")
        .select("id, tarifa, custo_por_kwp, geracao_mensal_por_kwp, kg_co2_por_kwh, percentual_economia, vida_util_sistema")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          id: (data as any).id,
          tarifa: (data as any).tarifa ?? DEFAULTS.tarifa,
          custo_por_kwp: (data as any).custo_por_kwp ?? DEFAULTS.custo_por_kwp,
          geracao_mensal_por_kwp: (data as any).geracao_mensal_por_kwp ?? DEFAULTS.geracao_mensal_por_kwp,
          kg_co2_por_kwh: (data as any).kg_co2_por_kwh ?? DEFAULTS.kg_co2_por_kwh,
          percentual_economia: (data as any).percentual_economia ?? DEFAULTS.percentual_economia,
          vida_util_sistema: (data as any).vida_util_sistema ?? DEFAULTS.vida_util_sistema,
        });
      } else {
        setConfig(DEFAULTS);
      }
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
      const payload = {
        tarifa: config.tarifa,
        custo_por_kwp: config.custo_por_kwp,
        geracao_mensal_por_kwp: config.geracao_mensal_por_kwp,
        kg_co2_por_kwh: config.kg_co2_por_kwh,
        percentual_economia: config.percentual_economia,
        vida_util_sistema: config.vida_util_sistema,
      };

      if (config.id) {
        const { error } = await supabase
          .from("tenant_premises")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("tenant_premises")
          .insert([payload] as any)
          .select("id")
          .single();
        if (error) throw error;
        setConfig((prev) => prev ? { ...prev, id: (data as any).id } : prev);
      }

      toast({
        title: "Configuração salva!",
        description: "Os parâmetros da calculadora foram atualizados.",
      });
    } catch (error: any) {
      console.error("Erro ao salvar configuração:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar a configuração.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof CalcFields, value: number) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-64 mb-1" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-4 md:p-6 text-center py-8 text-muted-foreground">
        Configuração não encontrada.
      </div>
    );
  }

  return (
    <motion.div
      className="p-4 md:p-6 space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* §26 Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Configuração da Calculadora Solar</h1>
            <p className="text-sm text-muted-foreground">Ajuste os parâmetros utilizados nos cálculos de economia e investimento</p>
          </div>
        </div>
      </div>

      {/* Info alert */}
      <Alert className="border-info/20 bg-info/5">
        <Info className="w-4 h-4 text-info" />
        <AlertDescription className="text-sm text-foreground">
          <strong>Configurações Unificadas com Propostas.</strong>{" "}
          Estes valores são compartilhados com o módulo de Premissas Técnicas.
          Alterações aqui serão refletidas nas propostas e simulações.
        </AlertDescription>
      </Alert>

      {/* Fields grid */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="tarifa" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <DollarSign className="w-4 h-4 text-success" />
                Tarifa Média (R$/kWh)
              </Label>
              <Input
                id="tarifa"
                type="number"
                step="0.01"
                value={config.tarifa}
                onChange={(e) => updateField("tarifa", parseFloat(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Valor médio cobrado pelas concessionárias</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="custo" className="flex items-center gap-2 text-sm font-medium text-foreground">
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

            <div className="space-y-2">
              <Label htmlFor="geracao" className="flex items-center gap-2 text-sm font-medium text-foreground">
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

            <div className="space-y-2">
              <Label htmlFor="co2" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Leaf className="w-4 h-4 text-success" />
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

            <div className="space-y-2">
              <Label htmlFor="economia" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <DollarSign className="w-4 h-4 text-success" />
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

            <div className="space-y-2">
              <Label htmlFor="vida" className="flex items-center gap-2 text-sm font-medium text-foreground">
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
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
          Salvar Configuração
        </Button>
      </div>
    </motion.div>
  );
}
