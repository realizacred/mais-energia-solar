import { useState } from "react";
import { Facebook } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WizardStepper } from "@/components/admin/meta/config/WizardStepper";
import { StepCredentials } from "@/components/admin/meta/config/StepCredentials";
import { StepPages } from "@/components/admin/meta/config/StepPages";
import { StepAutomation } from "@/components/admin/meta/config/StepAutomation";
import { ConnectedPanel } from "@/components/admin/meta/config/ConnectedPanel";
import { useMetaFbConfigs, useMetaAutomation, META_KEYS } from "@/components/admin/meta/config/useMetaFbConfigs";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

const WIZARD_STEPS = [
  { label: "Conectar", description: "Credenciais do Meta" },
  { label: "Páginas", description: "Selecionar recursos" },
  { label: "Automação", description: "Funil e responsável" },
];

export default function MetaFacebookConfigPage() {
  const navigate = useNavigate();
  const { data: configs, isLoading: loadingConfigs } = useMetaFbConfigs();
  const { data: automation, isLoading: loadingAutomation } = useMetaAutomation();

  const [wizardStep, setWizardStep] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Resolve pipeline/stage names for connected panel
  const pipelineId = automation?.pipeline_id;
  const stageId = automation?.stage_id;

  const { data: pipelineName } = useQuery({
    queryKey: ["pipeline-name", pipelineId],
    queryFn: async () => {
      if (!pipelineId) return null;
      const { data } = await supabase.from("pipelines").select("name").eq("id", pipelineId).single();
      return data?.name || null;
    },
    staleTime: 1000 * 60 * 15,
    enabled: !!pipelineId,
  });

  const { data: stageName } = useQuery({
    queryKey: ["stage-name", stageId],
    queryFn: async () => {
      if (!stageId) return null;
      const { data } = await supabase.from("pipeline_stages").select("name").eq("id", stageId).single();
      return data?.name || null;
    },
    staleTime: 1000 * 60 * 15,
    enabled: !!stageId,
  });

  const { data: responsibleName } = useQuery({
    queryKey: ["responsible-name", automation?.responsible_user_id],
    queryFn: async () => {
      if (!automation?.responsible_user_id) return null;
      const { data } = await supabase.from("consultores").select("nome").eq("user_id", automation.responsible_user_id).maybeSingle();
      return data?.nome || null;
    },
    staleTime: 1000 * 60 * 15,
    enabled: !!automation?.responsible_user_id,
  });

  if (loadingConfigs || loadingAutomation) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Facebook} title="Meta Facebook Ads" description="Configure sua integração" />
        <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
      </div>
    );
  }

  const isConnected = !!configs?.[META_KEYS.accessToken]?.api_key;
  const hasAutomation = !!automation;

  // Determine view
  const shouldShowWizard = showWizard || !isConnected;

  // Success screen
  if (showSuccess) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Facebook} title="Meta Facebook Ads" description="Integração configurada" />
        <Card className="border-border/40">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Tudo pronto!</h2>
            <p className="text-sm text-muted-foreground">
              Facebook Ads configurado com sucesso. Os leads aparecerão automaticamente no CRM.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" onClick={() => { setShowSuccess(false); setShowWizard(false); }}>
                <Settings className="h-4 w-4 mr-1" /> Configurações
              </Button>
              <Button onClick={() => navigate("/admin/meta-dashboard")}>
                Ir para o painel <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Connected panel (already configured)
  if (isConnected && !shouldShowWizard) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Facebook} title="Meta Facebook Ads" description="Integração ativa" />
        <ConnectedPanel
          configs={configs!}
          automation={automation}
          pipelineName={pipelineName || undefined}
          stageName={stageName || undefined}
          responsibleName={responsibleName || undefined}
          onReconfigure={() => {
            setShowWizard(true);
            setWizardStep(hasAutomation ? 2 : 0);
          }}
        />
      </div>
    );
  }

  // Wizard
  return (
    <div className="space-y-6">
      <PageHeader icon={Facebook} title="Meta Facebook Ads" description="Configure sua integração em 3 passos" />

      <Card className="border-border/40">
        <CardContent className="p-5 space-y-6">
          <WizardStepper steps={WIZARD_STEPS} currentStep={wizardStep} />

          <div className="pt-2">
            {wizardStep === 0 && (
              <StepCredentials configs={configs || {}} onNext={() => setWizardStep(1)} />
            )}
            {wizardStep === 1 && (
              <StepPages
                configs={configs || {}}
                onNext={() => setWizardStep(2)}
                onBack={() => setWizardStep(0)}
              />
            )}
            {wizardStep === 2 && (
              <StepAutomation
                onNext={() => setShowSuccess(true)}
                onBack={() => setWizardStep(1)}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
