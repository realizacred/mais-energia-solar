import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { 
  ShieldCheck, 
  Save, 
  ExternalLink, 
  Key, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  UserPlus,
  Building2,
  FileCheck
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export default function EosIntegrationConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const { data: config, isLoading: isConfigLoading } = useQuery({
    queryKey: ["financeiras-config", "eos"],
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user?.id).single();
      if (!profile?.tenant_id) return null;

      const { data, error } = await supabase
        .from("financeiras_config")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("financeira", "eos")
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: tenantData } = useQuery({
    queryKey: ["tenant-data"],
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user?.id).single();
      if (!profile?.tenant_id) return null;

      const { data: tenant } = await supabase.from("tenants").select("*").eq("id", profile.tenant_id).single();
      const { data: adminProfile } = await supabase.from("profiles").select("*").eq("id", tenant?.owner_user_id).single();

      return { tenant, adminProfile };
    },
    enabled: !!user,
  });

  const [formData, setFormData] = useState({
    eos_api_key: "",
    ambiente: "sandbox",
    ativo: false,
    eos_onboarding_step: 1,
    eos_integrador_id: ""
  });

  useEffect(() => {
    if (config) {
      setFormData({
        eos_api_key: config.eos_api_key || "",
        ambiente: config.ambiente || "sandbox",
        ativo: config.ativo || false,
        eos_onboarding_step: config.eos_onboarding_step || 1,
        eos_integrador_id: config.eos_integrador_id || ""
      });
      if (config.eos_api_key) setTestResult('success');
    }
  }, [config]);

  const handleSave = async (silent = false) => {
    if (!silent) setIsSaving(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user?.id).single();
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      const payload = {
        tenant_id: profile.tenant_id,
        financeira: "eos",
        eos_api_key: formData.eos_api_key,
        ambiente: formData.ambiente,
        ativo: formData.ativo,
        eos_onboarding_step: formData.eos_onboarding_step,
        eos_integrador_id: formData.eos_integrador_id,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("financeiras_config")
        .upsert(payload as any, { onConflict: 'tenant_id,financeira' });

      if (error) throw error;

      if (!silent) toast({ title: "Configuração EOS salva com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["financeiras-config"] });
    } catch (error: any) {
      if (!silent) toast({ 
        title: "Erro ao salvar", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      if (!silent) setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user?.id).single();
      
      const { data, error } = await supabase.functions.invoke('eos-simular', {
        body: {
          analise_id: crypto.randomUUID(),
          tenant_id: profile?.tenant_id,
          test_mode: true 
        }
      });

      if (error) throw error;
      setTestResult('success');
      toast({ title: "Conexão estabelecida com sucesso" });
      
      // Se era o passo 1 e não tinha step salvo, avançar
      if (formData.eos_onboarding_step === 1) {
        setFormData(prev => ({ ...prev, eos_onboarding_step: 1 })); // Mantém 1 mas habilita visualmente o próximo se quiser
      }
    } catch (error: any) {
      setTestResult('error');
      toast({ 
        title: "Erro de autenticação", 
        description: "Verifique sua API Key e o ambiente selecionado.", 
        variant: "destructive" 
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRegisterIntegrador = async () => {
    setIsRegistering(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user?.id).single();
      
      const { data, error } = await supabase.functions.invoke('eos-criar-integrador', {
        body: { tenant_id: profile?.tenant_id }
      });

      if (error) throw error;

      toast({ 
        title: "Empresa registrada na EOS!", 
        description: `ID Integrador: ${data.integrador_id}` 
      });
      
      setFormData(prev => ({ 
        ...prev, 
        eos_integrador_id: data.integrador_id,
        eos_onboarding_step: 2
      }));
      
      queryClient.invalidateQueries({ queryKey: ["financeiras-config"] });
    } catch (error: any) {
      toast({ 
        title: "Erro no registro", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsRegistering(false);
    }
  };

  if (isConfigLoading) return <div className="p-8 text-center">Carregando configurações...</div>;

  const currentStep = formData.eos_onboarding_step;

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-primary/10 rounded-lg">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">EOS Financiamento Solar</h1>
          <p className="text-muted-foreground text-sm">Onboarding e Configuração da Integração</p>
        </div>
      </div>

      {/* Steps Indicator */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { step: 1, label: "API Key", icon: Key },
          { step: 2, label: "Registro", icon: Building2 },
          { step: 3, label: "Webhooks", icon: RefreshCw }
        ].map((s) => (
          <div 
            key={s.step}
            className={cn(
              "flex flex-col items-center p-3 rounded-lg border transition-all",
              currentStep >= s.step ? "bg-primary/5 border-primary/20" : "bg-muted/50 border-transparent opacity-50"
            )}
          >
            <s.icon className={cn("h-5 w-5 mb-1", currentStep >= s.step ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("text-xs font-medium", currentStep >= s.step ? "text-primary" : "text-muted-foreground")}>
              Passo {s.step}: {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {/* Step 1: API Key */}
        <Card className={cn("border-border/40 shadow-sm transition-all", currentStep > 1 && "opacity-75")}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Passo 1: Autenticação
              {testResult === 'success' && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> API Key Válida
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Insira sua API Key obtida no painel da EOS.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="eos_api_key">x-api-key</Label>
              <div className="relative">
                <Input 
                  id="eos_api_key" 
                  type="password"
                  placeholder="Token de acesso EOS"
                  value={formData.eos_api_key}
                  onChange={(e) => setFormData({...formData, eos_api_key: e.target.value})}
                  className="pr-10"
                />
                <Key className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ambiente</Label>
                <Select 
                  value={formData.ambiente} 
                  onValueChange={(v) => setFormData({...formData, ambiente: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (Teste)</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <Button 
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleTestConnection}
                  disabled={isTesting || !formData.eos_api_key}
                >
                  <RefreshCw className={cn("h-4 w-4", isTesting && "animate-spin")} />
                  {isTesting ? "Testando..." : "Testar Conexão"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Registro */}
        <Card className={cn(
          "border-border/40 shadow-sm transition-all", 
          testResult !== 'success' && "opacity-40 grayscale pointer-events-none"
        )}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Passo 2: Registro de Integrador
              {formData.eos_integrador_id && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1">
                  <FileCheck className="h-3 w-3" /> Registrado
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Registre sua empresa como integrador na plataforma EOS.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenantData && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empresa:</span>
                  <span className="font-medium">{tenantData.tenant?.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CNPJ:</span>
                  <span className="font-medium">{tenantData.tenant?.documento}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Responsável:</span>
                  <span className="font-medium">{tenantData.adminProfile?.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">E-mail:</span>
                  <span className="font-medium">{user?.email}</span>
                </div>
              </div>
            )}

            {!formData.eos_integrador_id ? (
              <Button 
                className="w-full gap-2"
                onClick={handleRegisterIntegrador}
                disabled={isRegistering}
              >
                <UserPlus className="h-4 w-4" />
                {isRegistering ? "Registrando..." : "Registrar empresa na EOS"}
              </Button>
            ) : (
              <div className="space-y-2">
                <Label>ID Integrador (EOS)</Label>
                <Input value={formData.eos_integrador_id} readOnly className="bg-muted font-mono" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Global Controls */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Switch 
                checked={formData.ativo} 
                onCheckedChange={(v) => setFormData({...formData, ativo: v})}
                disabled={!formData.eos_integrador_id}
              />
              <div>
                <p className="font-medium leading-none mb-1">Status da Integração</p>
                <p className="text-xs text-muted-foreground">
                  {formData.ativo ? "Integrado e enviando propostas" : "Integração inativa"}
                </p>
              </div>
            </div>
            <Button 
              className="gap-2" 
              onClick={() => handleSave()} 
              disabled={isSaving}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Salvando..." : "Finalizar Configuração"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30 border-dashed border-2">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">Notas de Segurança:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>A API Key é armazenada de forma segura e acessível apenas pelo motor de crédito do servidor.</li>
            <li>A EOS utiliza uma chave estática (x-api-key) que não expira.</li>
            <li>Recomendamos validar as simulações em ambiente de Sandbox antes de ativar a Produção.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
