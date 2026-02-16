/**
 * ProviderCard — Renders a single dataset/provider with status, actions, and version history.
 * ALL mutations go through canonical RPCs — no direct .update() calls.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Play, CheckCircle2, AlertTriangle, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DatasetConfig, VersionRow } from "./types";
import { statusBadgeClass } from "./VersionHistory";
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
      toast.success("Versão criada (processing)", { description: tag });
      onReload();
    } catch (e: any) {
      toast.error("Erro ao criar versão", { description: e.message });
    } finally {
      setCreating(false);
    }
  };

  // ── Activate Version via canonical RPC (NEVER direct .update()) ──
  const handleActivateVersion = async () => {
    const proc = processingVersion;
    if (!proc) return;
    setActivating(true);
    try {
      const { data, error } = await supabase.rpc("activate_irradiance_version" as any, {
        _version_id: proc.id,
      });
      if (error) throw error;
      toast.success("Versão ativada com sucesso!", {
        description: `${((data as any)?.row_count ?? 0).toLocaleString("pt-BR")} pontos.`,
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
          setSyncMessage("⚠️ Edge Function 'irradiance-fetch' não está deployada.");
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
      setSyncMessage(`✅ Sincronização iniciada. version_id: ${data?.version_id ?? "—"}`);
      onReload();
    } catch (e: any) {
      setSyncMessage(`❌ Erro: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{config.label}</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">{config.description}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            {config.code}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 pt-0 space-y-4">
        {/* Status */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {activeVersion ? (
            <>
              <Badge className={`${statusBadgeClass("active")} text-[10px]`}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Ativa: {activeVersion.version_tag}
              </Badge>
              <span className="text-muted-foreground">
                {(activeVersion.row_count ?? 0).toLocaleString("pt-BR")} pontos
              </span>
            </>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              <AlertTriangle className="h-3 w-3 mr-1" /> Sem versão ativa
            </Badge>
          )}
          {processingVersion && (
            <Badge className={`${statusBadgeClass("processing")} text-[10px]`}>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing: {processingVersion.version_tag}
              {processingVersion.row_count > 0 && ` (${processingVersion.row_count.toLocaleString("pt-BR")} pts)`}
            </Badge>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm" variant="outline"
            onClick={handleCreateVersion}
            disabled={creating || !!processingVersion}
            className="gap-1.5 text-xs"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Criar Versão
          </Button>

          <Button
            size="sm" variant="outline"
            onClick={handleActivateVersion}
            disabled={activating || !processingVersion || (processingVersion?.row_count ?? 0) <= 0}
            className="gap-1.5 text-xs"
          >
            {activating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Ativar Versão
          </Button>

          {config.type === "api" && (
            <Button
              size="sm"
              onClick={handleNasaSync}
              disabled={syncing}
              className="gap-1.5 text-xs"
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sincronizar por API
            </Button>
          )}
        </div>

        {/* NASA sync message */}
        {syncMessage && (
          <div className="text-xs p-2 rounded bg-muted/50 border border-border/40 font-mono whitespace-pre-wrap">
            {syncMessage}
          </div>
        )}

        {/* CSV Import (only for CSV providers) */}
        {config.type === "csv" && (
          <CsvImportPanel processingVersion={processingVersion} onReload={onReload} />
        )}

        {/* Lookup Tester */}
        <LookupTester activeVersion={activeVersion} />

        {/* Version History */}
        <VersionHistory versions={versions} />
      </CardContent>
    </Card>
  );
}
