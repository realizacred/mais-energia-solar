import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FileText, Download, Eye, Loader2, Calculator, Banknote } from "lucide-react";
import { generateProposalPdf, downloadProposalPdf } from "@/lib/proposalPdf";
import { toast } from "@/hooks/use-toast";
import type { Lead } from "@/types/lead";
import type { OrcamentoDisplayItem } from "@/types/orcamento";

interface ProposalGeneratorProps {
  lead?: Lead;
  orcamento?: OrcamentoDisplayItem;
  vendedorNome?: string;
}

interface FinancingOption {
  nome: string;
  taxa_mensal: number;
  max_parcelas: number;
}

const FINANCING_OPTIONS: FinancingOption[] = [
  { nome: "Santander Solar", taxa_mensal: 1.29, max_parcelas: 60 },
  { nome: "BV Financeira", taxa_mensal: 1.49, max_parcelas: 72 },
  { nome: "Banco do Brasil", taxa_mensal: 1.19, max_parcelas: 48 },
  { nome: "Caixa Econômica", taxa_mensal: 1.09, max_parcelas: 60 },
];

// Default calculator config values
const CONFIG = {
  tarifaMediaKwh: 0.85,
  custoPorKwp: 4500,
  geracaoMensalPorKwp: 120,
  kgCo2PorKwh: 0.084,
  percentualEconomia: 95,
  vidaUtilSistema: 25,
  wattsPerPanel: 550,
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProposalGenerator({ lead, orcamento, vendedorNome }: ProposalGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeFinancing, setIncludeFinancing] = useState(true);
  const [selectedBank, setSelectedBank] = useState(0);
  const [parcelas, setParcelas] = useState(36);

  // Get data from lead or orcamento
  const clienteNome = lead?.nome || orcamento?.nome || "";
  const clienteTelefone = lead?.telefone || orcamento?.telefone || "";
  const clienteCidade = lead?.cidade || orcamento?.cidade || "";
  const clienteEstado = lead?.estado || orcamento?.estado || "";
  const clienteBairro = lead?.bairro || orcamento?.bairro || "";
  const consumoMedio = lead?.media_consumo || orcamento?.media_consumo || 300;
  const tipoTelhado = lead?.tipo_telhado || orcamento?.tipo_telhado || "";
  const redeAtendimento = lead?.rede_atendimento || orcamento?.rede_atendimento || "";
  const area = lead?.area || orcamento?.area || "";

  // Calculate system specs
  const calculations = useMemo(() => {
    const geracaoNecessaria = consumoMedio / (CONFIG.percentualEconomia / 100);
    const potenciaKwp = geracaoNecessaria / CONFIG.geracaoMensalPorKwp;
    const numeroPlacas = Math.ceil((potenciaKwp * 1000) / CONFIG.wattsPerPanel);
    const potenciaReal = (numeroPlacas * CONFIG.wattsPerPanel) / 1000;
    const geracaoMensal = potenciaReal * CONFIG.geracaoMensalPorKwp;
    
    const economiaMensal = geracaoMensal * CONFIG.tarifaMediaKwh;
    const economiaAnual = economiaMensal * 12;
    const economia25Anos = economiaAnual * CONFIG.vidaUtilSistema;
    const co2Evitado = geracaoMensal * 12 * CONFIG.kgCo2PorKwh;
    
    const investimento = potenciaReal * CONFIG.custoPorKwp;
    const paybackAnos = investimento / economiaAnual;

    return {
      potenciaKwp: potenciaReal,
      numeroPlacas,
      geracaoMensal,
      economiaMensal,
      economiaAnual,
      economia25Anos,
      co2Evitado,
      investimento,
      paybackAnos,
    };
  }, [consumoMedio]);

  // Calculate financing
  const financingCalc = useMemo(() => {
    const bank = FINANCING_OPTIONS[selectedBank];
    const taxaMensal = bank.taxa_mensal / 100;
    const fator = Math.pow(1 + taxaMensal, parcelas);
    const valorParcela = calculations.investimento * (taxaMensal * fator) / (fator - 1);

    return {
      banco: bank.nome,
      parcelas,
      valorParcela,
      taxaMensal: bank.taxa_mensal,
    };
  }, [selectedBank, parcelas, calculations.investimento]);

  const handleGenerate = async () => {
    if (!clienteNome) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um lead ou orçamento para gerar a proposta.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const blob = await generateProposalPdf({
        clienteNome,
        clienteTelefone,
        clienteCidade,
        clienteEstado,
        clienteBairro,
        consumoMedio,
        tipoTelhado,
        redeAtendimento,
        area,
        potenciaKwp: calculations.potenciaKwp,
        numeroPlacas: calculations.numeroPlacas,
        geracaoMensal: calculations.geracaoMensal,
        economiaMensal: calculations.economiaMensal,
        economiaAnual: calculations.economiaAnual,
        economia25Anos: calculations.economia25Anos,
        co2Evitado: calculations.co2Evitado,
        investimentoEstimado: calculations.investimento,
        paybackAnos: calculations.paybackAnos,
        financiamento: includeFinancing ? financingCalc : undefined,
        vendedorNome,
        empresaNome: "MAIS ENERGIA SOLAR",
        empresaTelefone: "(00) 00000-0000",
      });

      downloadProposalPdf(blob, clienteNome);

      toast({
        title: "Proposta gerada!",
        description: "O PDF foi baixado com sucesso.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Erro ao gerar proposta",
        description: "Não foi possível gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!lead && !orcamento) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 opacity-20 mb-2" />
          <p className="text-sm font-medium">Selecione um lead ou orçamento</p>
          <p className="text-xs">Para gerar uma proposta comercial em PDF</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-primary" />
          Gerar Proposta PDF
        </CardTitle>
        <CardDescription>
          Proposta comercial personalizada para {clienteNome}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calculator className="h-4 w-4" />
              <span>Sistema</span>
            </div>
            <p className="font-bold text-lg">{calculations.potenciaKwp.toFixed(2)} kWp</p>
            <p className="text-xs text-muted-foreground">{calculations.numeroPlacas} placas</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Banknote className="h-4 w-4" />
              <span>Investimento</span>
            </div>
            <p className="font-bold text-lg">{formatCurrency(calculations.investimento)}</p>
            <p className="text-xs text-muted-foreground">Payback: {calculations.paybackAnos.toFixed(1)} anos</p>
          </div>
        </div>

        {/* Economia */}
        <div className="p-3 rounded-lg bg-accent/20 border border-accent">
          <p className="text-sm text-accent-foreground font-medium">Economia Estimada</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(calculations.economiaMensal)}
            </span>
            <span className="text-sm text-primary">/mês</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(calculations.economia25Anos)} em 25 anos
          </p>
        </div>

        {/* Financiamento */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="include-financing" className="text-sm font-medium">
              Incluir simulação de financiamento
            </Label>
            <Switch
              id="include-financing"
              checked={includeFinancing}
              onCheckedChange={setIncludeFinancing}
            />
          </div>

          {includeFinancing && (
            <div className="space-y-3 p-3 rounded-lg border">
              <div className="space-y-2">
                <Label className="text-xs">Banco</Label>
                <Select
                  value={selectedBank.toString()}
                  onValueChange={(v) => setSelectedBank(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINANCING_OPTIONS.map((bank, idx) => (
                      <SelectItem key={bank.nome} value={idx.toString()}>
                        {bank.nome} ({bank.taxa_mensal}% a.m.)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Parcelas</Label>
                  <Badge variant="secondary">{parcelas}x</Badge>
                </div>
                <Slider
                  value={[parcelas]}
                  onValueChange={(v) => setParcelas(v[0])}
                  min={12}
                  max={FINANCING_OPTIONS[selectedBank].max_parcelas}
                  step={6}
                />
              </div>

              <div className="p-2 bg-muted rounded text-center">
                <p className="text-xs text-muted-foreground">Parcela estimada</p>
                <p className="font-bold text-lg">{formatCurrency(financingCalc.valorParcela)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Generate button */}
        <Button
          className="w-full gap-2"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando PDF...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Baixar Proposta PDF
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
