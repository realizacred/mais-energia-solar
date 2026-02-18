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
import { toast } from "sonner";
import { Eye, EyeOff, Save, CheckCircle2, XCircle, Loader2, type LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseEdgeFunctionError } from "@/lib/parseEdgeFunctionError";

interface ApiKeyConfigPageProps {
  serviceKey: string;
  title: string;
  description: string;
  icon: LucideIcon;
  helpText?: string;
  helpUrl?: string;
  testEndpoint?: {
    url: (key: string) => string;
    method?: string;
    headers?: (key: string) => Record<string, string>;
  };
}

export default function ApiKeyConfigPage({
  serviceKey,
  title,
  description,
  icon: Icon,
  helpText,
  helpUrl,
  testEndpoint,
}: ApiKeyConfigPageProps) {
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [hasEdited, setHasEdited] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["integration-config", serviceKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_configs")
        .select("*")
        .eq("service_key", serviceKey)
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
          body: { service_key: serviceKey, api_key: key },
        });

        // supabase.functions.invoke returns error as FunctionsHttpError
        // We need to try reading the response body for the real message
        if (resp.error) {
          const msg = await parseEdgeFunctionError(resp.error, "Erro ao salvar chave");
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
        toast.success("Chave salva e validada com sucesso ✅");
      } else {
        toast.success("Status atualizado ✅");
      }
      setHasEdited(false);
      setApiKey("");
      queryClient.invalidateQueries({ queryKey: ["integration-config", serviceKey] });
      queryClient.invalidateQueries({ queryKey: ["integration-health"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!testEndpoint || !config?.api_key) throw new Error("Sem chave configurada");
      const url = testEndpoint.url(config.api_key);
      const headers = testEndpoint.headers?.(config.api_key) ?? {};
      const res = await fetch(url, {
        method: testEndpoint.method || "GET",
        headers,
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
      }
      return true;
    },
    onSuccess: () => toast.success("Conexão verificada com sucesso ✅"),
    onError: (err: Error) => toast.error(`Falha na verificação: ${err.message}`),
  });

  const handleSave = () => {
    if (!apiKey.trim()) return;
    saveMutation.mutate({ key: apiKey.trim() });
  };

  const handleToggle = (active: boolean) => {
    saveMutation.mutate({ active });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Icon} title={title} description={description} />
        <Card className="rounded-xl animate-pulse"><CardContent className="p-6 h-32" /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Icon} title={title} description={description} />

      <Card className="rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Chave de API</CardTitle>
              <CardDescription>{helpText || "Configure sua chave de acesso para esta integração"}</CardDescription>
            </div>
            {config?.id && (
              <div className="flex items-center gap-3">
                <Badge variant={config.is_active ? "default" : "secondary"}>
                  {config.is_active ? "Ativa" : "Inativa"}
                </Badge>
                <Switch
                  checked={config.is_active}
                  onCheckedChange={handleToggle}
                  disabled={saveMutation.isPending}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current key display */}
          {maskedKey && !hasEdited && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              <span className="text-sm font-mono flex-1">{showKey ? config?.api_key : maskedKey}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          )}

          {/* Edit / New key input */}
          <div className="space-y-2">
            <Label>{maskedKey ? "Nova chave (substituir)" : "Chave de API"}</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={maskedKey ? "Cole a nova chave para substituir..." : "Cole sua chave de API aqui..."}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setHasEdited(true);
                }}
              />
              <Button onClick={handleSave} disabled={!apiKey.trim() || saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-1.5">Salvar</span>
              </Button>
            </div>
          </div>

          {/* Help link */}
          {helpUrl && (
            <p className="text-xs text-muted-foreground">
              Não tem uma chave?{" "}
              <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="underline text-primary">
                Saiba como obter
              </a>
            </p>
          )}

          {/* Test + metadata */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-muted-foreground space-y-0.5">
              {config?.last_validated_at && (
                <p>Última validação: {format(new Date(config.last_validated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
              )}
              {config?.updated_at && (
                <p>Última atualização: {format(new Date(config.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
              )}
            </div>
            {testEndpoint && config?.api_key && (
              <Button variant="outline" size="sm" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : testMutation.isSuccess ? (
                  <CheckCircle2 className="h-4 w-4 text-success mr-1.5" />
                ) : testMutation.isError ? (
                  <XCircle className="h-4 w-4 text-destructive mr-1.5" />
                ) : null}
                Testar conexão
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
