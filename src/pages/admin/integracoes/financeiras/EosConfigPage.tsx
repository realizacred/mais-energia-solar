import { useState } from "react";
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
import { ShieldCheck, Save, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function EosIntegrationConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

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

  // Update form when data is loaded
  useState(() => {
    if (config) {
      setFormData({
        client_id: config.client_id || "",
        client_secret: config.client_secret || "",
        ambiente: config.ambiente || "sandbox",
        ativo: config.ativo || false
      });
    }
  });

  // Using useEffect to sync form with fetched data
  const [initialized, setInitialized] = useState(false);
  if (config && !initialized) {
    setFormData({
      client_id: config.client_id || "",
      client_secret: config.client_secret || "",
      ambiente: config.ambiente || "sandbox",
      ativo: config.ativo || false
    });
    setInitialized(true);
  }

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
            Credenciais de Acesso
            <a 
              href="https://eos-loan.gitbook.io/eos-loan" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs font-normal text-primary flex items-center gap-1 hover:underline"
            >
              Documentação <ExternalLink className="h-3 w-3" />
            </a>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="client_id">Client ID</Label>
            <Input 
              id="client_id" 
              placeholder="Digite o Client ID fornecido pela EOS"
              value={formData.client_id}
              onChange={(e) => setFormData({...formData, client_id: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_secret">Client Secret</Label>
            <Input 
              id="client_secret" 
              type="password"
              placeholder="••••••••••••••••"
              value={formData.client_secret}
              onChange={(e) => setFormData({...formData, client_secret: e.target.value})}
            />
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

          <div className="pt-4 flex justify-end">
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
            <li>As credenciais são armazenadas de forma segura e acessíveis apenas por administradores do seu tenant.</li>
            <li>O token de acesso (access_token) nunca é armazenado em banco de dados, apenas em memória durante a execução das chamadas.</li>
            <li>Recomendamos validar as simulações em ambiente de Sandbox antes de ativar a Produção.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
