/**
 * ProviderCard — Renders a single dataset/provider with clear status, actions, and version history.
 * Redesigned for better visual hierarchy and clarity.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2, Play, CheckCircle2, AlertTriangle, RefreshCw,
  ChevronDown, Upload, MapPin, History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DatasetConfig, VersionRow } from "./types";
import { VersionHistory } from "./VersionHistory";
import { CsvImportPanel } from "./CsvImportPanel";
import { LookupTester } from "./LookupTester";

interface ProviderCardProps {
  config: DatasetConfig;
  datasetId: string | undefined;
  versions: VersionRow[];
  activeVersion: VersionRow | undefined;
  processingVersion: VersionRow | undefined;
  onReload: () => void;
}

export function ProviderCard({ config, datasetId, versions, activeVersion, processingVersion, onReload }: ProviderCardProps) {
  const Icon = config.icon;
  const [creating, setCreating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isActive = !!activeVersion;
  const isProcessing = !!processingVersion;
  const hasData = isActive && (activeVersion.row_count ?? 0) > 0;

  // ── Create Version via RPC ──
  const handleCreateVersion = async () => {
    if (!datasetId) return;
    setCreating(true);
    try {
      const tag = `${config.code.toLowerCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
      const { error } = await supabase.rpc("create_irradiance_version" as any, {
        _dataset_code: config.code,
        _version_tag: tag,
        _metadata: {
          source: config.label,
          variables: config.type === "csv" ? ["GHI", "DHI", "DNI"] : ["GHI"],
          plane: "horizontal",
          unit: "kWh/m²/day",
        },
      });
      if (error) throw error;
      toast.success("Nova versão criada", { description: "Agora importe os dados para esta versão." });
      onReload();
    } catch (e: any) {
      toast.error("Erro ao criar versão", { description: e.message });
    } finally {
      setCreating(false);
    }
  };

  // ── Activate Version ──
  const handleActivateVersion = async () => {
    const proc = processingVersion;
    if (!proc) return;
    setActivating(true);
    try {
      const { data, error } = await supabase.rpc("activate_irradiance_version" as any, {
        _version_id: proc.id,
      });
      if (error) throw error;
      toast.success("Versão ativada!", {
        description: `${((data as any)?.row_count ?? 0).toLocaleString("pt-BR")} pontos disponíveis para cálculos.`,
      });
      onReload();
    } catch (e: any) {
      toast.error("Erro ao ativar", { description: e.message });
    } finally {
      setActivating(false);
    }
  };

  // ── NASA API Sync ──
  const handleNasaSync = async () => {
    setSyncing(true);
    setSyncMessage("");
    try {
      const versionTag = `v${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      const { data, error } = await supabase.functions.invoke("irradiance-fetch", {
        body: { dataset_code: config.code, version_tag: versionTag, step_deg: 1 },
      });
      if (error) {
        const msg = String(error?.message ?? "").toLowerCase();
        if (msg.includes("function not found") || msg.includes("404") || msg.includes("boot error")) {
          setSyncMessage("⚠️ Função de sincronização não está disponível no momento.");
          return;
        }
        throw error;
      }
      if (data?.error === "VERSION_EXISTS") {
        setSyncMessage(`ℹ️ ${data.message}`);
        return;
      }
      if (data?.error === "VERSION_PROCESSING") {
        setSyncMessage(`ℹ️ ${data.message}`);
        return;
      }
      setSyncMessage("✅ Sincronização iniciada com sucesso!");
      onReload();
    } catch (e: any) {
      setSyncMessage(`❌ Erro: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="rounded-xl overflow-hidden">
      {/* ── Header with status indicator ── */}
      <div className={`px-5 py-4 flex items-start justify-between gap-4 ${
        hasData ? "bg-success/5 border-b border-success/10" :
        isProcessing ? "bg-warning/5 border-b border-warning/10" :
        "bg-muted/30 border-b border-border/40"
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
            hasData ? "bg-success/10 text-success" :
            isProcessing ? "bg-warning/10 text-warning" :
            "bg-muted text-muted-foreground"
          }`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">{config.label}</h3>
              <StatusBadge hasData={hasData} isProcessing={isProcessing} activeVersion={activeVersion} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
          </div>
        </div>
      </div>

      <CardContent className="px-5 py-4 space-y-4">
        {/* ── Quick Stats ── */}
        {isActive && (
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{(activeVersion.row_count ?? 0).toLocaleString("pt-BR")}</span>
              <span>pontos geográficos</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              <span>Versão: <span className="font-mono font-medium text-foreground">{activeVersion.version_tag}</span></span>
            </div>
          </div>
        )}

        {/* ── Processing indicator ── */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-xs p-2.5 rounded-lg bg-warning/5 border border-warning/20">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-warning" />
            <span className="text-warning font-medium">
              Importação em andamento — {processingVersion.version_tag}
              {processingVersion.row_count > 0 && ` (${processingVersion.row_count.toLocaleString("pt-BR")} pontos)`}
            </span>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex flex-wrap gap-2">
          {!isProcessing && (
            <Button
              size="sm" variant="outline"
              onClick={handleCreateVersion}
              disabled={creating}
              className="gap-1.5 text-xs"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {isActive ? "Nova Versão" : "Iniciar Importação"}
            </Button>
          )}

          {isProcessing && (processingVersion?.row_count ?? 0) > 0 && (
            <Button
              size="sm"
              onClick={handleActivateVersion}
              disabled={activating}
              className="gap-1.5 text-xs"
            >
              {activating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Ativar Versão ({processingVersion!.row_count.toLocaleString("pt-BR")} pts)
            </Button>
          )}

          {config.type === "api" && (
            <Button
              size="sm" variant={isActive ? "outline" : "default"}
              onClick={handleNasaSync}
              disabled={syncing}
              className="gap-1.5 text-xs"
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sincronizar via API
            </Button>
          )}
        </div>

        {/* NASA sync message */}
        {syncMessage && (
          <div className="text-xs p-2.5 rounded-lg bg-muted/50 border border-border/40">
            {syncMessage}
          </div>
        )}

        {/* ── CSV Import (always visible for CSV providers) ── */}
        {config.type === "csv" && (
          <CsvImportPanel datasetCode={config.code} datasetLabel={config.label} onReload={onReload} />
        )}

        {/* ── Lookup Tester (always visible) ── */}
        <LookupTester activeVersion={activeVersion} />

        {/* ── Advanced: Version History (collapsible) ── */}
        {versions.length > 0 && (
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground w-full justify-start p-0 h-auto hover:bg-transparent">
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                Histórico de Versões ({versions.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <VersionHistory versions={versions} />
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ hasData, isProcessing, activeVersion }: { hasData: boolean; isProcessing: boolean; activeVersion?: VersionRow }) {
  if (hasData) {
    return (
      <Badge className="bg-success/10 text-success border-success/30 text-[10px] gap-1">
        <CheckCircle2 className="h-3 w-3" /> Ativo
      </Badge>
    );
  }
  if (isProcessing) {
    return (
      <Badge className="bg-warning/10 text-warning border-warning/30 text-[10px] gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Importando
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
      <AlertTriangle className="h-3 w-3" /> Sem dados
    </Badge>
  );
}