import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLeadOrcamento } from "@/hooks/useLeadOrcamento";
import { useFormRateLimit } from "@/hooks/useFormRateLimit";
import { useHoneypot } from "@/hooks/useHoneypot";
import { HoneypotField } from "@/components/form";
import { FloatingInput } from "@/components/ui/floating-input";
import { FloatingSelect } from "@/components/ui/floating-select";
import { CalculadoraResults } from "@/components/calculadora/CalculadoraResults";
import { StepIndicator } from "@/components/calculadora/StepIndicator";
import FinancingSimulator from "@/components/FinancingSimulator";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import {
  formatPhone,
  formatCEP,
  ESTADOS_BRASIL,
  TIPOS_TELHADO,
  REDES_ATENDIMENTO,
} from "@/lib/validations";
import {
  Sun,
  Zap,
  ArrowRight,
  ArrowLeft,
  Calculator,
  Loader2,
  CheckCircle,
  User,
  MapPin,
  Home,
  Send,
  Info,
  Sparkles,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "react-router-dom";

// ─── Schemas ────────────────────────────────────────────────────
const phoneRegex = /^\(\d{2}\) \d{4,5}-\d{4}$/;

const step1Schema = z.object({
  nome: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  telefone: z.string().trim().regex(phoneRegex, "Telefone inválido. Ex: (11) 99999-9999"),
  cep: z.string().optional().refine((v) => !v || /^\d{5}-\d{3}$/.test(v), "CEP inválido"),
  estado: z.string().min(2, "Selecione um estado"),
  cidade: z.string().trim().min(2, "Informe a cidade").max(100),
});

const step2Schema = z.object({
  consumoMensal: z.number().min(50, "Mínimo 50 kWh").max(50000, "Máximo 50.000 kWh"),
  tipo_telhado: z.string().min(1, "Selecione o tipo de telhado"),
  rede_atendimento: z.string().min(1, "Selecione a rede"),
  area: z.enum(["Urbana", "Rural"], { required_error: "Selecione" }),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

// ─── Config ─────────────────────────────────────────────────────
interface CalcConfig {
  tarifa_media_kwh: number;
  custo_por_kwp: number;
  geracao_mensal_por_kwp: number;
  kg_co2_por_kwh: number;
  percentual_economia: number;
}

const DEFAULT_CONFIG: CalcConfig = {
  tarifa_media_kwh: 0.85,
  custo_por_kwp: 4500,
  geracao_mensal_por_kwp: 120,
  kg_co2_por_kwh: 0.084,
  percentual_economia: 95,
};

const STEPS = [
  { id: 1, title: "Seus Dados", icon: <User className="w-4 h-4" /> },
  { id: 2, title: "Consumo", icon: <Zap className="w-4 h-4" /> },
  { id: 3, title: "Resultado", icon: <Sun className="w-4 h-4" /> },
];

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d < 0 ? 200 : -200, opacity: 0 }),
};

// ─── Page Component ─────────────────────────────────────────────
export default function Calculadora() {
  const [config, setConfig] = useState<CalcConfig>(DEFAULT_CONFIG);
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [tarifaKwh, setTarifaKwh] = useState(DEFAULT_CONFIG.tarifa_media_kwh);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const { toast } = useToast();
  const { submitOrcamento } = useLeadOrcamento();
  const { honeypotValue, handleHoneypotChange, validateHoneypot, resetHoneypot } = useHoneypot();
  const { checkRateLimit, recordAttempt, isBlocked } = useFormRateLimit({
    maxAttempts: 5, windowMs: 60000, cooldownMs: 300000,
  });

  // ─── Forms ──────────────────────────────────────────────────
  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    mode: "onBlur",
    defaultValues: { nome: "", telefone: "", cep: "", estado: "", cidade: "" },
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    mode: "onBlur",
    defaultValues: { consumoMensal: 300, tipo_telhado: "", rede_atendimento: "", area: undefined },
  });

  const consumoMensal = step2Form.watch("consumoMensal") || 300;

  // ─── Fetch config ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_calculator_config");
        if (error) throw error;
        if (data?.[0]) {
          setConfig(data[0]);
          setTarifaKwh(Number(data[0].tarifa_media_kwh));
        }
      } catch (e) {
        console.error("Erro ao buscar configuração:", e);
      }
    })();
  }, []);

  // ─── CEP auto-fill ────────────────────────────────────────
  const handleCEPBlur = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        step1Form.setValue("estado", data.uf);
        step1Form.setValue("cidade", data.localidade);
      }
    } catch {}
  };

  // ─── Calculations ─────────────────────────────────────────
  const calcs = useMemo(() => {
    const kWp = consumoMensal / config.geracao_mensal_por_kwp;
    const economiaMensal = consumoMensal * tarifaKwh * (config.percentual_economia / 100);
    return {
      investimento: kWp * config.custo_por_kwp,
      economiaMensal,
    };
  }, [consumoMensal, tarifaKwh, config]);

  // ─── Navigation ───────────────────────────────────────────
  const goNext = async () => {
    if (currentStep === 1) {
      const valid = await step1Form.trigger();
      if (!valid) return;
    }
    if (currentStep === 2) {
      const valid = await step2Form.trigger();
      if (!valid) return;
    }
    setDirection(1);
    setCurrentStep((s) => Math.min(s + 1, 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setDirection(-1);
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  // ─── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateHoneypot().isBot === false) {
      // silently fail for bots
      toast({ title: "Orçamento enviado! ☀️" });
      return;
    }
    if (!checkRateLimit()) {
      toast({
        title: "Muitas tentativas",
        description: "Aguarde alguns minutos.",
        variant: "destructive",
      });
      return;
    }

    recordAttempt();
    setIsSubmitting(true);

    const s1 = step1Form.getValues();
    const s2 = step2Form.getValues();

    try {
      const result = await submitOrcamento(
        { nome: s1.nome.trim(), telefone: s1.telefone.trim() },
        {
          cep: s1.cep || null,
          estado: s1.estado,
          cidade: s1.cidade.trim(),
          area: s2.area,
          tipo_telhado: s2.tipo_telhado,
          rede_atendimento: s2.rede_atendimento,
          media_consumo: s2.consumoMensal,
          consumo_previsto: s2.consumoMensal,
          vendedor: null,
        },
        { forceNew: false }
      );

      if (result.success) {
        resetHoneypot();
        setIsSuccess(true);
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        toast({
          title: "Orçamento solicitado com sucesso! ☀️",
          description: "Nossa equipe entrará em contato em breve.",
        });
      } else if (result.error === "DUPLICATE_DETECTED") {
        // For calculator, just force create
        const forceResult = await submitOrcamento(
          { nome: s1.nome.trim(), telefone: s1.telefone.trim() },
          {
            cep: s1.cep || null,
            estado: s1.estado,
            cidade: s1.cidade.trim(),
            area: s2.area,
            tipo_telhado: s2.tipo_telhado,
            rede_atendimento: s2.rede_atendimento,
            media_consumo: s2.consumoMensal,
            consumo_previsto: s2.consumoMensal,
            vendedor: null,
          },
          { forceNew: true }
        );
        if (forceResult.success) {
          resetHoneypot();
          setIsSuccess(true);
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
          toast({
            title: "Orçamento solicitado com sucesso! ☀️",
            description: "Nossa equipe entrará em contato em breve.",
          });
        }
      } else {
        toast({
          title: "Erro ao enviar",
          description: result.error || "Tente novamente.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro ao enviar",
        description: "Ocorreu um erro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Success State ────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="min-h-screen gradient-mesh flex flex-col">
        <Header showCalculadora={false} />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md mx-auto"
          >
            <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              Orçamento Solicitado!
            </h1>
            <p className="text-muted-foreground mb-8">
              Recebemos seus dados e nossa equipe entrará em contato em breve
              com um orçamento personalizado para o seu imóvel.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/">
                <Button variant="outline" className="gap-2 w-full sm:w-auto">
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao Início
                </Button>
              </Link>
              <Button
                onClick={() => {
                  setIsSuccess(false);
                  setCurrentStep(1);
                  step1Form.reset();
                  step2Form.reset();
                }}
                className="gap-2"
              >
                <Calculator className="w-4 h-4" />
                Nova Simulação
              </Button>
            </div>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="min-h-screen gradient-mesh flex flex-col">
      <Header showCalculadora={false}>
        <Link to="/">
          <Button variant="default" size="sm" className="gap-2">
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
        </Link>
      </Header>

      <main className="flex-1 container mx-auto px-4 py-6 md:py-10 max-w-4xl">
        {/* Hero */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Badge className="mb-3 bg-primary/10 text-primary border-0 px-3 py-1">
            <Sparkles className="w-3 h-3 mr-1.5" />
            Simulação Gratuita
          </Badge>
          <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">
            Descubra Sua Economia com Energia Solar
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
            Simule em menos de 2 minutos e receba um orçamento personalizado
          </p>
        </motion.div>

        {/* Step indicator */}
        <div className="mb-8">
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>

        {/* Steps content */}
        <AnimatePresence mode="wait" custom={direction}>
          {currentStep === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Card className="max-w-lg mx-auto shadow-lg border-t-4 border-t-primary">
                <CardContent className="p-6 md:p-8 space-y-5">
                  <div className="text-center mb-2">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Para quem é o orçamento?
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Precisamos de algumas informações para personalizar sua simulação
                    </p>
                  </div>

                  <div className="space-y-4">
                    <FloatingInput
                      id="nome"
                      label="Seu nome completo"
                      value={step1Form.watch("nome")}
                      onChange={(e) => step1Form.setValue("nome", e.target.value, { shouldValidate: true })}
                      onBlur={() => step1Form.trigger("nome")}
                      error={step1Form.formState.errors.nome?.message}
                    />

                    <FloatingInput
                      id="telefone"
                      label="WhatsApp / Telefone"
                      value={step1Form.watch("telefone")}
                      onChange={(e) => {
                        const formatted = formatPhone(e.target.value);
                        step1Form.setValue("telefone", formatted, { shouldValidate: true });
                      }}
                      onBlur={() => step1Form.trigger("telefone")}
                      maxLength={15}
                      error={step1Form.formState.errors.telefone?.message}
                    />

                    <FloatingInput
                      id="cep"
                      label="CEP (opcional)"
                      value={step1Form.watch("cep") || ""}
                      onChange={(e) => {
                        const formatted = formatCEP(e.target.value);
                        step1Form.setValue("cep", formatted, { shouldValidate: true });
                      }}
                      onBlur={(e) => {
                        step1Form.trigger("cep");
                        handleCEPBlur(e.target.value);
                      }}
                      maxLength={9}
                      error={step1Form.formState.errors.cep?.message}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <FloatingSelect
                        label="Estado"
                        value={step1Form.watch("estado")}
                        onValueChange={(v) => step1Form.setValue("estado", v, { shouldValidate: true })}
                        error={step1Form.formState.errors.estado?.message}
                        options={ESTADOS_BRASIL.map((e) => ({
                          value: e.sigla,
                          label: e.sigla,
                        }))}
                      />
                      <FloatingInput
                        id="cidade"
                        label="Cidade"
                        value={step1Form.watch("cidade")}
                        onChange={(e) => step1Form.setValue("cidade", e.target.value, { shouldValidate: true })}
                        onBlur={() => step1Form.trigger("cidade")}
                        error={step1Form.formState.errors.cidade?.message}
                      />
                    </div>
                  </div>

                  <HoneypotField value={honeypotValue} onChange={handleHoneypotChange} />

                  <Button
                    onClick={goNext}
                    className="w-full h-12 text-base gap-2"
                    size="lg"
                  >
                    Continuar
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Card className="max-w-lg mx-auto shadow-lg border-t-4 border-t-secondary">
                <CardContent className="p-6 md:p-8 space-y-5">
                  <div className="text-center mb-2">
                    <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-3">
                      <Zap className="w-6 h-6 text-secondary" />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Sobre seu consumo de energia
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Veja na sua conta de luz ou use uma estimativa
                    </p>
                  </div>

                  {/* Consumo slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-semibold">
                          Consumo Mensal
                        </Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3.5 h-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-[200px]">
                              Valor em kWh que aparece na sua conta de luz
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-1.5 bg-muted rounded-lg px-3 py-1.5">
                        <input
                          type="number"
                          value={consumoMensal}
                          onChange={(e) =>
                            step2Form.setValue(
                              "consumoMensal",
                              Number(e.target.value) || 0,
                              { shouldValidate: true }
                            )
                          }
                          className="w-16 bg-transparent text-right font-bold text-lg focus:outline-none"
                        />
                        <span className="text-sm text-muted-foreground font-medium">
                          kWh
                        </span>
                      </div>
                    </div>
                    <Slider
                      value={[consumoMensal]}
                      onValueChange={(v) =>
                        step2Form.setValue("consumoMensal", v[0], {
                          shouldValidate: true,
                        })
                      }
                      min={50}
                      max={3000}
                      step={10}
                      className="py-4"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>50 kWh</span>
                      <span>3.000 kWh</span>
                    </div>
                    {step2Form.formState.errors.consumoMensal && (
                      <p className="text-xs text-destructive">
                        {step2Form.formState.errors.consumoMensal.message}
                      </p>
                    )}
                  </div>

                  {/* Tarifa */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Tarifa (R$/kWh)</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3.5 h-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Valor cobrado pela concessionária</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={tarifaKwh}
                        onChange={(e) =>
                          setTarifaKwh(Number(e.target.value) || 0)
                        }
                        className="w-16 bg-transparent text-right font-medium focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Tipo telhado + Rede + Area */}
                  <div className="space-y-3">
                    <FloatingSelect
                      label="Tipo de telhado"
                      value={step2Form.watch("tipo_telhado")}
                      onValueChange={(v) =>
                        step2Form.setValue("tipo_telhado", v, {
                          shouldValidate: true,
                        })
                      }
                      error={step2Form.formState.errors.tipo_telhado?.message}
                      options={TIPOS_TELHADO.map((t) => ({
                        value: t,
                        label: t,
                      }))}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <FloatingSelect
                        label="Rede elétrica"
                        value={step2Form.watch("rede_atendimento")}
                        onValueChange={(v) =>
                          step2Form.setValue("rede_atendimento", v, {
                            shouldValidate: true,
                          })
                        }
                        error={step2Form.formState.errors.rede_atendimento?.message}
                        options={REDES_ATENDIMENTO.map((r) => ({
                          value: r,
                          label: r,
                        }))}
                      />
                      <FloatingSelect
                        label="Área"
                        value={step2Form.watch("area") || ""}
                        onValueChange={(v) =>
                          step2Form.setValue(
                            "area",
                            v as "Urbana" | "Rural",
                            { shouldValidate: true }
                          )
                        }
                        error={step2Form.formState.errors.area?.message}
                        options={[
                          { value: "Urbana", label: "Urbana" },
                          { value: "Rural", label: "Rural" },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Current bill preview */}
                  <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                    <p className="text-xs text-muted-foreground mb-1">
                      Sua conta atual estimada
                    </p>
                    <p className="text-2xl font-bold text-destructive">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        maximumFractionDigits: 0,
                      }).format(consumoMensal * tarifaKwh)}
                      <span className="text-sm font-normal text-muted-foreground">
                        /mês
                      </span>
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={goBack}
                      className="gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Voltar
                    </Button>
                    <Button
                      onClick={goNext}
                      className="flex-1 h-12 text-base gap-2"
                      size="lg"
                    >
                      Ver Meu Resultado
                      <Sparkles className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <div className="space-y-6">
                <CalculadoraResults
                  consumoMensal={consumoMensal}
                  tarifaKwh={tarifaKwh}
                  config={config}
                />

                <FinancingSimulator
                  investimento={calcs.investimento}
                  economia={calcs.economiaMensal}
                />

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={goBack}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Ajustar Dados
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || isBlocked}
                    className="flex-1 h-14 text-lg gap-2 bg-secondary hover:bg-secondary/90"
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Receber Orçamento Detalhado
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}
