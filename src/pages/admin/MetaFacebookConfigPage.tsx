import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Eye, EyeOff, Save, CheckCircle2, Loader2, Facebook } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseEdgeFunctionError } from "@/lib/parseEdgeFunctionError";

// Service keys for each Meta credential
const META_KEYS = {
  accessToken: "meta_facebook",
  appSecret: "meta_facebook_app_secret",
  verifyToken: "meta_facebook_verify_token",
} as const;

interface FieldConfig {
  serviceKey: string;
  label: string;
  placeholder: string;
  description: string;
}

const FIELDS: FieldConfig[] = [
  {
    serviceKey: META_KEYS.accessToken,
    label: "Token de Acesso",
    placeholder: "Cole seu Token de Acesso do Meta aqui...",
    description: "Token de acesso para a API de Marketing e Lead Ads",
  },
  {
    serviceKey: META_KEYS.appSecret,
    label: "Chave Secreta do Aplicativo",
    placeholder: "Cole a Chave Secreta do seu aplicativo Meta...",
    description: "Usado para validar a assinatura dos webhooks (X-Hub-Signature-256)",
  },
  {
    serviceKey: META_KEYS.verifyToken,
    label: "Token de Verificação",
    placeholder: "Defina um token de verificação para o webhook...",
    description: "Token personalizado usado na verificação do webhook pelo Meta",
  },
];

function useSaveKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceKey, apiKey }: { serviceKey: string; apiKey: string }) => {
      const resp = await supabase.functions.invoke("save-integration-key", {
        body: { service_key: serviceKey, api_key: apiKey },
      });
      if (resp.error) {
        const msg = await parseEdgeFunctionError(resp.error, "Erro ao salvar");
        throw new Error(msg);
      }
      const body = resp.data as any;
      if (body?.error) throw new Error(body.details ? `${body.error}: ${body.details}` : body.error);
      return body;
    },
    onSuccess: () => {
      toast.success("Chave salva ✅");
      queryClient.invalidateQueries({ queryKey: ["meta-fb-configs"] });
      queryClient.invalidateQueries({ queryKey: ["integration-health"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

function MetaField({ field, config, saveMutation }: {
  field: FieldConfig;
  config: { api_key: string; is_active: boolean; id: string; updated_at: string } | null;
  saveMutation: ReturnType<typeof useSaveKey>;
}) {
  const [value, setValue] = useState("");
  const [showKey, setShowKey] = useState(false);

  const maskedKey = config?.api_key
    ? config.api_key.slice(0, 6) + "••••••••" + config.api_key.slice(-4)
    : null;

  const handleSave = () => {
    if (!value.trim()) return;
    saveMutation.mutate({ serviceKey: field.serviceKey, apiKey: value.trim() });
    setValue("");
  };

  return (
    <div className="space-y-2">
      <Label className="font-medium">{field.label}</Label>
      <p className="text-xs text-muted-foreground">{field.description}</p>

      {maskedKey && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <span className="text-sm font-mono flex-1">{showKey ? config?.api_key : maskedKey}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowKey(!showKey)}>
            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          type="password"
          placeholder={maskedKey ? "Cole para substituir..." : field.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button onClick={handleSave} disabled={!value.trim() || saveMutation.isPending} size="sm">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="ml-1">Salvar</span>
        </Button>
      </div>

      {config?.updated_at && (
        <p className="text-xs text-muted-foreground">
          Atualizado: {format(new Date(config.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </p>
      )}
    </div>
  );
}

export default function MetaFacebookConfigPage() {
  const queryClient = useQueryClient();
  const saveMutation = useSaveKey();

  const { data: configs, isLoading } = useQuery({
    queryKey: ["meta-fb-configs"],
    queryFn: async () => {
      const keys = Object.values(META_KEYS);
      const { data, error } = await supabase
        .from("integration_configs")
        .select("id, service_key, api_key, is_active, updated_at")
        .in("service_key", keys);
      if (error) throw error;
      const map: Record<string, typeof data[0]> = {};
      data?.forEach((c) => (map[c.service_key] = c));
      return map;
    },
  });

  const mainConfig = configs?.[META_KEYS.accessToken];

  const toggleMutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (!mainConfig?.id) return;
      const { error } = await supabase
        .from("integration_configs")
        .update({ is_active: active, updated_at: new Date().toISOString() })
        .eq("id", mainConfig.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado ✅");
      queryClient.invalidateQueries({ queryKey: ["meta-fb-configs"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Facebook} title="Meta Facebook Ads" description="Configure suas credenciais do Meta" />
        <Card className="rounded-xl animate-pulse"><CardContent className="p-6 h-40" /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Facebook}
        title="Meta Facebook Ads"
        description="Configure suas credenciais para captura de leads e métricas de anúncios"
      />

      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Credenciais do Meta</CardTitle>
              <CardDescription>
                Access Token, App Secret e Verify Token para integração completa
              </CardDescription>
            </div>
            {mainConfig?.id && (
              <div className="flex items-center gap-3">
                <Badge variant={mainConfig.is_active ? "default" : "secondary"}>
                  {mainConfig.is_active ? "Ativa" : "Inativa"}
                </Badge>
                <Switch
                  checked={mainConfig.is_active}
                  onCheckedChange={(v) => toggleMutation.mutate(v)}
                  disabled={toggleMutation.isPending}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {FIELDS.map((field) => (
            <MetaField
              key={field.serviceKey}
              field={field}
              config={configs?.[field.serviceKey] ?? null}
              saveMutation={saveMutation}
            />
          ))}

          <div className="pt-4 border-t">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="tutorial" className="border-none">
                <AccordionTrigger className="text-sm font-medium py-2 hover:no-underline">
                  📖 Como configurar passo a passo
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="space-y-4 text-sm text-muted-foreground list-decimal list-inside">
                    <li>
                      <a href="https://developers.facebook.com/apps/creation/" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">Crie um App no Meta for Developers ↗</a>
                      <p className="ml-5 mt-1">Clique em <strong>"Criar App"</strong> → escolha <strong>"Outro"</strong> → tipo <strong>"Empresa"</strong> → preencha o nome e vincule sua conta Business.</p>
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Configure os Casos de Uso</span>
                      <p className="ml-5 mt-1">No painel do app, vá em <strong>"Casos de uso"</strong> no menu lateral → adicione os casos <strong>"Conectar-se com os clientes pelo WhatsApp"</strong> e/ou <strong>"Gerenciar mensagens e conteúdo"</strong>. Personalize cada caso de uso clicando na seta <strong>"›"</strong>.</p>
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Copie o App Secret</span>
                      <p className="ml-5 mt-1">No menu lateral → <strong>"Configurações do app" → "Básico"</strong> → copie o valor de <strong>"Chave Secreta do Aplicativo"</strong> e cole no campo <strong>App Secret</strong> acima.</p>
                    </li>
                    <li>
                      <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">Gere o Access Token no Graph API Explorer ↗</a>
                      <p className="ml-5 mt-1">No menu superior → <strong>"Ferramentas" → "Explorador da API do Graph"</strong> → selecione seu app → adicione as permissões: <code className="bg-muted px-1 rounded text-xs">ads_read</code>, <code className="bg-muted px-1 rounded text-xs">leads_retrieval</code>, <code className="bg-muted px-1 rounded text-xs">pages_show_list</code>, <code className="bg-muted px-1 rounded text-xs">pages_read_engagement</code> → clique em <strong>"Gerar token de acesso"</strong> → cole no campo <strong>Access Token</strong> acima.</p>
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Defina o Verify Token</span>
                      <p className="ml-5 mt-1">Crie uma string secreta qualquer (ex: <code className="bg-muted px-1 rounded text-xs">meu-token-secreto-2024</code>) e cole no campo <strong>Verify Token</strong> acima. Você usará essa mesma string no próximo passo.</p>
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Configure o Webhook</span>
                      <p className="ml-5 mt-1">No menu lateral → <strong>"Funções do app" → "Webhooks"</strong> → selecione <strong>"Page"</strong> → clique em <strong>"Assinar"</strong> ou <strong>"Editar assinatura"</strong> → marque <code className="bg-muted px-1 rounded text-xs">leadgen</code> → no campo <strong>"URL de retorno"</strong> cole a URL do seu webhook e no <strong>"Token de verificação"</strong> cole o Verify Token definido acima.</p>
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Vincule sua Página ao App</span>
                      <p className="ml-5 mt-1">No menu lateral → <strong>"Configurações do app" → "Avançado"</strong> → em <strong>"Páginas autorizadas"</strong>, adicione a página do Facebook que receberá os leads.</p>
                    </li>
                    <li>
                      <a href="https://developers.facebook.com/tools/lead-ads-testing" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">Teste a integração ↗</a>
                      <p className="ml-5 mt-1">Use a <strong>Lead Ads Testing Tool</strong> do Meta → selecione sua página e formulário → envie um lead de teste. Ele deve aparecer automaticamente na aba <strong>"Leads"</strong> do menu Meta no sistema.</p>
                    </li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
