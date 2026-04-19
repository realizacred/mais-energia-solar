/**
 * SolarmarketConfigPage — Configuração da integração SolarMarket.
 * Persiste URL base + token em `integrations_api_configs` (provider='solarmarket').
 *
 * Token tratado como segredo: mascarado na UI, nunca exibido em texto puro
 * após salvo, nunca enviado em logs/responses.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { useSolarmarketConfig } from "@/hooks/useSolarmarketConfig";
import { useSolarmarketImport } from "@/hooks/useSolarmarketImport";
import { toast } from "@/hooks/use-toast";
import {
  Cloud, Eye, EyeOff, Save, Plug, ShieldCheck, Clock, AlertTriangle,
  CheckCircle2, Loader2, Info,
} from "lucide-react";

const formatBR = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";

export default function SolarmarketConfigPage() {
  const { config, isLoading, save, setActive, testConnection } = useSolarmarketConfig();
  const { jobs } = useSolarmarketImport();

  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  // Hidratar form quando a config carregar
  useEffect(() => {
    if (config) {
      setBaseUrl(config.base_url || "");
      // token vem mascarado — manter assim até usuário digitar novo
      setToken((config.credentials as any)?.api_token || "");
    }
  }, [config?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = useMemo(() => {
    if (!config) return baseUrl.length > 0 || token.length > 0;
    const tokenChanged = !token.includes("••••") && token.trim().length > 0;
    const urlChanged = (baseUrl || "").trim() !== (config.base_url || "");
    return tokenChanged || urlChanged;
  }, [config, baseUrl, token]);

  const lastJob = jobs[0];

  const handleSave = async () => {
    try {
      if (!baseUrl.trim()) {
        toast({ title: "Informe a URL base", variant: "destructive" });
        return;
      }
      await save.mutateAsync({ base_url: baseUrl, api_token: token });
      toast({ title: "Configuração salva" });
      setShowToken(false);
    } catch (e: any) {
      toast({
        title: "Erro ao salvar",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  const handleTest = async () => {
    try {
      const res: any = await testConnection.mutateAsync();
      toast({
        title: "Conexão estabelecida",
        description: res?.message || "Autenticação validada com sucesso.",
      });
    } catch (e: any) {
      toast({
        title: "Falha ao conectar",
        description: e?.message || "Verifique URL base e token.",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (next: boolean) => {
    try {
      await setActive.mutateAsync(next);
      toast({ title: next ? "Integração ativada" : "Integração desativada" });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    }
  };

  if (isLoading) return <LoadingState message="Carregando configuração..." />;

  const statusBadge = !config
    ? { cls: "bg-muted text-muted-foreground border-border", label: "Não configurada" }
    : config.status === "connected"
      ? { cls: "bg-success/10 text-success border-success/20", label: "Conectada" }
      : config.status === "error"
        ? { cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Erro" }
        : config.is_active
          ? { cls: "bg-info/10 text-info border-info/20", label: "Ativa" }
          : { cls: "bg-muted text-muted-foreground border-border", label: "Inativa" };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <PageHeader
        icon={Cloud}
        title="Integração SolarMarket"
        description="A API SolarMarket usa um token inicial (POST /auth/signin) que retorna um JWT temporário (6h) usado como Bearer nas chamadas seguintes."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/importacao-solarmarket">Ir para importação</Link>
          </Button>
        }
      />

      {/* Card 1 — Configuração */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Plug className="w-4 h-4 text-primary" />
            Configuração
          </CardTitle>
          <CardDescription>
            Credenciais de acesso à API SolarMarket. O token é tratado como segredo sensível.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">URL base da API *</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://business.solarmarket.com.br/api/v2"
              />
              <p className="text-xs text-muted-foreground">
                Sem barra final. Exemplo:{" "}
                <code className="bg-muted px-1 rounded">https://business.solarmarket.com.br/api/v2</code>
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Token da API *</Label>
              <div className="relative">
                <Input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={config ? "Deixe em branco para manter o atual" : "Cole o token gerado em Perfil → API"}
                  className="pr-10 font-mono text-xs"
                  autoComplete="new-password"
                  data-lpignore="true"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowToken((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Disponível no painel SolarMarket em Perfil → API. Nunca compartilhe nem comite no código.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
            <Badge variant="outline" className={statusBadge.cls}>
              {statusBadge.label}
            </Badge>
            {config?.last_tested_at && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Última validação: {formatBR(config.last_tested_at)}
              </span>
            )}
            <div className="flex-1" />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!config || testConnection.isPending}
            >
              {testConnection.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Testar conexão
            </Button>
            <Button onClick={handleSave} disabled={!isDirty || save.isPending}>
              {save.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 2 — Status operacional */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Status operacional
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-background">
            <div>
              <p className="text-sm font-medium text-foreground">Integração habilitada</p>
              <p className="text-xs text-muted-foreground">
                Quando desativada, a importação fica bloqueada.
              </p>
            </div>
            <Switch
              checked={!!config?.is_active}
              disabled={!config || setActive.isPending}
              onCheckedChange={handleToggleActive}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border bg-background">
              <p className="text-xs text-muted-foreground">Última autenticação</p>
              <p className="text-sm font-mono text-foreground mt-1">
                {formatBR(config?.last_tested_at)}
              </p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-background">
              <p className="text-xs text-muted-foreground">Última importação</p>
              <p className="text-sm font-mono text-foreground mt-1">
                {formatBR(lastJob?.started_at ?? lastJob?.created_at ?? null)}
              </p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-background sm:col-span-2">
              <p className="text-xs text-muted-foreground">Último erro</p>
              <p className="text-sm text-foreground mt-1">
                {lastJob?.error_message || "Nenhum erro registrado."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3 — Regras da API */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Regras da API SolarMarket
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="bg-info/10 text-info border-info/20 shrink-0">Auth</Badge>
            <p className="text-muted-foreground">
              <code className="bg-muted px-1 rounded">POST /auth/signin</code> com{" "}
              <code className="bg-muted px-1 rounded">{`{ token }`}</code> retorna{" "}
              <code className="bg-muted px-1 rounded">access_token</code> (JWT).
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="bg-info/10 text-info border-info/20 shrink-0">JWT</Badge>
            <p className="text-muted-foreground">Validade do JWT temporário: 360 minutos (6 horas).</p>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 shrink-0">Rate</Badge>
            <p className="text-muted-foreground">
              Limites: <strong>60 requisições/minuto</strong> e <strong>1.800 requisições/hora</strong>.
              O sistema aplica throttle e backoff exponencial em 429.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="bg-muted text-muted-foreground border-border shrink-0">Doc</Badge>
            <p className="text-muted-foreground">
              Documentação oficial:{" "}
              <a
                href="https://solarmarket.readme.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                solarmarket.readme.io
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {!config && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-warning/40 bg-warning/10">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            Nenhuma configuração salva ainda. Preencha URL base + token e clique em <strong>Salvar</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
