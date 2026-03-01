import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, Save, Wifi, Zap, Layers, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthStatus {
  status: string;
  last_ok_at?: string;
  last_fail_at?: string;
  reason?: string;
}

export default function GrowattV1ConfigCard() {
  const [baseUrl, setBaseUrl] = useState("https://openapi.growatt.com/v1/");
  const [token, setToken] = useState("");
  const [testSn, setTestSn] = useState("");
  const [batchSns, setBatchSns] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [configStatus, setConfigStatus] = useState<string>("disconnected");

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchingRt, setFetchingRt] = useState(false);
  const [fetchingBatch, setFetchingBatch] = useState(false);
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);

  const callGrowattApi = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/growatt-api`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action, ...body }),
      },
    );

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
    return json;
  }, []);

  // Load existing config + health
  useEffect(() => {
    (async () => {
      try {
        const [configRes, healthRes] = await Promise.all([
          callGrowattApi("get_config"),
          callGrowattApi("health"),
        ]);
        if (configRes.config) {
          if (configRes.config.base_url) setBaseUrl(configRes.config.base_url);
          setHasToken(configRes.config.has_token);
          setConfigStatus(configRes.config.status);
        }
        if (healthRes.health) setHealth(healthRes.health);
      } catch {
        // Not configured yet — no problem
      }
    })();
  }, [callGrowattApi]);

  const handleSave = async () => {
    if (!baseUrl.trim()) return toast.error("Base URL é obrigatória");
    if (!token && !hasToken) return toast.error("Token é obrigatório");

    setSaving(true);
    try {
      const payload: Record<string, unknown> = { base_url: baseUrl };
      if (token) payload.token = token;
      else {
        // Token not changed — re-load from backend
        toast.error("Informe o token para salvar");
        setSaving(false);
        return;
      }
      await callGrowattApi("save_config", payload);
      setHasToken(true);
      setToken("");
      setConfigStatus("connected");
      toast.success("Configuração Growatt salva com sucesso");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testSn.trim()) return toast.error("Informe o SN do inversor para teste");
    setTesting(true);
    setLastResult(null);
    try {
      const res = await callGrowattApi("test_connection", { device_sn: testSn });
      setHealth({ status: "ok", last_ok_at: new Date().toISOString() });
      setLastResult(res.data);
      toast.success("Conexão OK!");
    } catch (err) {
      setHealth({ status: "error", last_fail_at: new Date().toISOString(), reason: (err as Error).message });
      toast.error((err as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const handleRealtime = async () => {
    if (!testSn.trim()) return toast.error("Informe o SN do inversor");
    setFetchingRt(true);
    setLastResult(null);
    try {
      const res = await callGrowattApi("realtime", { device_sn: testSn, raw: true });
      setLastResult(res.data);
      toast.success("Dados recebidos com sucesso");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setFetchingRt(false);
    }
  };

  const handleBatch = async () => {
    const sns = batchSns.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    if (sns.length === 0) return toast.error("Informe ao menos um SN");
    setFetchingBatch(true);
    setLastResult(null);
    try {
      const res = await callGrowattApi("batch_realtime", { inverters: sns, raw: true });
      setLastResult({ count: res.count, data: res.data });
      toast.success(`${res.count} inversores retornados`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setFetchingBatch(false);
    }
  };

  const healthBadge = () => {
    if (!health) return <Badge variant="outline" className="text-2xs">Desconhecido</Badge>;
    if (health.status === "ok") return <Badge className="bg-success/15 text-success border-success/20 text-2xs"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>;
    if (health.status === "auth_error") return <Badge variant="destructive" className="text-2xs"><XCircle className="h-3 w-3 mr-1" />Auth Error</Badge>;
    if (health.status === "unknown") return <Badge variant="outline" className="text-2xs">Aguardando teste</Badge>;
    return <Badge variant="outline" className="text-2xs border-warning text-warning"><AlertTriangle className="h-3 w-3 mr-1" />{health.reason || health.status}</Badge>;
  };

  const isLoading = saving || testing || fetchingRt || fetchingBatch;

  return (
    <SectionCard
      title="Growatt API v1"
      description="Configuração da integração direta com a Growatt Open API"
      actions={healthBadge()}
    >
      <div className="space-y-5">
        {/* Config fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Base URL</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://openapi.growatt.com/v1/"
              className="font-mono text-sm"
            />
            <p className="text-2xs text-muted-foreground">Deve terminar com /v1/</p>
          </div>

          <div className="space-y-1.5">
            <Label>Token (API Key)</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={hasToken ? "••••••••••••••••••••••••••••" : "Cole o token de 32 caracteres"}
                className="font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {hasToken && !token && (
              <p className="text-2xs text-success">Token configurado. Deixe vazio para manter o atual.</p>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isLoading} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
            Salvar Configuração
          </Button>
        </div>

        {/* Test section */}
        <div className="border-t pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>SN do inversor para teste</Label>
            <Input
              value={testSn}
              onChange={(e) => setTestSn(e.target.value)}
              placeholder="Ex: INV3140005"
              className="font-mono text-sm max-w-xs"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={isLoading}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Wifi className="h-4 w-4 mr-1.5" />}
              Testar Conexão
            </Button>
            <Button variant="outline" size="sm" onClick={handleRealtime} disabled={isLoading}>
              {fetchingRt ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Zap className="h-4 w-4 mr-1.5" />}
              Buscar Realtime
            </Button>
          </div>
        </div>

        {/* Batch section */}
        <div className="border-t pt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Batch — Lista de SNs (um por linha ou separados por vírgula)</Label>
            <Textarea
              value={batchSns}
              onChange={(e) => setBatchSns(e.target.value)}
              placeholder={"INV3140005\nTL15300005\n2033022963"}
              className="font-mono text-sm h-20"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleBatch} disabled={isLoading}>
            {fetchingBatch ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Layers className="h-4 w-4 mr-1.5" />}
            Buscar Batch
          </Button>
        </div>

        {/* Result display */}
        {lastResult && (
          <div className="border-t pt-4">
            <Label className="mb-2 block">Resultado</Label>
            <pre className={cn(
              "text-xs bg-muted/50 border rounded-lg p-3 overflow-auto max-h-60 font-mono",
              "text-foreground/80"
            )}>
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
