/**
 * GotenbergConfigPanel — Dedicated config panel for the Gotenberg integration.
 * Shown inline in the integrations catalog when user clicks "Configurar".
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  FileText, CheckCircle2, XCircle, Loader2, RefreshCw,
  Server, Cpu, BookOpen, AlertTriangle, ExternalLink, Copy, Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GotenbergConfig {
  enabled: boolean;
  base_url: string;
  timeout_ms: number;
  last_health?: Record<string, any>;
  last_health_at?: string;
}

const DEFAULT_CONFIG: GotenbergConfig = {
  enabled: false,
  base_url: "",
  timeout_ms: 30000,
};

function useGotenbergConnection() {
  return useQuery({
    queryKey: ["gotenberg-connection"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("integration_connections")
        .select("id, config, status, last_sync_at, sync_error, created_at")
        .eq("provider_id", "gotenberg")
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; config: GotenbergConfig; status: string; last_sync_at: string | null; sync_error: string | null } | null;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function GotenbergConfigPanel() {
  const qc = useQueryClient();
  const { data: connection, isLoading } = useGotenbergConnection();

  const [form, setForm] = useState<GotenbergConfig>(DEFAULT_CONFIG);
  const [savedConfig, setSavedConfig] = useState<GotenbergConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; health?: any; error?: string; tested_at?: string } | null>(null);

  const isDirty = form.enabled !== savedConfig.enabled
    || form.base_url !== savedConfig.base_url
    || form.timeout_ms !== savedConfig.timeout_ms;

  useEffect(() => {
    if (connection?.config) {
      const loaded: GotenbergConfig = {
        enabled: connection.config.enabled ?? false,
        base_url: connection.config.base_url ?? "",
        timeout_ms: connection.config.timeout_ms ?? 30000,
        last_health: connection.config.last_health,
        last_health_at: connection.config.last_health_at,
      };
      setForm(loaded);
      setSavedConfig(loaded);
    }
  }, [connection]);

  async function handleSave() {
    if (form.enabled && !form.base_url.trim()) {
      toast.error("Informe a URL base do Gotenberg");
      return;
    }

    if (form.base_url.trim()) {
      const url = form.base_url.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        toast.error("URL deve começar com http:// ou https://");
        return;
      }
      if (url.includes("/health") || url.includes("/forms/")) {
        toast.error("Insira apenas a URL base (sem /health ou /forms/...)");
        return;
      }
    }

    setSaving(true);
    try {
      const cleanUrl = form.base_url.trim().replace(/\/+$/, "");
      const configPayload: GotenbergConfig = {
        enabled: form.enabled,
        base_url: cleanUrl,
        timeout_ms: form.timeout_ms,
        last_health: form.last_health,
        last_health_at: form.last_health_at,
      };

      if (connection?.id) {
        const { error: updateError } = await (supabase as any)
          .from("integration_connections")
          .update({
            config: configPayload,
            status: form.enabled ? (connection.status === "connected" ? "connected" : "disconnected") : "disconnected",
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
        if (updateError) {
          console.error("[GotenbergConfig] Erro ao atualizar:", updateError);
          throw new Error("Erro ao atualizar configuração: " + (updateError.message || "falha no banco"));
        }
      } else {
        const { tenantId } = await getCurrentTenantId();

        const { error: insertError } = await (supabase as any)
          .from("integration_connections")
          .insert({
            provider_id: "gotenberg",
            tenant_id: tenantId,
            config: configPayload,
            status: form.enabled ? "disconnected" : "disconnected",
            credentials: {},
            tokens: {},
          });
        if (insertError) {
          console.error("[GotenbergConfig] Erro ao inserir conexão:", insertError);
          throw new Error("Erro ao salvar configuração: " + (insertError.message || "falha no banco"));
        }
      }

      setSavedConfig({ ...form, base_url: form.base_url.trim().replace(/\/+$/, "") });
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["gotenberg-connection"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    const urlToTest = form.base_url.trim().replace(/\/+$/, "");
    if (!urlToTest) {
      toast.error("Informe a URL base para testar");
      return;
    }
    if (!urlToTest.startsWith("http://") && !urlToTest.startsWith("https://")) {
      toast.error("URL deve começar com http:// ou https://");
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("gotenberg-health", {
        body: { base_url: urlToTest },
        headers: { "x-client-timeout": "120" },
      });

      if (error) throw error;
      setTestResult(data);

      if (data.success) {
        toast.success("Conexão com Gotenberg OK!");
        setForm(f => ({
          ...f,
          last_health: data.health,
          last_health_at: data.tested_at,
        }));
        // Auto-update connection status if saved
        if (connection?.id) {
          await (supabase as any)
            .from("integration_connections")
            .update({
              status: "connected",
              sync_error: null,
              last_sync_at: new Date().toISOString(),
              config: {
                ...form,
                base_url: urlToTest,
                last_health: data.health,
                last_health_at: data.tested_at,
              },
            })
            .eq("id", connection.id);
          qc.invalidateQueries({ queryKey: ["gotenberg-connection"] });
        }
      } else {
        toast.error(data.error || "Falha na conexão");
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
      toast.error("Erro ao testar conexão");
    } finally {
      setTesting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  const status = connection?.status || "disconnected";
  const statusMap: Record<string, { variant: "success" | "destructive" | "muted"; label: string }> = {
    connected: { variant: "success", label: "Conectado" },
    error: { variant: "destructive", label: "Erro" },
    disconnected: { variant: "muted", label: "Desconectado" },
  };
  const statusInfo = statusMap[status] || statusMap.disconnected;

  return (
    <div className="space-y-6">
      {/* ─── Config Card ─── */}
      <Card className="border-border">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Configuração do Gotenberg</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Servidor de conversão DOCX → PDF via LibreOffice
                </CardDescription>
              </div>
            </div>
            <StatusBadge variant={statusInfo.variant} dot>{statusInfo.label}</StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Ativar integração</p>
              <p className="text-xs text-muted-foreground">Habilitar conversão DOCX → PDF nas propostas</p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm(f => ({ ...f, enabled: v }))}
            />
          </div>

          <Separator />

          {/* URL */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">URL base do serviço *</Label>
            <Input
              value={form.base_url}
              onChange={(e) => setForm(f => ({ ...f, base_url: e.target.value }))}
              placeholder="http://45.92.11.134:3000"
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Apenas a URL raiz. Não inclua <code className="bg-muted px-1 rounded">/health</code> ou <code className="bg-muted px-1 rounded">/forms/libreoffice/convert</code>.
            </p>
          </div>

          {/* Timeout */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Timeout (ms)</Label>
            <Input
              type="number"
              value={form.timeout_ms}
              onChange={(e) => setForm(f => ({ ...f, timeout_ms: Number(e.target.value) || 30000 }))}
              placeholder="30000"
              className="w-40"
            />
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button onClick={handleTest} disabled={testing || !form.base_url.trim()} variant="outline" className="gap-2">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Testar conexão
            </Button>
            <Button onClick={handleSave} disabled={saving || !isDirty} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvar
            </Button>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={cn(
              "rounded-lg border p-4 space-y-2",
              testResult.success
                ? "border-success/30 bg-success/5"
                : "border-destructive/30 bg-destructive/5"
            )}>
              <div className="flex items-center gap-2">
                {testResult.success
                  ? <CheckCircle2 className="w-5 h-5 text-success" />
                  : <XCircle className="w-5 h-5 text-destructive" />
                }
                <p className="text-sm font-medium text-foreground">
                  {testResult.success ? "Conexão bem-sucedida!" : "Falha na conexão"}
                </p>
              </div>
              {testResult.error && (
                <p className="text-xs text-destructive">{testResult.error}</p>
              )}
              {testResult.health && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                  <HealthItem label="Status" value={testResult.health.status} />
                  <HealthItem label="Chromium" value={testResult.health.details?.chromium?.status || testResult.health.chromium?.status || "—"} />
                  <HealthItem label="LibreOffice" value={testResult.health.details?.libreoffice?.status || testResult.health.details?.libreOffice?.status || testResult.health.libreOffice?.status || testResult.health.uno?.status || "—"} />
                </div>
              )}
              {testResult.tested_at && (
                <p className="text-[10px] text-muted-foreground">
                  Testado em: {new Date(testResult.tested_at).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          )}

          {/* Last test info from DB */}
          {!testResult && form.last_health_at && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground mb-2">
                Último teste: {new Date(form.last_health_at).toLocaleString("pt-BR")}
              </p>
              {form.last_health && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <HealthItem label="Status" value={form.last_health.status || "—"} />
                  <HealthItem label="Chromium" value={form.last_health.details?.chromium?.status || form.last_health.chromium?.status || "—"} />
                  <HealthItem label="LibreOffice" value={form.last_health.details?.libreoffice?.status || form.last_health.details?.libreOffice?.status || form.last_health.libreOffice?.status || form.last_health.uno?.status || "—"} />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Tutorial Card ─── */}
      <Card className="border-border">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Como instalar o Gotenberg</CardTitle>
              <CardDescription className="text-xs mt-0.5">Passo a passo para configurar o servidor de conversão</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          {/* Step 1 */}
          <TutorialStep
            number={1}
            title="Instalar via Docker"
            code={`docker run -d \\
  --name gotenberg \\
  -p 3000:3000 \\
  --restart always \\
  gotenberg/gotenberg:7`}
          />

          {/* Step 2 */}
          <TutorialStep
            number={2}
            title="Verificar instalação"
            description="Acesse no navegador para confirmar que está rodando:"
            code="http://SEU_IP:3000/health"
          />

          {/* Step 3 */}
          <TutorialStep
            number={3}
            title="Configurar no sistema"
            description="No campo acima, insira apenas a URL base:"
            code="http://45.92.11.134:3000"
          />

          <Separator />

          {/* How it works */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Como funciona</p>
            <div className="space-y-1.5">
              {[
                "O sistema gera o arquivo DOCX da proposta com os dados preenchidos",
                "O DOCX é enviado ao Gotenberg para conversão em PDF de alta fidelidade",
                "O PDF convertido é salvo no storage do sistema",
                "O DOCX original também é sempre persistido para download",
                "Preview e download ficam disponíveis no wizard da proposta",
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs font-bold text-primary mt-0.5">{i + 1}.</span>
                  <p className="text-xs text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Warnings */}
          <div className="rounded-lg bg-warning/5 border border-warning/20 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              <p className="text-xs font-medium text-foreground">Observações importantes</p>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
              <li>NÃO inclua <code className="bg-muted px-1 rounded">/health</code> na URL</li>
              <li>NÃO inclua <code className="bg-muted px-1 rounded">/forms/libreoffice/convert</code> na URL</li>
              <li>Use <code className="bg-muted px-1 rounded">http://</code> ou <code className="bg-muted px-1 rounded">https://</code> obrigatoriamente</li>
              <li>Em produção, recomenda-se usar um subdomínio dedicado</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Sub-components ─── */

function HealthItem({ label, value }: { label: string; value: string }) {
  const isUp = value === "up" || value === "Up";
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-card border border-border">
      {isUp ? (
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
      ) : (
        <Server className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-xs font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function TutorialStep({ number, title, description, code }: {
  number: number;
  title: string;
  description?: string;
  code: string;
}) {
  function handleCopy() {
    navigator.clipboard.writeText(code);
    toast.success("Copiado!");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
          {number}
        </span>
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>
      {description && <p className="text-xs text-muted-foreground ml-8">{description}</p>}
      <div className="ml-8 relative group">
        <pre className="bg-muted/50 border border-border rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto">
          {code}
        </pre>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Copiar"
        >
          <Copy className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
