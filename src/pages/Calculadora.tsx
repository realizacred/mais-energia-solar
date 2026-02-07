import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Sun, 
  Zap, 
  TrendingDown, 
  Leaf, 
  Calendar, 
  DollarSign, 
  ArrowRight,
  Calculator,
  Info
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import FinancingSimulator from "@/components/FinancingSimulator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CalculadoraConfig {
  tarifa_media_kwh: number;
  custo_por_kwp: number;
  geracao_mensal_por_kwp: number;
  kg_co2_por_kwh: number;
  percentual_economia: number;
}

// Default values (fallback)
const DEFAULT_CONFIG: CalculadoraConfig = {
  tarifa_media_kwh: 0.85,
  custo_por_kwp: 4500,
  geracao_mensal_por_kwp: 120,
  kg_co2_por_kwh: 0.084,
  percentual_economia: 95,
};

export default function Calculadora() {
  const [config, setConfig] = useState<CalculadoraConfig>(DEFAULT_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  const [consumoMensal, setConsumoMensal] = useState<number>(300);
  const [tarifaKwh, setTarifaKwh] = useState<number>(DEFAULT_CONFIG.tarifa_media_kwh);
  
  // Calculated values
  const [economia, setEconomia] = useState({ mensal: 0, anual: 0 });
  const [potenciaSistema, setPotenciaSistema] = useState(0);
  const [investimento, setInvestimento] = useState(0);
  const [payback, setPayback] = useState(0);
  const [reducaoCO2, setReducaoCO2] = useState({ mensal: 0, anual: 0 });

  // Fetch config from database
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Use secure RPC function that exposes only necessary fields
        const { data, error } = await supabase.rpc("get_calculator_config");

        if (error) throw error;
        if (data && data.length > 0) {
          const configData = data[0];
          setConfig(configData);
          setTarifaKwh(Number(configData.tarifa_media_kwh));
        }
      } catch (error) {
        console.error("Erro ao buscar configuração:", error);
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    // Calculate system size (kWp)
    const kWp = consumoMensal / config.geracao_mensal_por_kwp;
    setPotenciaSistema(kWp);
    
    // Calculate savings
    const economiaMensal = consumoMensal * tarifaKwh * (config.percentual_economia / 100);
    const economiaAnual = economiaMensal * 12;
    setEconomia({ mensal: economiaMensal, anual: economiaAnual });
    
    // Calculate investment and payback
    const investimentoTotal = kWp * config.custo_por_kwp;
    setInvestimento(investimentoTotal);
    setPayback(investimentoTotal / economiaAnual);
    
    // Calculate CO2 reduction
    const co2Mensal = consumoMensal * config.kg_co2_por_kwh;
    setReducaoCO2({ mensal: co2Mensal, anual: co2Mensal * 12 });
  }, [consumoMensal, tarifaKwh, config]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen gradient-mesh flex flex-col">
      <Header showCalculadora={false}>
        <Link to="/">
          <Button variant="default" size="sm" className="gap-2">
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span className="hidden sm:inline">Solicitar Orçamento</span>
            <span className="sm:hidden">Orçamento</span>
          </Button>
        </Link>
      </Header>

      <main className="container mx-auto px-4 py-8 max-w-5xl flex-1">
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Badge className="mb-4 bg-primary/10 text-primary border-0">
            <Calculator className="w-3 h-3 mr-1" />
            Simulador Gratuito
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-brand-blue mb-3">
            Calcule Sua Economia com Energia Solar
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Descubra quanto você pode economizar na conta de luz e contribuir para um futuro mais sustentável
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Input Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="shadow-lg border-t-4 border-t-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-brand-blue">
                  <Zap className="w-5 h-5 text-primary" />
                  Seu Consumo de Energia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Consumo Slider */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="consumo" className="text-base font-medium">
                      Consumo Mensal
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="consumo"
                        type="number"
                        value={consumoMensal}
                        onChange={(e) => setConsumoMensal(Number(e.target.value) || 0)}
                        className="w-24 text-right font-bold text-lg"
                      />
                      <span className="text-muted-foreground font-medium">kWh</span>
                    </div>
                  </div>
                  <Slider
                    value={[consumoMensal]}
                    onValueChange={(value) => setConsumoMensal(value[0])}
                    min={100}
                    max={2000}
                    step={10}
                    className="py-4"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>100 kWh</span>
                    <span>2000 kWh</span>
                  </div>
                </div>

                {/* Tarifa Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="tarifa" className="text-base font-medium">
                        Tarifa de Energia
                      </Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Valor médio cobrado pela concessionária (R$/kWh)</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">R$</span>
                      <Input
                        id="tarifa"
                        type="number"
                        step="0.01"
                        value={tarifaKwh}
                        onChange={(e) => setTarifaKwh(Number(e.target.value) || 0)}
                        className="w-20 text-right font-medium"
                      />
                      <span className="text-muted-foreground text-sm">/kWh</span>
                    </div>
                  </div>
                </div>

                {/* Current Bill */}
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm text-muted-foreground mb-1">Sua conta atual estimada</p>
                  <p className="text-2xl font-bold text-destructive">
                    {formatCurrency(consumoMensal * tarifaKwh)}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Results Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            {/* Main Savings Card */}
            <Card className="shadow-lg gradient-solar text-white overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-white/80 text-sm">Economia Mensal</p>
                    <p className="text-4xl font-bold">{formatCurrency(economia.mensal)}</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-white/90">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-lg font-semibold">
                    {formatCurrency(economia.anual)} por ano
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* System Size */}
              <Card className="shadow border-l-4 border-l-secondary">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-secondary mb-1">
                    <Sun className="w-4 h-4" />
                    <span className="text-xs font-medium">Potência do Sistema</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {potenciaSistema.toFixed(1)}
                    <span className="text-sm font-normal text-muted-foreground ml-1">kWp</span>
                  </p>
                </CardContent>
              </Card>

              {/* Payback */}
              <Card className="shadow border-l-4 border-l-primary">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-primary mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-medium">Retorno em</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {payback.toFixed(1)}
                    <span className="text-sm font-normal text-muted-foreground ml-1">anos</span>
                  </p>
                </CardContent>
              </Card>

              {/* Investment */}
              <Card className="shadow border-l-4 border-l-secondary">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-secondary mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs font-medium">Investimento Estimado</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(investimento)}
                  </p>
                </CardContent>
              </Card>

              {/* CO2 */}
            <Card className="shadow border-l-4 border-l-success">
                <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-success mb-1">
                    <Leaf className="w-4 h-4" />
                    <span className="text-xs font-medium">Redução de CO₂</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {(reducaoCO2.anual / 1000).toFixed(1)}
                    <span className="text-sm font-normal text-muted-foreground ml-1">ton/ano</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Financing Simulator */}
            <FinancingSimulator investimento={investimento} economia={economia.mensal} />

            {/* CTA Button */}
            <Link to="/" className="block">
              <Button 
                size="lg" 
                className="w-full bg-secondary hover:bg-secondary/90 text-lg h-14 gap-2"
              >
                Solicitar Orçamento Gratuito
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Info Section */}
        <motion.div
          className="mt-10 text-center text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <p>
            * Valores estimados com base em médias do mercado brasileiro. 
            O orçamento final pode variar de acordo com as características do seu imóvel.
          </p>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
