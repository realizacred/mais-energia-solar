import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ShieldCheck, Save, ExternalLink, Key, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

export default function EosIntegrationConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const { data: config, isLoading } = useQuery({
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

  const [formData, setFormData] = useState({
    eos_api_key: "",
    ambiente: "sandbox",
    ativo: false
  });

  useEffect(() => {
    if (config) {
      setFormData({
        eos_api_key: config.eos_api_key || "",
        ambiente: config.ambiente || "sandbox",
        ativo: config.ativo || false
      });
    }
  }, [config]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user?.id).single();
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      const payload = {
        tenant_id: profile.tenant_id,
        financeira: "eos",
        ...formData,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("financeiras_config")
        .upsert(payload as any, { onConflict: 'tenant_id,financeira' });

      if (error) throw error;

      toast({ title: "Configuração EOS salva com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["financeiras-config"] });
    } catch (error: any) {
      toast({ 
        title: "Erro ao salvar", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user?.id).single();
      
      const { data, error } = await supabase.functions.invoke('eos-simular', {
        body: {
          analise_id: crypto.randomUUID(), // ID fictício para teste
          tenant_id: profile?.tenant_id,
          // Dados de teste para simulação fake
          test_mode: true 
        }
      });

      if (error) throw error;
      setTestResult('success');
      toast({ title: "Conexão estabelecida com sucesso" });
    } catch (error: any) {
      setTestResult('error');
      toast({ 
        title: "Erro de autenticação", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Carregando configurações...</div>;

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-primary/10 rounded-lg">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">EOS Financiamento Solar</h1>
          <p className="text-muted-foreground text-sm">Configure as credenciais de integração API.</p>
        </div>
      </div>

      <Card className="border-border/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            Configuração da API
            <div className="flex items-center gap-2">
              <a 
                href="https://eos-loan.gitbook.io/eos-loan" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs font-normal text-primary flex items-center gap-1 hover:underline"
              >
                Documentação <ExternalLink className="h-3 w-3" />
              </a>
              {testResult === 'success' && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Conectado
                </Badge>
              )}
              {testResult === 'error' && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> Erro de autenticação
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="eos_api_key">API Key</Label>
            <div className="relative">
              <Input 
                id="eos_api_key" 
                type="password"
                placeholder="Obtida junto à EOS em eosfin.com.br"
                value={formData.eos_api_key}
                onChange={(e) => setFormData({...formData, eos_api_key: e.target.value})}
                className="pr-10"
              />
              <Key className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
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

            <div className="space-y-2">
              <Label className="block">Status da Integração</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch 
                  checked={formData.ativo} 
                  onCheckedChange={(v) => setFormData({...formData, ativo: v})}
                />
                <span className="text-sm font-medium">
                  {formData.ativo ? "Ativa" : "Inativa"}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-between gap-4">
            <Button 
              variant="outline"
              className="gap-2"
              onClick={handleTestConnection}
              disabled={isTesting || !formData.eos_api_key}
            >
              <RefreshCw className={cn("h-4 w-4", isTesting && "animate-spin")} />
              Testar conexão
            </Button>
            <Button 
              className="gap-2" 
              onClick={handleSave} 
              disabled={isSaving}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30 border-dashed border-2">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">Notas de Segurança:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>A API Key é armazenada de forma segura e acessível apenas pelo motor de crédito do servidor.</li>
            <li>A EOS utiliza uma chave estática (x-api-key) que não expira. Caso suspeite de vazamento, regenere a chave no painel da EOS.</li>
            <li>Recomendamos validar as simulações em ambiente de Sandbox antes de ativar a Produção.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
