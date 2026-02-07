import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageCircle, 
  Settings, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Save,
  RefreshCw,
  Plug,
  Zap,
  XCircle,
  Bot
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { WhatsAppAutomationTemplates } from "./WhatsAppAutomationTemplates";

interface WhatsAppConfig {
  id: string;
  ativo: boolean;
  webhook_url: string | null;
  api_token: string | null;
  lembrete_dias: number;
  lembrete_ativo: boolean;
  mensagem_boas_vindas: string | null;
  mensagem_followup: string | null;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance: string | null;
  modo_envio: string;
}

interface WhatsAppMessage {
  id: string;
  lead_id: string;
  tipo: string;
  mensagem: string;
  telefone: string;
  status: string;
  created_at: string;
}

export function WhatsAppAutomationConfig() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch config
      const { data: configData } = await supabase
        .from("whatsapp_automation_config")
        .select("*")
        .single();

      if (configData) {
        setConfig(configData);
      }

      // Fetch recent messages
      const { data: messagesData } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (messagesData) {
        setMessages(messagesData);
      }
    } catch (error) {
      console.error("Error fetching WhatsApp config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_automation_config")
        .update({
          ativo: config.ativo,
          webhook_url: config.webhook_url,
          api_token: config.api_token,
          lembrete_dias: config.lembrete_dias,
          lembrete_ativo: config.lembrete_ativo,
          mensagem_boas_vindas: config.mensagem_boas_vindas,
          mensagem_followup: config.mensagem_followup,
          evolution_api_url: config.evolution_api_url,
          evolution_api_key: config.evolution_api_key,
          evolution_instance: config.evolution_instance,
          modo_envio: config.modo_envio,
        })
        .eq("id", config.id);

      if (error) throw error;

      toast({
        title: "Configuração salva!",
        description: "As configurações de WhatsApp foram atualizadas.",
      });
    } catch (error) {
      console.error("Error saving config:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-evolution-connection');
      
      if (error) throw error;
      
      setConnectionStatus({
        success: data.success,
        message: data.message || data.error || 'Teste concluído'
      });
      
      toast({
        title: data.success ? "Conexão OK!" : "Erro na conexão",
        description: data.message || data.error,
        variant: data.success ? "default" : "destructive",
      });
    } catch (error: any) {
      console.error("Error testing connection:", error);
      setConnectionStatus({
        success: false,
        message: error.message || 'Erro ao testar conexão'
      });
      toast({
        title: "Erro ao testar",
        description: error.message || "Não foi possível testar a conexão.",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "enviado":
        return <Badge className="bg-primary/10 text-primary">Enviado</Badge>;
      case "entregue":
        return <Badge className="bg-accent/20 text-accent-foreground">Entregue</Badge>;
      case "erro":
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case "automatico":
        return <Badge variant="secondary">Automático</Badge>;
      case "lembrete":
        return <Badge className="bg-secondary/20 text-secondary-foreground">Lembrete</Badge>;
      default:
        return <Badge variant="outline">Manual</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          Automação WhatsApp
        </CardTitle>
        <CardDescription>
          Configure mensagens automáticas e lembretes via WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="automacoes" className="gap-2">
              <Bot className="h-4 w-4" />
              Automações
            </TabsTrigger>
            <TabsTrigger value="integracao" className="gap-2">
              <Plug className="h-4 w-4" />
              Integração
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <Clock className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-6 mt-4">
            {config && (
              <>
                {/* Status Principal */}
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Automação Ativa</Label>
                    <p className="text-sm text-muted-foreground">
                      Ativar envio automático de mensagens
                    </p>
                  </div>
                  <Switch
                    checked={config.ativo}
                    onCheckedChange={(checked) => setConfig({ ...config, ativo: checked })}
                  />
                </div>

                {/* Lembretes */}
                <div className="space-y-4 p-4 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">Lembretes Automáticos</Label>
                      <p className="text-sm text-muted-foreground">
                        Enviar lembrete após X dias sem contato
                      </p>
                    </div>
                    <Switch
                      checked={config.lembrete_ativo}
                      onCheckedChange={(checked) => setConfig({ ...config, lembrete_ativo: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Dias para lembrete</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={config.lembrete_dias}
                      onChange={(e) => setConfig({ ...config, lembrete_dias: parseInt(e.target.value) || 3 })}
                    />
                  </div>
                </div>

                {/* Templates */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Templates de Mensagem</Label>
                  <p className="text-xs text-muted-foreground">
                    Use {"{nome}"} para o nome do cliente e {"{vendedor}"} para o nome do vendedor
                  </p>

                  <div className="space-y-2">
                    <Label>Mensagem de Boas-Vindas</Label>
                    <Textarea
                      value={config.mensagem_boas_vindas || ""}
                      onChange={(e) => setConfig({ ...config, mensagem_boas_vindas: e.target.value })}
                      rows={3}
                      placeholder="Olá {nome}! Sou {vendedor}, da Mais Energia Solar..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Mensagem de Follow-up</Label>
                    <Textarea
                      value={config.mensagem_followup || ""}
                      onChange={(e) => setConfig({ ...config, mensagem_followup: e.target.value })}
                      rows={3}
                      placeholder="Olá {nome}! Passando para saber se ainda tem interesse..."
                    />
                  </div>
                </div>

                {/* Save Button */}
                <Button 
                  className="w-full gap-2" 
                  onClick={handleSaveConfig}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar Configurações
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="automacoes" className="mt-4">
            <WhatsAppAutomationTemplates />
          </TabsContent>

          <TabsContent value="integracao" className="space-y-6 mt-4">
            {config && (
              <>
                {/* Modo de Envio */}
                <div className="space-y-2">
                  <Label className="text-base font-medium">Modo de Envio</Label>
                  <Select
                    value={config.modo_envio}
                    onValueChange={(value) => setConfig({ ...config, modo_envio: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o modo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="webhook">Apenas Webhook (n8n/Zapier)</SelectItem>
                      <SelectItem value="evolution">Apenas Evolution API</SelectItem>
                      <SelectItem value="ambos">Ambos (Webhook + Evolution)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Escolha como as mensagens serão enviadas
                  </p>
                </div>

                {/* Webhook Section */}
                {(config.modo_envio === "webhook" || config.modo_envio === "ambos") && (
                  <div className="space-y-4 p-4 rounded-lg border">
                    <h4 className="font-medium flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Configuração do Webhook
                    </h4>
                    <div className="space-y-2">
                      <Label>URL do Webhook</Label>
                      <Input
                        value={config.webhook_url || ""}
                        onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
                        placeholder="https://seu-n8n.com/webhook/..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Token de Autenticação (opcional)</Label>
                      <Input
                        type="password"
                        value={config.api_token || ""}
                        onChange={(e) => setConfig({ ...config, api_token: e.target.value })}
                        placeholder="Bearer token para autenticação"
                      />
                    </div>
                  </div>
                )}

                {/* Evolution API Section */}
                {(config.modo_envio === "evolution" || config.modo_envio === "ambos") && (
                  <div className="space-y-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
                    <h4 className="font-medium flex items-center gap-2 text-primary">
                      <Plug className="h-4 w-4" />
                      Evolution API
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Configure a integração direta com a Evolution API para envio de mensagens
                    </p>
                    <div className="space-y-2">
                      <Label>URL da API</Label>
                      <Input
                        value={config.evolution_api_url || ""}
                        onChange={(e) => setConfig({ ...config, evolution_api_url: e.target.value })}
                        placeholder="https://sua-evolution.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        value={config.evolution_api_key || ""}
                        onChange={(e) => setConfig({ ...config, evolution_api_key: e.target.value })}
                        placeholder="Sua chave de API da Evolution"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome da Instância</Label>
                      <Input
                        value={config.evolution_instance || ""}
                        onChange={(e) => setConfig({ ...config, evolution_instance: e.target.value })}
                        placeholder="nome-da-instancia"
                      />
                      <p className="text-xs text-muted-foreground">
                        Nome da instância do WhatsApp configurada na Evolution API
                      </p>
                    </div>

                    {/* Test Connection Button */}
                    <div className="pt-2 border-t">
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={handleTestConnection}
                        disabled={testingConnection || !config.evolution_api_url || !config.evolution_api_key || !config.evolution_instance}
                      >
                        {testingConnection ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                        Testar Conexão
                      </Button>
                      
                      {/* Connection Status */}
                      {connectionStatus && (
                        <div className={`mt-3 p-3 rounded-lg flex items-start gap-2 ${
                          connectionStatus.success 
                            ? 'bg-green-500/10 border border-green-500/30' 
                            : 'bg-destructive/10 border border-destructive/30'
                        }`}>
                          {connectionStatus.success ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                          )}
                          <p className={`text-sm ${
                            connectionStatus.success ? 'text-green-700' : 'text-destructive'
                          }`}>
                            {connectionStatus.message}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Save Button */}
                <Button 
                  className="w-full gap-2" 
                  onClick={handleSaveConfig}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar Integração
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="historico" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Últimas {messages.length} mensagens enviadas
              </p>
              <Button size="sm" variant="outline" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>

            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <MessageCircle className="h-12 w-12 opacity-20 mb-2" />
                <p className="text-sm">Nenhuma mensagem enviada ainda</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {messages.map((msg) => (
                  <div key={msg.id} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getTipoBadge(msg.tipo)}
                        {getStatusBadge(msg.status)}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm">{msg.telefone}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{msg.mensagem}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
