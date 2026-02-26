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
import { Eye, EyeOff, Save, CheckCircle2, Loader2, Facebook, Copy } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseEdgeFunctionError } from "@/lib/parseEdgeFunctionError";
import { MetaLeadAdsDiagnosticsCard } from "@/components/admin/integrations/MetaLeadAdsDiagnosticsCard";

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

  const valueToAudit = (value.trim() || config?.api_key || "").trim();
  const accessTokenLooksLikeAppId =
    field.serviceKey === META_KEYS.accessToken &&
    /^\d{10,}$/.test(valueToAudit);

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

      {accessTokenLooksLikeAppId && (
        <p className="text-xs text-destructive">
          ⚠️ Auditoria: este valor parece ser um <strong>ID do Aplicativo</strong> (apenas números). No campo <strong>Token de Acesso</strong> use o token gerado no Graph API Explorer.
        </p>
      )}

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

      <MetaLeadAdsDiagnosticsCard />

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
                   <div className="space-y-4 text-sm text-muted-foreground">
                     <div className="p-3 rounded-md bg-primary/10 border border-primary/20">
                       <p className="font-medium text-foreground mb-2">⚡ Resumo rápido</p>
                       <ol className="space-y-1 list-decimal list-inside text-foreground text-xs">
                         <li><strong>ID do Aplicativo</strong> → número no painel do seu app</li>
                         <li><strong>Chave Secreta</strong> → ao lado do ID, clique "Mostrar"</li>
                         <li><strong>Token de Acesso</strong> → gere no Graph API Explorer (começa com <code className="bg-muted px-1 rounded">EAA...</code>)</li>
                         <li><strong>Token de Verificação</strong> → invente uma senha qualquer e use a mesma no webhook</li>
                       </ol>
                     </div>

                     <ol className="space-y-4 list-decimal list-inside">
                       <li>
                         <span className="font-medium text-foreground">Abra o painel do seu App</span>
                         <p className="ml-5 mt-1">
                           Acesse{" "}
                           <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-primary underline">developers.facebook.com/apps ↗</a>
                           {" "}→ clique no seu app (ou crie um novo).
                         </p>
                       </li>
                       <li>
                         <span className="font-medium text-foreground">Copie o ID e a Chave Secreta</span>
                         <p className="ml-5 mt-1">Dentro do app → menu lateral <strong>"Configurações" → "Básico"</strong>:</p>
                         <ul className="ml-5 mt-1 space-y-1">
                           <li>• <strong>"ID do Aplicativo"</strong> (número no topo) → cole acima</li>
                           <li>• <strong>"Chave Secreta do Aplicativo"</strong> → clique <strong>"Mostrar"</strong>, copie → cole acima</li>
                         </ul>
                       </li>
                       <li>
                         <span className="font-medium text-foreground">Gere o Token de Acesso</span>
                         <p className="ml-5 mt-1">
                           Acesse{" "}
                           <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Graph API Explorer ↗</a>
                           {" "}(já estando logado no Facebook):
                         </p>
                         <ul className="ml-5 mt-1 space-y-1">
                           <li>• <strong>"App da Meta"</strong> → selecione seu app</li>
                           <li>• <strong>"Usuário ou Página"</strong> → selecione <strong>"Token do usuário"</strong></li>
                           <li>• <strong>"Permissões"</strong> → adicione: <code className="bg-muted px-1 rounded text-xs">ads_read</code>, <code className="bg-muted px-1 rounded text-xs">leads_retrieval</code>, <code className="bg-muted px-1 rounded text-xs">pages_show_list</code>, <code className="bg-muted px-1 rounded text-xs">pages_read_engagement</code></li>
                           <li>• Clique <strong>"Generate Access Token"</strong> (botão azul)</li>
                           <li>• <strong>Copie o token longo</strong> que aparece no topo (ex: <code className="bg-muted px-1 rounded text-xs">EAAWCdk...</code>) → cole acima</li>
                         </ul>
                       </li>
                       <li>
                         <span className="font-medium text-foreground">Token de Verificação</span>
                         <p className="ml-5 mt-1">Invente qualquer frase-senha (ex: <code className="bg-muted px-1 rounded text-xs">minha-chave-2026</code>) → cole acima. Use essa mesma frase ao configurar o webhook no Meta.</p>
                       </li>
                       <li>
                          <span className="font-medium text-foreground">Configure o Webhook</span>
                          <p className="ml-5 mt-1">No painel do app → <strong>"Webhooks"</strong> → selecione <strong>"Página"</strong> → assine <code className="bg-muted px-1 rounded text-xs">leadgen</code> → cole a <strong>Callback URL</strong> abaixo e o token de verificação.</p>
                          <div className="ml-5 mt-2 flex items-center gap-2 p-2 bg-muted rounded-md">
                            <code className="text-xs break-all flex-1 select-all">{`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-lead-webhook`}</code>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0 h-7 w-7"
                              onClick={() => {
                                navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-lead-webhook`);
                                toast.success("URL do webhook copiada!");
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </li>
                        <li>
                          <span className="font-medium text-foreground">Habilite o Gerenciador de Acesso a Leads</span>
                          <p className="ml-5 mt-1">
                            Acesse{" "}
                            <a href="https://www.facebook.com/settings/?tab=business_tools" target="_blank" rel="noopener noreferrer" className="text-primary underline">Configurações do Facebook → Integrações comerciais ↗</a>
                            {" "}→ encontre seu app → ative <strong>"Acesso a Leads"</strong>.
                          </p>
                          <p className="ml-5 mt-1">
                            Ou: na{" "}
                            <a href="https://www.facebook.com/pages/?category=your_pages" target="_blank" rel="noopener noreferrer" className="text-primary underline">sua Página ↗</a>
                            {" "}→ <strong>Configurações</strong> → <strong>Acesso a Leads</strong> → ative seu app/CRM.
                          </p>
                        </li>
                        <li>
                          <span className="font-medium text-foreground">Teste</span>
                          <p className="ml-5 mt-1">
                            Acesse{" "}
                            <a href="https://developers.facebook.com/tools/lead-ads-testing" target="_blank" rel="noopener noreferrer" className="text-primary underline">Ferramenta de teste de Lead Ads ↗</a>
                            {" "}→ selecione sua página → confirme que todos os diagnósticos estão ✅ → clique <strong>"Criar lead"</strong>.
                          </p>
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
