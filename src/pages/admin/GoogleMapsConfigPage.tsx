import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  MapPin, Save, CheckCircle2, XCircle, Loader2, ExternalLink,
  ShieldCheck, BookOpen, Activity, Eye, EyeOff, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

export default function GoogleMapsConfigPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [hasEdited, setHasEdited] = useState(false);
  const [showSavedKey, setShowSavedKey] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["integration-config", "google_maps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_configs")
        .select("*")
        .eq("service_key", "google_maps")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const maskedKey = config?.api_key
    ? config.api_key.slice(0, 8) + "••••••••" + config.api_key.slice(-4)
    : null;

  const saveMutation = useMutation({
    mutationFn: async ({ key, active }: { key?: string; active?: boolean }) => {
      if (key !== undefined) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

        const resp = await supabase.functions.invoke("save-integration-key", {
          body: { service_key: "google_maps", api_key: key },
        });

        if (resp.error) {
          let msg = "Erro ao salvar chave";
          try {
            const ctx = (resp.error as any).context;
            if (ctx && typeof ctx.json === "function") {
              const errorBody = await ctx.json();
              msg = errorBody?.details
                ? `${errorBody.error}: ${errorBody.details}`
                : errorBody?.error || msg;
            } else {
              msg = resp.error.message || msg;
            }
          } catch {
            msg = resp.error.message || msg;
          }
          throw new Error(msg);
        }
        const body = resp.data as any;
        if (body?.error) throw new Error(body.details ? `${body.error}: ${body.details}` : body.error);
        return body;
      }

      if (active !== undefined && config?.id) {
        const { error } = await supabase
          .from("integration_configs")
          .update({ is_active: active, updated_at: new Date().toISOString() })
          .eq("id", config.id);
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      if (variables.key) {
        toast.success("Chave do Google Maps salva com sucesso! ✅");
      } else {
        toast.success("Status atualizado ✅");
      }
      setHasEdited(false);
      setApiKey("");
      queryClient.invalidateQueries({ queryKey: ["integration-config", "google_maps"] });
      queryClient.invalidateQueries({ queryKey: ["integration-health"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!config?.api_key) throw new Error("Nenhuma chave configurada para testar");
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=Brasilia&key=${config.api_key}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const json = await res.json();
      if (json.status === "OK" || json.status === "ZERO_RESULTS") {
        return { status: "connected", message: "Conexão verificada — Geocoding API funcionando" };
      }
      if (json.status === "REQUEST_DENIED") {
        return { status: "restricted", message: "Chave restrita por domínio — funciona apenas no navegador" };
      }
      throw new Error(`Google retornou: ${json.status} — ${json.error_message || "Verifique a configuração"}`);
    },
    onSuccess: (result) => {
      if (result.status === "connected") {
        toast.success(result.message);
      } else {
        toast.info(result.message);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const connectionStatus = testMutation.isSuccess
    ? testMutation.data?.status === "connected" ? "connected" : "restricted"
    : testMutation.isError ? "error" : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={MapPin} title="Google Maps" description="Configure sua API Key do Google Maps" />
        <Card className="rounded-xl animate-pulse"><CardContent className="p-6 h-32" /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MapPin}
        title="Google Maps"
        description="Configure sua API Key do Google Maps para exibir mapas e geocodificação no sistema"
      />

      {/* ── Status da Conexão ─────────────────── */}
      <Card className="rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${
                config?.is_active && config?.api_key
                  ? connectionStatus === "error" ? "bg-destructive" : "bg-green-500"
                  : "bg-muted-foreground/40"
              }`} />
              <div>
                <p className="text-sm font-medium">
                  {config?.is_active && config?.api_key
                    ? connectionStatus === "error"
                      ? "Erro na conexão"
                      : connectionStatus === "restricted"
                        ? "Chave configurada (restrita por domínio)"
                        : "Integração ativa"
                    : "Não configurada"
                  }
                </p>
                {config?.last_validated_at && (
                  <p className="text-xs text-muted-foreground">
                    Última validação: {format(new Date(config.last_validated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {config?.api_key && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : connectionStatus === "connected" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mr-1.5" />
                  ) : connectionStatus === "error" ? (
                    <XCircle className="h-4 w-4 text-destructive mr-1.5" />
                  ) : (
                    <Activity className="h-4 w-4 mr-1.5" />
                  )}
                  Testar Conexão
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/saude-integracoes")}
              >
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Saúde das Integrações
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Configuração da Chave ─────────────────── */}
      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Chave de API</CardTitle>
              <CardDescription>
                Insira sua API Key do Google Maps para habilitar mapas e geocodificação nas propostas
              </CardDescription>
            </div>
            {config?.id && (
              <div className="flex items-center gap-3">
                <Badge variant={config.is_active ? "default" : "secondary"}>
                  {config.is_active ? "Ativa" : "Inativa"}
                </Badge>
                <Switch
                  checked={config.is_active}
                  onCheckedChange={(active) => saveMutation.mutate({ active })}
                  disabled={saveMutation.isPending}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chave salva */}
          {maskedKey && !hasEdited && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-sm font-mono flex-1">
                {showSavedKey ? config?.api_key : maskedKey}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSavedKey(!showSavedKey)}>
                {showSavedKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          )}

          {/* Input — texto visível, não password */}
          <div className="space-y-2">
            <Label>{maskedKey ? "Nova chave (substituir)" : "Chave de API"}</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder={maskedKey ? "Cole a nova chave para substituir..." : "Cole sua API Key aqui (começa com AIza...)"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setHasEdited(true);
                }}
                className="font-mono text-sm"
              />
              <Button onClick={() => {
                if (!apiKey.trim()) return;
                saveMutation.mutate({ key: apiKey.trim() });
              }} disabled={!apiKey.trim() || saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-1.5">Salvar</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A chave fica visível enquanto você edita. Após salvar, será mascarada automaticamente.
            </p>
          </div>

          {/* Metadados */}
          {config?.updated_at && (
            <div className="text-xs text-muted-foreground pt-2 border-t">
              Última atualização: {format(new Date(config.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tutorial Passo a Passo ─────────────────── */}
      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Como obter sua API Key do Google Maps</CardTitle>
          </div>
          <CardDescription>
            Siga o passo a passo abaixo para criar e configurar sua chave de API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="step-1">
              <AccordionTrigger className="text-sm font-medium">
                1️⃣ Criar projeto no Google Cloud
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">Google Cloud Console <ExternalLink className="h-3 w-3" /></a> e crie um novo projeto (ou use um existente).</p>
                <p>Dê um nome como "Minha Empresa Solar" e clique em <strong>Criar</strong>.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step-2">
              <AccordionTrigger className="text-sm font-medium">
                2️⃣ Ativar a Geocoding API
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>No menu lateral, vá em <strong>APIs e serviços → Biblioteca</strong>.</p>
                <p>Pesquise por <strong>"Geocoding API"</strong> e clique em <strong>Ativar</strong>.</p>
                <p>
                  <a href="https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
                    Link direto para ativar Geocoding API <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs"><strong>Importante:</strong> A API "Geocoding API" precisa estar ativada. Sem ela, a chave não funciona para buscar endereços.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step-3">
              <AccordionTrigger className="text-sm font-medium">
                3️⃣ Criar a chave de API
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>Vá em <strong>APIs e serviços → Credenciais</strong>.</p>
                <p>Clique em <strong>"+ Criar credenciais" → "Chave de API"</strong>.</p>
                <p>Uma chave será gerada automaticamente (começa com <code className="bg-muted px-1 rounded">AIza...</code>).</p>
                <p>
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
                    Ir para Credenciais <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step-4">
              <AccordionTrigger className="text-sm font-medium">
                4️⃣ Configurar restrições (recomendado)
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>Clique na chave criada para editar. Em <strong>"Restrições de aplicativos"</strong>:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Selecione <strong>"Referenciadores HTTP (sites)"</strong></li>
                  <li>Adicione os domínios permitidos:
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">
                      <li><code className="bg-muted px-1 rounded text-xs">*.lovable.app/*</code></li>
                      <li><code className="bg-muted px-1 rounded text-xs">*.lovableproject.com/*</code></li>
                      <li><code className="bg-muted px-1 rounded text-xs">seudominio.com.br/*</code> (se tiver domínio próprio)</li>
                    </ul>
                  </li>
                </ul>
                <p>Em <strong>"Restrições de API"</strong>, selecione <strong>"Geocoding API"</strong>.</p>
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-md text-xs">
                  <strong>Dica:</strong> Chaves restritas por domínio são mais seguras. O teste de conexão pode mostrar "restrita por domínio" — isso é normal e esperado.
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step-5">
              <AccordionTrigger className="text-sm font-medium">
                5️⃣ Configurar faturamento
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>O Google Maps exige uma <strong>conta de faturamento</strong> vinculada ao projeto, mesmo com o uso gratuito.</p>
                <p>O Google oferece <strong>US$ 200/mês gratuitos</strong>, o que cobre ~40.000 requisições de geocodificação.</p>
                <p>
                  <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
                    Configurar faturamento <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step-6">
              <AccordionTrigger className="text-sm font-medium">
                6️⃣ Colar a chave aqui e salvar
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>Copie a chave gerada e cole no campo <strong>"Chave de API"</strong> acima.</p>
                <p>Clique em <strong>Salvar</strong>. Após salvar, use o botão <strong>"Testar Conexão"</strong> para verificar se tudo está funcionando.</p>
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs"><strong>Chaves novas podem demorar 2-3 minutos</strong> para ativar no Google. Se o teste falhar, aguarde e tente novamente.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
