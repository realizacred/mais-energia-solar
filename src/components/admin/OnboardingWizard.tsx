import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { EmailInput } from "@/components/ui/EmailInput";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useUpdateOnboardingStep, useCompleteOnboarding } from "@/hooks/useOnboarding";
import {
  useSaveOnboardingEmpresa,
  useSaveOnboardingConsultor,
  useSaveOnboardingLead,
} from "@/hooks/useOnboardingMutations";
import {
  Sparkles,
  Building2,
  UserPlus,
  Target,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  userName?: string;
}

const STEPS = [
  { icon: Sparkles, title: "Bem-vindo!", label: "Início" },
  { icon: Building2, title: "Sua Empresa", label: "Empresa" },
  { icon: UserPlus, title: "Primeiro Consultor", label: "Consultor" },
  { icon: Target, title: "Primeiro Lead", label: "Lead" },
  { icon: CheckCircle2, title: "Tudo Pronto!", label: "Concluído" },
];

export function OnboardingWizard({ open, onOpenChange, tenantId, userName }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const updateStep = useUpdateOnboardingStep();
  const completeOnboarding = useCompleteOnboarding();
  const saveEmpresa = useSaveOnboardingEmpresa();
  const saveConsultor = useSaveOnboardingConsultor();
  const saveLead = useSaveOnboardingLead();

  // Step 1 — Company
  const [empresa, setEmpresa] = useState({ nome: "", documento: "", telefone: "", cidade: "" });

  // Step 2 — Consultant
  const [consultor, setConsultor] = useState({ nome: "", telefone: "", email: "" });

  // Step 3 — Lead
  const [lead, setLead] = useState({ nome: "", telefone: "" });

  const loading = saveEmpresa.isPending || saveConsultor.isPending || saveLead.isPending;

  const goNext = async () => {
    const next = step + 1;
    setStep(next);
    updateStep.mutate({ tenantId, step: next });
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const handleSaveEmpresa = async () => {
    if (!empresa.nome.trim()) {
      toast.error("Informe o nome da empresa");
      return;
    }
    try {
      await saveEmpresa.mutateAsync({
        tenantId,
        nome: empresa.nome.trim(),
        documento: empresa.documento.trim() || null,
        cidade: empresa.cidade.trim() || null,
      });
      toast.success("Empresa salva!");
      goNext();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar empresa");
    }
  };

  const handleSaveConsultor = async () => {
    if (!consultor.nome.trim() || !consultor.telefone.trim()) {
      toast.error("Preencha nome e telefone do consultor");
      return;
    }
    try {
      const code = consultor.nome.trim().substring(0, 3).toUpperCase() + "01";
      await saveConsultor.mutateAsync({
        tenantId,
        nome: consultor.nome.trim(),
        telefone: consultor.telefone.trim(),
        email: consultor.email.trim() || null,
        codigo: code,
      });
      toast.success("Consultor adicionado!");
      goNext();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar consultor");
    }
  };

  const handleSaveLead = async () => {
    if (!lead.nome.trim() || !lead.telefone.trim()) {
      toast.error("Preencha nome e telefone do lead");
      return;
    }
    try {
      await saveLead.mutateAsync({
        nome: lead.nome.trim(),
        telefone: lead.telefone.trim(),
      });
      toast.success("Lead cadastrado!");
      goNext();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar lead");
    }
  };

  const handleFinish = async () => {
    completeOnboarding.mutate(tenantId, {
      onSuccess: () => {
        toast.success("Onboarding concluído! Boas vendas! 🎉");
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Stepper */}
        <div className="shrink-0 px-6 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === step;
              const done = i < step;
              return (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      done
                        ? "bg-success text-success-foreground"
                        : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground hidden sm:block">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <DialogHeader className="px-6 pt-4 pb-2 shrink-0">
          <DialogTitle className="text-lg font-semibold text-foreground">
            {STEPS[step].title}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 pb-6 space-y-4">
            {/* Step 0 — Welcome */}
            {step === 0 && (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  Olá{userName ? `, ${userName}` : ""}! 👋
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Vamos configurar o seu CRM em poucos passos. É rápido e você pode ajustar tudo depois.
                </p>
              </div>
            )}

            {/* Step 1 — Company */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Informações básicas da sua empresa de energia solar.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Nome da empresa *</Label>
                    <Input
                      placeholder="Ex: Sol Engenharia"
                      value={empresa.nome}
                      onChange={(e) => setEmpresa((p) => ({ ...p, nome: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input
                      placeholder="00.000.000/0001-00"
                      value={empresa.documento}
                      onChange={(e) => setEmpresa((p) => ({ ...p, documento: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      placeholder="Ex: Uberlândia"
                      value={empresa.cidade}
                      onChange={(e) => setEmpresa((p) => ({ ...p, cidade: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 — Consultant */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Adicione seu primeiro consultor comercial. Você pode pular e adicionar depois.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Nome *</Label>
                    <Input
                      placeholder="Nome do consultor"
                      value={consultor.nome}
                      onChange={(e) => setConsultor((p) => ({ ...p, nome: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone *</Label>
                    <PhoneInput
                      value={consultor.telefone}
                      onChange={(raw) => setConsultor((p) => ({ ...p, telefone: raw }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <EmailInput
                      value={consultor.email}
                      onChange={(v) => setConsultor((p) => ({ ...p, email: v }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 — Lead */}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Cadastre um lead de teste para ver o sistema em ação.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      placeholder="Nome do lead"
                      value={lead.nome}
                      onChange={(e) => setLead((p) => ({ ...p, nome: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone *</Label>
                    <PhoneInput
                      value={lead.telefone}
                      onChange={(raw) => setLead((p) => ({ ...p, telefone: raw }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4 — Done */}
            {step === 4 && (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Tudo pronto! 🎉</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Seu CRM está configurado. Explore o painel de leads, crie propostas e acompanhe seus resultados.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-6 py-4 border-t border-border bg-muted/30">
          <div>
            {step > 0 && step < 4 && (
              <Button variant="ghost" onClick={goBack} disabled={loading}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Skip for steps 2 and 3 */}
            {(step === 2 || step === 3) && (
              <Button variant="ghost" onClick={goNext} disabled={loading}>
                Pular
              </Button>
            )}

            {step === 0 && (
              <Button onClick={goNext}>
                Começar <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step === 1 && (
              <Button onClick={handleSaveEmpresa} disabled={loading}>
                {loading ? "Salvando..." : "Salvar e continuar"}
              </Button>
            )}
            {step === 2 && (
              <Button onClick={handleSaveConsultor} disabled={loading}>
                {loading ? "Salvando..." : "Adicionar consultor"}
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleSaveLead} disabled={loading}>
                {loading ? "Salvando..." : "Cadastrar lead"}
              </Button>
            )}
            {step === 4 && (
              <Button onClick={handleFinish} disabled={completeOnboarding.isPending}>
                Ir para o painel <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
