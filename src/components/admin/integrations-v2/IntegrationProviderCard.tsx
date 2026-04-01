import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plug, RefreshCw, Power, Sun, Clock, CheckCircle2,
  AlertCircle, AlertTriangle, Settings, Zap, Users, HardDrive, Calendar,
  Mail, MessageCircle, Video, CreditCard, ReceiptText,
  Globe, Workflow, FileSignature, FileOutput, PackageSearch,
} from "lucide-react";
import type { IntegrationCategory } from "@/services/integrations/types";

const PROVIDER_ICON_OVERRIDES: Record<string, React.ElementType> = {
  gotenberg: FileOutput,
};

const CATEGORY_FALLBACK_ICONS: Record<IntegrationCategory, React.ElementType> = {
  monitoring: Sun, crm: Users, storage: HardDrive, calendar: Calendar,
  email: Mail, messaging: MessageCircle, meetings: Video, billing: CreditCard,
  nf: ReceiptText, api: Globe, automation: Workflow, signature: FileSignature,
  suppliers: PackageSearch,
};
import { cn } from "@/lib/utils";
import type { IntegrationProvider, ConnectionStatus } from "@/services/integrations/types";
import { getProviderIconUrl } from "@/services/integrations/iconMap";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";

interface Props {
  provider: IntegrationProvider;
  connStatus: ConnectionStatus;
  plantCount: number;
  lastSync: string | null;
  syncError?: string | null;
  onConfigure: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  syncing: boolean;
}

/* ─── Error message translation ─── */
function translateSyncError(error: string | null | undefined): { title: string; description: string } | null {
  if (!error) return null;
  const lower = error.toLowerCase();
  if (lower.includes("login") || lower.includes("password") || lower.includes("auth") || lower.includes("credential") || lower.includes("token")) {
    return {
      title: "Falha na autenticação",
      description: "Credenciais inválidas ou expiradas. Clique em Gerenciar para reconfigurar.",
    };
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return {
      title: "Tempo esgotado",
      description: "O servidor do provedor não respondeu a tempo. Tente sincronizar novamente.",
    };
  }
  if (lower.includes("rate") || lower.includes("limit") || lower.includes("429")) {
    return {
      title: "Limite de requisições",
      description: "Muitas requisições ao provedor. Aguarde alguns minutos e tente novamente.",
    };
  }
  if (lower.includes("permission") || lower.includes("forbidden") || lower.includes("403")) {
    return {
      title: "Acesso negado",
      description: "Sem permissão para acessar os dados. Verifique as credenciais e permissões da conta.",
    };
  }
  return {
    title: "Erro na sincronização",
    description: "Ocorreu um problema na comunicação com o provedor. Tente reconfigurar a integração.",
  };
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
      <Badge className="text-[10px] font-semibold bg-success/15 text-success border-success/25 px-2.5 py-0.5 gap-1">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
        </span>
        Conectado
      </Badge>
    );
  }
  if (isError) {
    return (
      <Badge variant="outline" className="text-[10px] font-semibold bg-destructive/10 text-destructive border-destructive/20 px-2.5 py-0.5 gap-1">
        <AlertCircle className="h-3 w-3" /> Erro
      </Badge>
    );
  }
  if (isBeta) {
    return <Badge className="text-[10px] font-medium bg-warning/15 text-warning border-warning/25 px-2 py-0.5">Beta</Badge>;
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
  provider, connStatus, plantCount, lastSync, syncError,
  onConfigure, onSync, onDisconnect, syncing,
}: Props) {
  const isConnected = connStatus === "connected";
  const isError = connStatus === "error";
  const isMonitoring = provider.category === "monitoring";
  const isStub = isMonitoring && !provider.capabilities?.sync_plants;
  const isComingSoon = provider.status === "coming_soon";
  const isDisabled = isStub || isComingSoon;

  const translatedError = isError ? translateSyncError(syncError) : null;

  // Static icon resolution — try id first, then logo_key fallback
  const iconUrl = getProviderIconUrl(provider.id) || (provider.logo_key ? getProviderIconUrl(provider.logo_key) : null);
  const FallbackIcon = PROVIDER_ICON_OVERRIDES[provider.id] || CATEGORY_FALLBACK_ICONS[provider.category] || Sun;

  return (
    <div
      onClick={isDisabled ? undefined : onConfigure}
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card p-5 transition-all duration-300 cursor-pointer select-none",
        "hover:shadow-md hover:-translate-y-0.5",
        isConnected
          ? "border-success/30 ring-1 ring-success/10"
          : isError
            ? "border-destructive/30 ring-1 ring-destructive/10"
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
            ? "bg-success/10 group-hover:bg-success/15"
            : isError
              ? "bg-destructive/10 group-hover:bg-destructive/15"
              : "bg-muted/50 group-hover:bg-muted/70",
        )}>
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={provider.label}
              className="max-h-9 max-w-9 object-contain"
            />
          ) : (
            <FallbackIcon className="h-6 w-6 text-muted-foreground" />
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

      {/* Error message — translated, never raw API text */}
      {translatedError && (
        <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/5 border border-destructive/20 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-destructive">{translatedError.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{translatedError.description}</p>
          </div>
        </div>
      )}

      {/* Connected metrics bar */}
      {isConnected && (plantCount > 0 || lastSync) && (
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3 py-2 px-3 rounded-lg bg-muted/40">
          {plantCount > 0 && (
            <span className="flex items-center gap-1 font-medium">
              <Zap className="h-3 w-3 text-warning" />
              {plantCount} usina{plantCount > 1 ? "s" : ""}
            </span>
          )}
          {lastSync && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(lastSync)}
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
