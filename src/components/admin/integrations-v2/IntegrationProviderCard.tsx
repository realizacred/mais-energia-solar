import React, { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plug, RefreshCw, Power, Sun, Clock, CheckCircle2,
  AlertCircle, Settings, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { IntegrationProvider, ConnectionStatus } from "@/services/integrations/types";

interface Props {
  provider: IntegrationProvider;
  connStatus: ConnectionStatus;
  plantCount: number;
  lastSync: string | null;
  onConfigure: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  syncing: boolean;
}

/* ─── Status helpers ─── */
function StatusIndicator({ provider, connStatus }: { provider: IntegrationProvider; connStatus: ConnectionStatus }) {
  const isConnected = connStatus === "connected";
  const isError = connStatus === "error";
  const isMonitoring = provider.category === "monitoring";
  const isBeta = isMonitoring && provider.capabilities?.sync_plants && !provider.capabilities?.sync_health;
  const isStub = isMonitoring && !provider.capabilities?.sync_plants;
  const isComingSoon = provider.status === "coming_soon";

  if (isConnected) {
    return (
      <Badge className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 px-2.5 py-0.5 gap-1">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        Conectado
      </Badge>
    );
  }
  if (isError) {
    return (
      <Badge variant="destructive" className="text-[10px] font-semibold px-2.5 py-0.5 gap-1">
        <AlertCircle className="h-3 w-3" /> Erro
      </Badge>
    );
  }
  if (isBeta) {
    return <Badge className="text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25 px-2 py-0.5">Beta</Badge>;
  }
  if (isStub || isComingSoon) {
    return <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground border-border/60 px-2 py-0.5">Em breve</Badge>;
  }
  if (isMonitoring && provider.capabilities?.sync_plants && provider.capabilities?.sync_health) {
    return <Badge className="text-[10px] font-medium bg-primary/10 text-primary border-primary/20 px-2 py-0.5">Produção</Badge>;
  }
  return null;
}

export function IntegrationProviderCard({
  provider, connStatus, plantCount, lastSync,
  onConfigure, onSync, onDisconnect, syncing,
}: Props) {
  const isConnected = connStatus === "connected";
  const isMonitoring = provider.category === "monitoring";
  const isStub = isMonitoring && !provider.capabilities?.sync_plants;
  const isComingSoon = provider.status === "coming_soon";
  const isDisabled = isStub || isComingSoon;

  // Logo resolution: try .png → .svg → fallback icon
  const [logoSrc, setLogoSrc] = useState(`/integrations/${provider.id}.png`);
  const [logoError, setLogoError] = useState(false);

  const handleLogoError = useCallback(() => {
    if (logoSrc.endsWith(".png")) {
      setLogoSrc(`/integrations/${provider.id}.svg`);
    } else if (logoSrc.includes(`/${provider.id}.svg`)) {
      // Try canonical ID from label (e.g. goodwe_sems → goodwe)
      const base = provider.id.split("_")[0];
      if (base !== provider.id) {
        setLogoSrc(`/integrations/${base}.svg`);
      } else {
        setLogoError(true);
      }
    } else {
      setLogoError(true);
    }
  }, [logoSrc, provider.id]);

  return (
    <div
      onClick={isDisabled ? undefined : onConfigure}
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-card p-5 transition-all duration-300 cursor-pointer select-none",
        "hover:shadow-lg hover:-translate-y-0.5",
        isConnected
          ? "border-emerald-500/30 ring-1 ring-emerald-500/10"
          : isDisabled
            ? "border-border/30 bg-muted/20 opacity-60 cursor-default"
            : "border-border/50 hover:border-primary/30",
      )}
    >
      {/* Top row: logo + status */}
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          "flex items-center justify-center w-14 h-14 rounded-xl transition-all duration-300",
          isConnected
            ? "bg-emerald-500/10 group-hover:bg-emerald-500/15"
            : "bg-muted/50 group-hover:bg-muted/70",
        )}>
          {!logoError ? (
            <img
              src={logoSrc}
              alt={provider.label}
              className="max-h-9 max-w-9 object-contain"
              onError={handleLogoError}
              loading="lazy"
            />
          ) : (
            <Sun className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <StatusIndicator provider={provider} connStatus={connStatus} />
      </div>

      {/* Name */}
      <h3 className="text-sm font-bold text-foreground leading-tight mb-1 group-hover:text-primary transition-colors">
        {provider.label}
      </h3>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3 flex-1">
        {provider.description}
      </p>

      {/* Connected metrics bar */}
      {isConnected && (plantCount > 0 || lastSync) && (
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3 py-2 px-3 rounded-lg bg-muted/40">
          {plantCount > 0 && (
            <span className="flex items-center gap-1 font-medium">
              <Zap className="h-3 w-3 text-amber-500" />
              {plantCount} usina{plantCount > 1 ? "s" : ""}
            </span>
          )}
          {lastSync && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(lastSync).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="mt-auto pt-1">
        {isConnected ? (
          <div className="flex gap-2 w-full" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              onClick={onConfigure}
              className="flex-1 h-9 rounded-xl text-xs font-semibold gap-1.5"
            >
              <Settings className="h-3.5 w-3.5" />
              Gerenciar
            </Button>
            {provider.capabilities?.sync_plants && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onSync}
                disabled={syncing}
                className="h-9 w-9 p-0 rounded-xl"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
              </Button>
            )}
          </div>
        ) : isDisabled ? (
          <Button
            size="sm"
            variant="ghost"
            disabled
            className="w-full h-9 rounded-xl text-xs font-medium text-muted-foreground cursor-not-allowed"
          >
            Em desenvolvimento
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onConfigure(); }}
            className="w-full h-9 rounded-xl text-xs font-semibold gap-1.5"
          >
            <Plug className="h-3.5 w-3.5" />
            Configurar
          </Button>
        )}
      </div>
    </div>
  );
}
