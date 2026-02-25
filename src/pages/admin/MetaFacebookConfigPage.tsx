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
  appId: "meta_facebook_app_id",
  accessToken: "meta_facebook",
  appSecret: "meta_facebook_app_secret",
  verifyToken: "meta_facebook_verify_token",
} as const;

interface FieldConfig {
  serviceKey: string;
  label: string;
  placeholder: string;
  description: string;
  isSecret?: boolean;
}

const FIELDS: FieldConfig[] = [
  {
    serviceKey: META_KEYS.appId,
    label: "ID do Aplicativo",
    placeholder: "Cole o ID do Aplicativo (ex: 744200091640333)...",
    description: "Número do seu app, encontrado em Configurações do app → Básico",
    isSecret: false,
  },
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
          type={field.isSecret === false ? "text" : "password"}
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
                Token de Acesso, Chave Secreta do Aplicativo e Token de Verificação para integração completa
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
                  <div className="space-y-5 text-sm text-muted-foreground">
                    <div className="p-3 rounded-md bg-muted/50 border">
                      <p className="font-medium text-foreground mb-1">📌 Onde encontrar cada campo</p>
                      <ul className="space-y-1 ml-1">
                        <li>• <strong>ID do Aplicativo</strong> → Configurações do app → Básico (campo "ID do Aplicativo" no topo)</li>
                        <li>• <strong>Chave Secreta</strong> → Configurações do app → Básico (clique "Mostrar" ao lado de "Chave Secreta do Aplicativo")</li>
                        <li>• <strong>Token de Acesso</strong> → Menu superior "Ferramentas" → Explorador da API do Graph → Gerar token</li>
                        <li>• <strong>Token de Verificação</strong> → Você cria uma senha qualquer aqui e usa a mesma no webhook</li>
                      </ul>
                    </div>

                    <ol className="space-y-4 list-decimal list-inside">
                      <li>
                        <a href="https://developers.facebook.com/apps/creation/" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">Acesse o Meta for Developers e crie um App ↗</a>
                        <p className="ml-5 mt-1">Clique em <strong>"Criar App"</strong> → escolha <strong>"Outro"</strong> → tipo <strong>"Empresa"</strong> → preencha o nome e vincule sua conta Business.</p>
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Copie o ID e a Chave Secreta</span>
                        <p className="ml-5 mt-1">No menu lateral esquerdo → <strong>"Configurações do app" → "Básico"</strong>:</p>
                        <ul className="ml-5 mt-1 space-y-1">
                          <li>• Copie o <strong>"ID do Aplicativo"</strong> (número no topo) → cole no campo <strong>ID do Aplicativo</strong> acima</li>
                          <li>• Clique <strong>"Mostrar"</strong> ao lado de <strong>"Chave Secreta do Aplicativo"</strong> → copie → cole no campo <strong>Chave Secreta do Aplicativo</strong> acima</li>
                        </ul>
                      </li>
                      <li>
                        <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">Gere o Token de Acesso ↗</a>
                        <p className="ml-5 mt-1">No menu superior → <strong>"Ferramentas" → "Explorador da API do Graph"</strong>:</p>
                        <ul className="ml-5 mt-1 space-y-1">
                          <li>• Selecione seu app no dropdown</li>
                          <li>• Clique em <strong>"Adicionar permissão"</strong> e marque: <code className="bg-muted px-1 rounded text-xs">ads_read</code>, <code className="bg-muted px-1 rounded text-xs">leads_retrieval</code>, <code className="bg-muted px-1 rounded text-xs">pages_show_list</code>, <code className="bg-muted px-1 rounded text-xs">pages_read_engagement</code></li>
                          <li>• Clique em <strong>"Gerar token de acesso"</strong> → copie → cole no campo <strong>Token de Acesso</strong> acima</li>
                        </ul>
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Defina o Token de Verificação</span>
                        <p className="ml-5 mt-1">Crie uma senha/frase secreta qualquer (ex: <code className="bg-muted px-1 rounded text-xs">minha-chave-2026</code>) e cole no campo <strong>Token de Verificação</strong> acima. Guarde essa mesma frase para o próximo passo.</p>
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Configure o Webhook no Meta</span>
                        <p className="ml-5 mt-1">No menu lateral → <strong>"Funções do app" → "Webhooks"</strong>:</p>
                        <ul className="ml-5 mt-1 space-y-1">
                          <li>• Selecione <strong>"Página"</strong> no dropdown</li>
                          <li>• Clique em <strong>"Assinar"</strong> ou <strong>"Editar assinatura"</strong></li>
                          <li>• Marque o campo <code className="bg-muted px-1 rounded text-xs">leadgen</code></li>
                          <li>• Em <strong>"URL de retorno"</strong> cole a URL do seu webhook</li>
                          <li>• Em <strong>"Token de verificação"</strong> cole a mesma frase do passo anterior</li>
                        </ul>
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Vincule sua Página</span>
                        <p className="ml-5 mt-1">No menu lateral → <strong>"Configurações do app" → "Avançado"</strong> → em <strong>"Páginas autorizadas"</strong>, adicione a página do Facebook que receberá os leads.</p>
                      </li>
                      <li>
                        <a href="https://developers.facebook.com/tools/lead-ads-testing" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">Teste a integração ↗</a>
                        <p className="ml-5 mt-1">Abra a ferramenta de teste → selecione sua página e formulário → envie um lead de teste. Ele deve aparecer na aba <strong>"Leads"</strong> do menu Meta no sistema.</p>
                      </li>
                    </ol>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
