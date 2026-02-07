import { useState, useEffect } from "react";
import { Instagram, RefreshCw, ExternalLink, CheckCircle, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface InstagramConfigData {
  id?: string;
  access_token: string;
  user_id: string;
  username: string;
  ativo: boolean;
  ultima_sincronizacao: string | null;
}

export function InstagramConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [config, setConfig] = useState<InstagramConfigData>({
    access_token: "",
    user_id: "",
    username: "",
    ativo: false,
    ultima_sincronizacao: null,
  });
  const [postsCount, setPostsCount] = useState(0);

  useEffect(() => {
    fetchConfig();
    fetchPostsCount();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("instagram_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setConfig({
          id: data.id,
          access_token: data.access_token || "",
          user_id: data.user_id || "",
          username: data.username || "",
          ativo: data.ativo,
          ultima_sincronizacao: data.ultima_sincronizacao,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar configuração:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPostsCount = async () => {
    try {
      const { count } = await supabase
        .from("instagram_posts")
        .select("*", { count: "exact", head: true });
      
      setPostsCount(count || 0);
    } catch (error) {
      console.error("Erro ao contar posts:", error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config.id) {
        const { error } = await supabase
          .from("instagram_config")
          .update({
            access_token: config.access_token,
            user_id: config.user_id,
            username: config.username,
            ativo: config.ativo,
          })
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("instagram_config")
          .insert({
            access_token: config.access_token,
            user_id: config.user_id,
            username: config.username,
            ativo: config.ativo,
          })
          .select()
          .single();

        if (error) throw error;
        setConfig(prev => ({ ...prev, id: data.id }));
      }

      toast({
        title: "Configuração salva",
        description: "As configurações do Instagram foram atualizadas.",
      });
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!config.access_token) {
      toast({
        title: "Token não configurado",
        description: "Configure o Access Token antes de sincronizar.",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-sync", {
        body: { action: "sync" },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Sincronização concluída",
          description: `${data.count || 0} posts foram sincronizados.`,
        });
        
        // Update last sync time
        setConfig(prev => ({
          ...prev,
          ultima_sincronizacao: new Date().toISOString(),
        }));
        fetchPostsCount();
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (error: any) {
      console.error("Erro na sincronização:", error);
      toast({
        title: "Erro na sincronização",
        description: error.message || "Não foi possível sincronizar os posts.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5" />
            Configuração da API do Instagram
          </CardTitle>
          <CardDescription>
            Configure a integração com a API do Instagram para exibir posts automaticamente no site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instructions */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Como obter o Access Token</AlertTitle>
            <AlertDescription className="space-y-2">
              <ol className="list-decimal list-inside space-y-1 text-sm mt-2">
                <li>Acesse o <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta for Developers</a></li>
                <li>Crie um app do tipo "Consumer" ou "Business"</li>
                <li>Adicione o produto "Instagram Basic Display" ou "Instagram Graph API"</li>
                <li>Gere um Access Token de longa duração</li>
                <li>Copie o User ID e o Token para os campos abaixo</li>
              </ol>
            </AlertDescription>
          </Alert>

          {/* Status */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              {config.ativo && config.access_token ? (
                <CheckCircle className="h-5 w-5 text-primary" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="font-medium">
                {config.ativo && config.access_token ? "Integração ativa" : "Integração inativa"}
              </span>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {postsCount} posts salvos
            </div>
          </div>

          {/* Form */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="access_token">Access Token</Label>
              <Input
                id="access_token"
                type="password"
                placeholder="IGQ..."
                value={config.access_token}
                onChange={(e) => setConfig(prev => ({ ...prev, access_token: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="user_id">User ID</Label>
                <Input
                  id="user_id"
                  placeholder="123456789"
                  value={config.user_id}
                  onChange={(e) => setConfig(prev => ({ ...prev, user_id: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="@maismaisenergiasolaroficial"
                  value={config.username}
                  onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={config.ativo}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, ativo: checked }))}
                />
                <Label htmlFor="ativo">Exibir feed do Instagram no site</Label>
              </div>
            </div>
          </div>

          {/* Last sync info */}
          {config.ultima_sincronizacao && (
            <p className="text-sm text-muted-foreground">
              Última sincronização: {new Date(config.ultima_sincronizacao).toLocaleString("pt-BR")}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Configurações"
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncing || !config.access_token}
            >
              {syncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar Posts
                </>
              )}
            </Button>

            {config.username && (
              <Button variant="ghost" asChild>
                <a
                  href={`https://instagram.com/${config.username.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver Perfil
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
