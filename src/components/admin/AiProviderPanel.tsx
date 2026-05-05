import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAIProviderConfig, AVAILABLE_MODELS, PROVIDER_INFO } from "@/hooks/useAIProviderConfig";
import { useAIUsageLogs } from "@/hooks/useAIUsageLogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bot, Zap, BarChart2, DollarSign, CheckCircle2, ExternalLink } from "lucide-react";
import { formatDateTime } from "@/lib/formatters/index";

const tokenFmt = new Intl.NumberFormat("pt-BR");

export function AiProviderPanel() {
  const navigate = useNavigate();
  const { config, isLoading: configLoading, updateConfig, providerInfo, hasOpenAIKey, hasGeminiKey } = useAIProviderConfig();
  const { logs, summary, isLoading: logsLoading } = useAIUsageLogs({ limit: 50 });

  const activeProvider = (config?.active_provider || "gemini") as keyof typeof AVAILABLE_MODELS;
  const activeModel = config?.active_model || "gemini-2.0-flash";
  const fallbackEnabled = config?.fallback_enabled ?? true;

  // Auto-switch entre Gemini ↔ OpenAI conforme chaves disponíveis
  let effectiveProvider: keyof typeof AVAILABLE_MODELS = activeProvider;
  if (activeProvider === "openai" && !hasOpenAIKey && hasGeminiKey) effectiveProvider = "gemini";
  if (activeProvider === "gemini" && !hasGeminiKey && hasOpenAIKey) effectiveProvider = "openai";

  const models = [...AVAILABLE_MODELS[effectiveProvider]];
  const showModelWarning = effectiveProvider !== activeProvider;
  const isLoading = configLoading || logsLoading;

  return (
    <div className="space-y-6">
      {/* ── KPI Cards (§27) ─────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-l-[3px] border-l-primary bg-card shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                  {tokenFmt.format(summary.total_requests)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Requisições</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-[3px] border-l-primary bg-card shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                  {tokenFmt.format(summary.total_tokens)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Tokens consumidos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-[3px] border-l-primary bg-card shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                  {summary.total_cost_usd.toFixed(4)} USD
                </p>
                <p className="text-sm text-muted-foreground mt-1">Custo estimado</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Provedor Ativo ──────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Provedor ativo
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(providerInfo) as Array<keyof typeof providerInfo>).map((key) => {
            const info = providerInfo[key];
            const isActive = effectiveProvider === key;

            // Locked state for providers without keys
            if (key === "gemini" && !hasGeminiKey) {
              return (
                <div key={key} className="border border-dashed border-border rounded-lg p-4 flex items-center justify-between opacity-60">
                  <div>
                    <p className="text-sm font-medium text-foreground">Google Gemini</p>
                    <p className="text-xs text-muted-foreground">Chave não configurada</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/admin/gemini-config")}>
                    Configurar
                  </Button>
                </div>
              );
            }
            if (key === "openai" && !hasOpenAIKey) {
              return (
                <div key={key} className="border border-dashed border-border rounded-lg p-4 flex items-center justify-between opacity-60">
                  <div>
                    <p className="text-sm font-medium text-foreground">OpenAI</p>
                    <p className="text-xs text-muted-foreground">Chave não configurada</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/admin/openai-config")}>
                    Configurar
                  </Button>
                </div>
              );
            }

            return (
              <Button
                key={key}
                type="button"
                variant="outline"
                className={`relative h-auto rounded-lg p-4 text-left justify-start flex-col items-stretch ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40"
                }`}
                onClick={() => {
                  updateConfig.mutate({
                    active_provider: key,
                    active_model: AVAILABLE_MODELS[key][0].id,
                  });
                }}
                disabled={updateConfig.isPending}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">{info.name}</span>
                  {key === "lovable_gateway" && (
                    <Badge variant="outline" className="text-[10px] border-primary text-primary">
                      Incluído
                    </Badge>
                  )}
                  {isActive && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">{info.description}</p>
                {key === "gemini" && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary gap-1 mt-2 justify-start"
                    onClick={(e) => { e.stopPropagation(); navigate("/admin/gemini-config"); }}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Configurar chave de API
                  </Button>
                )}
                {key === "openai" && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary gap-1 mt-2 justify-start"
                    onClick={(e) => { e.stopPropagation(); navigate("/admin/openai-config"); }}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Configurar chave de API
                  </Button>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* ── Modelo + Fallback ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Modelo ativo
          </label>
          <Select
            value={activeModel}
            onValueChange={(value) => updateConfig.mutate({ active_model: value })}
            disabled={updateConfig.isPending}
          >
            <SelectTrigger className="bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showModelWarning && (
            <p className="text-xs text-warning mt-1">
              ⚠️ Provedor {activeProvider === "openai" ? "OpenAI" : "Gemini"} sem chave — usando Lovable Gateway
            </p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Fallback automático</p>
            <p className="text-xs text-muted-foreground">
              Se o provedor falhar ou não tiver API key, usa o Gateway automaticamente
            </p>
          </div>
          <Switch
            checked={fallbackEnabled}
            onCheckedChange={(checked) => updateConfig.mutate({ fallback_enabled: checked })}
            disabled={updateConfig.isPending}
          />
        </div>
      </div>

      {/* ── Consumo Recente (§4) ────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Consumo recente
        </p>

        {logsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : !logs?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart2 className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum uso registrado ainda</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              O consumo aparecerá aqui quando funções de IA forem utilizadas
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground">Data</TableHead>
                  <TableHead className="font-semibold text-foreground">Função</TableHead>
                  <TableHead className="font-semibold text-foreground">Provedor</TableHead>
                  <TableHead className="font-semibold text-foreground">Modelo</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Tokens</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Custo USD</TableHead>
                  <TableHead className="font-semibold text-foreground w-[80px]">Fallback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-sm text-foreground whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-foreground font-mono text-xs">
                      {log.function_name}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{log.provider}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono text-xs">
                      {log.model}
                    </TableCell>
                    <TableCell className="text-sm text-foreground text-right font-mono">
                      {tokenFmt.format(log.total_tokens)}
                    </TableCell>
                    <TableCell className="text-sm text-foreground text-right font-mono">
                      {Number(log.estimated_cost_usd).toFixed(4)}
                    </TableCell>
                    <TableCell>
                      {log.is_fallback && (
                        <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">
                          Fallback
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
