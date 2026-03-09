/**
 * ApisPage — Integration API configuration management.
 * Shows configured providers with real sync actions, tutorial, and logs.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { integrationApiService, type IntegrationApiConfig } from "@/services/integrationApiService";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Plug, Zap, Power, PowerOff, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { ApiConfigDialog } from "./ApiConfigDialog";
import { TuyaSyncActions } from "./TuyaSyncActions";
import { TuyaTutorial } from "./TuyaTutorial";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PROVIDER_INFO: Record<string, { label: string; description: string; color: string }> = {
  tuya: { label: "Tuya Smart", description: "Plataforma IoT para medidores inteligentes", color: "bg-orange-500" },
};

export default function ApisPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<IntegrationApiConfig | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: configs = [], isLoading, error } = useQuery({
    queryKey: ["integrations_api_configs"],
    queryFn: () => integrationApiService.list(),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => integrationApiService.toggleActive(id, active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations_api_configs"] });
      toast({ title: "Status atualizado" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => integrationApiService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations_api_configs"] });
      toast({ title: "Integração removida" });
    },
  });

  function handleEdit(config: IntegrationApiConfig) {
    setEditingConfig(config);
    setDialogOpen(true);
  }

  function handleCreate() {
    setEditingConfig(null);
    setDialogOpen(true);
  }

  const STATUS_MAP: Record<string, { variant: "success" | "destructive" | "warning" | "muted"; label: string }> = {
    connected: { variant: "success", label: "Conectado" },
    error: { variant: "destructive", label: "Erro" },
    active: { variant: "success", label: "Ativo" },
    inactive: { variant: "muted", label: "Inativo" },
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        icon={Plug}
        title="APIs & Integrações"
        description="Configure conexões com provedores externos de IoT e dados"
        actions={
          <Button onClick={handleCreate} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nova Integração
          </Button>
        }
      />

      {/* Tutorial */}
      <TuyaTutorial />

      {/* Loading / Error / Empty */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Erro ao carregar" description={String(error)} />
      ) : configs.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="Nenhuma integração de API configurada"
          description="Configure uma API para sincronizar medidores, dispositivos IoT ou dados externos."
          action={{ label: "Nova Integração", onClick: handleCreate, icon: Plus }}
        />
      ) : (
        <div className="space-y-4">
          {configs.map(cfg => {
            const info = PROVIDER_INFO[cfg.provider] || { label: cfg.provider, color: "bg-muted" };
            const statusInfo = STATUS_MAP[cfg.status] || { variant: "muted" as const, label: cfg.status };

            return (
              <Card key={cfg.id} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${info.color}`} />
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div>
                        <CardTitle className="text-base">{cfg.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {info.label} · {cfg.base_url || "Região não definida"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge variant={statusInfo.variant} dot>
                        {statusInfo.label}
                      </StatusBadge>
                      {cfg.last_tested_at && (
                        <span className="text-[10px] text-muted-foreground">
                          Testado: {new Date(cfg.last_tested_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {cfg.last_sync_at && (
                        <span className="text-[10px] text-muted-foreground">
                          Sync: {new Date(cfg.last_sync_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleMut.mutate({ id: cfg.id, active: !cfg.is_active })} title={cfg.is_active ? "Desativar" : "Ativar"}>
                          {cfg.is_active ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5 text-muted-foreground" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(cfg)} title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="destructive" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(cfg.id)} title="Remover">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {cfg.provider === "tuya" && cfg.is_active && (
                    <TuyaSyncActions configId={cfg.id} configName={cfg.name} />
                  )}
                  {!cfg.is_active && (
                    <p className="text-sm text-muted-foreground italic">Integração desativada. Ative para usar as ações de sincronização.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ApiConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingConfig={editingConfig}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["integrations_api_configs"] });
          setDialogOpen(false);
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover integração?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteId) deleteMut.mutate(deleteId); setDeleteId(null); }}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
