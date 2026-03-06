/**
 * ApisPage — Integration API configuration management.
 * Shows configured providers and allows CRUD.
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
import { Plus, Plug, Zap, TestTube2, Power, PowerOff, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { ApiConfigDialog } from "./ApiConfigDialog";
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

  const testMut = useMutation({
    mutationFn: async (id: string) => {
      // Simulate test — in production this would call an edge function
      await new Promise(r => setTimeout(r, 1500));
      await integrationApiService.updateTestResult(id, true);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations_api_configs"] });
      toast({ title: "Conexão testada com sucesso" });
    },
    onError: (err: any) => toast({ title: "Falha no teste", description: err?.message, variant: "destructive" }),
  });

  function handleEdit(config: IntegrationApiConfig) {
    setEditingConfig(config);
    setDialogOpen(true);
  }

  function handleCreate() {
    setEditingConfig(null);
    setDialogOpen(true);
  }

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

      {/* Available Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(PROVIDER_INFO).map(([key, info]) => {
          const existing = configs.filter(c => c.provider === key);
          return (
            <Card key={key} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${info.color}`} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{info.label}</CardTitle>
                  {existing.length > 0 ? (
                    <Badge variant="outline" className="text-xs">{existing.length} configurada(s)</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Não configurado</Badge>
                  )}
                </div>
                <CardDescription className="text-xs">{info.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {existing.length === 0 ? (
                  <Button variant="outline" size="sm" className="w-full" onClick={handleCreate}>
                    <Zap className="w-3 h-3 mr-1" /> Configurar
                  </Button>
                ) : (
                  <div className="space-y-2">
                    {existing.map(cfg => (
                      <div key={cfg.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusBadge
                            variant={cfg.status === "connected" ? "success" : cfg.status === "error" ? "destructive" : "warning"}
                            dot
                          >
                            {cfg.status === "connected" ? "Conectado" : cfg.status === "error" ? "Erro" : "Inativo"}
                          </StatusBadge>
                          <span className="truncate font-medium">{cfg.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => testMut.mutate(cfg.id)} disabled={testMut.isPending} title="Testar">
                            <TestTube2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleMut.mutate({ id: cfg.id, active: !cfg.is_active })} title={cfg.is_active ? "Desativar" : "Ativar"}>
                            {cfg.is_active ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5 text-muted-foreground" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(cfg)} title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(cfg.id)} title="Remover">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* All configs table */}
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
      ) : null}

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
