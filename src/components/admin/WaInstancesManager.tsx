import { useState, useEffect, useRef, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import {
  Smartphone,
  Plus,
  Trash2,
  RefreshCw,
  Wifi,
  WifiOff,
  QrCode,
  Copy,
  ExternalLink,
  MoreVertical,
  Edit,
  Link2,
  CheckCircle2,
  History,
  Check,
  ServerCog,
  Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useWaInstances, type WaInstance } from "@/hooks/useWaInstances";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WaSetupGuide } from "@/components/admin/wa/WaSetupGuide";
import { WaQRCodeDialog } from "@/components/admin/wa/WaQRCodeDialog";

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Wifi }> = {
  connected: { label: "Conectado", className: "bg-success/10 text-success border-success/20", icon: Wifi },
  disconnected: { label: "Desconectado", className: "bg-muted text-muted-foreground border-border", icon: WifiOff },
  connecting: { label: "Conectando...", className: "bg-warning/10 text-warning border-warning/20", icon: RefreshCw },
  error: { label: "Erro", className: "bg-destructive/10 text-destructive border-destructive/20", icon: WifiOff },
};

export interface WaInstancesManagerProps {
  /**
   * Filtra a lista exibida e força o tipo de API ao criar/editar.
   * - "classic": Evolution Clássica (Baileys/Node)
   * - "go":     Evolution GO (whatsmeow)
   * Quando omitido, exibe ambos sem filtro (modo legado).
   */
  apiFlavorFilter?: "classic" | "go";
}

export function WaInstancesManager({ apiFlavorFilter }: WaInstancesManagerProps = {}) {
  const { instances: rawInstances, loading, updateInstance, deleteInstance, disconnectInstance, disconnecting, checkStatus, checkingStatus, syncHistory, vendedores, instanceVendedores, saveVendedores } = useWaInstances();

  // Filtra por tipo de API quando solicitado pela página chamadora.
  const instances = apiFlavorFilter
    ? rawInstances.filter((i: any) => {
        const flavor = (i?.api_flavor === "go" ? "go" : "classic");
        return flavor === apiFlavorFilter;
      })
    : rawInstances;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editInstance, setEditInstance] = useState<WaInstance | null>(null);
  const [syncInstance, setSyncInstance] = useState<WaInstance | null>(null);
  const [qrInstance, setQrInstance] = useState<WaInstance | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<WaInstance | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WaInstance | null>(null);
  const [syncDays, setSyncDays] = useState("365");
  const [isSyncing, setIsSyncing] = useState(false);

  const getInstanceVendedorIds = (instanceId: string) =>
    instanceVendedores.filter((iv: any) => iv.instance_id === instanceId).map((iv: any) => iv.consultor_id);

  const webhookBaseUrl = `https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/evolution-webhook`;

  const copyWebhookUrl = (inst: WaInstance) => {
    const url = `${webhookBaseUrl}?instance=${encodeURIComponent(inst.evolution_instance_key)}&secret=${encodeURIComponent(inst.webhook_secret)}`;
    navigator.clipboard.writeText(url);
    toast({ title: "URL copiada!", description: "Cole na configuração de webhook da Evolution API." });
  };

  const connectedCount = instances.filter((i) => i.status === "connected").length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Smartphone}
        title="Instâncias WhatsApp"
        description={`${connectedCount}/${instances.length} conectada${connectedCount !== 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
          <WaSetupGuide />
          {instances.length > 0 && (
            <Button
              variant="outline"
              onClick={() => checkStatus(undefined)}
              disabled={checkingStatus}
              className="gap-2"
            >
              {checkingStatus ? (
                <Spinner size="sm" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar Status
            </Button>
          )}
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Instância
          </Button>
          </div>
        }
      />

      {/* Alert banner for disconnected instances */}
      {!loading && instances.length > 0 && (() => {
        const disconnected = instances.filter(i => i.status !== "connected");
        if (disconnected.length === 0) return null;
        const allDisconnected = disconnected.length === instances.length;
        return (
          <div className={`flex items-start gap-3 p-4 rounded-lg border ${allDisconnected ? "bg-destructive/10 border-destructive/20" : "bg-warning/10 border-warning/20"}`}>
            <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${allDisconnected ? "text-destructive" : "text-warning"}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${allDisconnected ? "text-destructive" : "text-warning"}`}>
                {allDisconnected
                  ? "Todas as instâncias estão desconectadas"
                  : `${disconnected.length} instância${disconnected.length > 1 ? "s" : ""} desconectada${disconnected.length > 1 ? "s" : ""}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {allDisconnected
                  ? "Nenhuma mensagem será recebida ou enviada. Reconecte via QR Code no menu da instância."
                  : `As instâncias ${disconnected.map(i => `"${i.nome}"`).join(", ")} não estão recebendo mensagens. Reconecte via QR Code.`}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                const first = disconnected[0];
                if (first) setQrInstance(first);
              }}
            >
              <QrCode className="h-4 w-4 mr-2" />
              Reconectar
            </Button>
          </div>
        );
      })()}

      {/* Instances Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-40" />
            </Card>
          ))}
        </div>
      ) : instances.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="Nenhuma instância configurada"
          description="Conecte sua primeira instância da Evolution API para começar a receber e enviar mensagens pelo WhatsApp."
          action={{ label: "Configurar Primeira Instância", onClick: () => setShowCreate(true), icon: Plus }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {instances.map((inst) => {
            const st = STATUS_CONFIG[inst.status] || STATUS_CONFIG.disconnected;
            const StatusIcon = st.icon;
            const linkedVendedorIds = getInstanceVendedorIds(inst.id);
            const linkedVendedorNames = linkedVendedorIds
              .map((vid: string) => (vendedores as any[]).find((v) => v.id === vid)?.nome)
              .filter(Boolean);

            return (
              <Card key={inst.id} className="relative group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{inst.nome}</CardTitle>
                      <CardDescription className="text-xs font-mono">
                        {inst.evolution_instance_key}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Opções da instância">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => checkStatus(inst.id)}
                          disabled={checkingStatus}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Verificar Conexão
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setQrInstance(inst)}>
                          <QrCode className="h-4 w-4 mr-2" />
                          Gerar QR Code
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditInstance(inst)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyWebhookUrl(inst)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar URL Webhook
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a href={inst.evolution_api_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Abrir Evolution API
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setSyncInstance(inst)}
                        >
                          <History className="h-4 w-4 mr-2" />
                          Sincronizar Histórico
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {inst.status === "connected" && (
                          <DropdownMenuItem
                            onClick={() => setConfirmDisconnect(inst)}
                            className="text-warning focus:text-warning"
                          >
                            <Power className="h-4 w-4 mr-2" />
                            Desconectar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setConfirmDelete(inst)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`gap-1.5 ${st.className}`}>
                      <StatusIcon className={`h-3 w-3 ${inst.status === "connecting" ? "animate-spin" : ""}`} />
                      {st.label}
                    </Badge>
                    {inst.phone_number && (
                      <span className="text-xs text-muted-foreground">{inst.phone_number}</span>
                    )}
                  </div>

                  {linkedVendedorNames.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                      <Link2 className="h-3 w-3 shrink-0" />
                      <span>{linkedVendedorNames.join(", ")}</span>
                    </div>
                  )}

                  {inst.profile_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      Perfil: {inst.profile_name}
                    </p>
                  )}

                  {inst.last_sync_at && (
                    <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2 mt-1">
                      <p className="font-medium">Última sincronização:</p>
                      <p>{new Date(inst.last_sync_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
                      <p>{inst.last_sync_conversations || 0} conversas · {inst.last_sync_messages || 0} mensagens</p>
                    </div>
                  )}

                  {checkingStatus && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Spinner size="sm" />
                      Verificando...
                    </div>
                  )}

                  <div className="border-t pt-2 mt-1 flex gap-2">
                    {inst.status !== "connected" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2 text-xs"
                        onClick={() => setQrInstance(inst)}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        QR Code
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 text-xs"
                      onClick={() => setSyncInstance(inst)}
                    >
                      <History className="h-3.5 w-3.5" />
                      Sincronizar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <InstanceFormDialog
        open={showCreate || !!editInstance}
        onOpenChange={(v) => {
          if (!v) {
            setShowCreate(false);
            setEditInstance(null);
          }
        }}
        instance={editInstance}
        vendedores={vendedores as any}
        initialVendedorIds={editInstance ? getInstanceVendedorIds(editInstance.id) : []}
        defaultApiFlavor={apiFlavorFilter}
        lockApiFlavor={!!apiFlavorFilter}
        onSaveEdit={async (data, selectedVendedorIds) => {
          if (!editInstance) return;
          const instanceId = editInstance.id;
          updateInstance({ id: instanceId, updates: data });

          // Sync junction table via hook
          const tenantId = editInstance.tenant_id;
          if (tenantId) {
            await saveVendedores({ instanceId, tenantId, vendedorIds: selectedVendedorIds });
          }
          setEditInstance(null);
        }}
        onCreateSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["wa-instances"] });
          queryClient.invalidateQueries({ queryKey: ["wa-instance-vendedores"] });
          setShowCreate(false);
        }}
      />

      {/* Sync History Dialog */}
      <Dialog open={!!syncInstance} onOpenChange={(v) => !v && setSyncInstance(null)}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Sincronizar Histórico
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Busca todas as conversas e mensagens da instância <strong>{syncInstance?.nome}</strong> na Evolution API e importa para a central de atendimento.
            </p>
            <div className="space-y-2">
              <Label htmlFor="sync-days">Quantidade de dias</Label>
              <Select value={syncDays} onValueChange={setSyncDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="180">Últimos 180 dias</SelectItem>
                  <SelectItem value="365">Últimos 365 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Conversas com mensagens dos últimos 7 dias serão reabertas. As demais ficarão como encerradas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSyncInstance(null)} disabled={isSyncing}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!syncInstance) return;
                setIsSyncing(true);
                try {
                  toast({ title: "Sincronizando...", description: `Buscando mensagens dos últimos ${syncDays} dias.` });
                  const result = await syncHistory(syncInstance.id, parseInt(syncDays));
                  toast({
                    title: "Histórico sincronizado!",
                    description: `${result?.conversations_created || 0} conversas, ${result?.messages_imported || 0} mensagens importadas.`,
                  });
                  setSyncInstance(null);
                } catch (e: any) {
                  toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" });
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
            >
              {isSyncing && <Spinner size="sm" />}
              Sincronizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog for existing instances */}
      <WaQRCodeDialog
        open={!!qrInstance}
        onOpenChange={(v) => !v && setQrInstance(null)}
        instanceId={qrInstance?.id || ""}
        instanceName={qrInstance?.nome}
      />

      {/* Confirm Disconnect Dialog */}
      <AlertDialog open={!!confirmDisconnect} onOpenChange={(v) => !v && setConfirmDisconnect(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar instância "{confirmDisconnect?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A sessão do WhatsApp será encerrada na Evolution API. A instância continuará cadastrada no sistema e poderá ser reconectada via QR Code a qualquer momento.
              {confirmDisconnect?.phone_number && (
                <span className="block mt-2 font-medium">Número: {confirmDisconnect.phone_number}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDisconnect) {
                  disconnectInstance(confirmDisconnect.id);
                  setConfirmDisconnect(null);
                }
              }}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
              disabled={disconnecting}
            >
              {disconnecting ? <Spinner size="sm" className="mr-2" /> : <Power className="h-4 w-4 mr-2" />}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete Dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover instância "{confirmDelete?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. A instância será removida do sistema permanentemente, incluindo todas as configurações e vínculos com consultores.
              {confirmDelete?.status === "connected" && (
                <span className="block mt-2 text-warning font-medium">
                  ⚠️ A instância ainda está conectada. Considere desconectar antes de remover.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) {
                  deleteInstance(confirmDelete.id);
                  setConfirmDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remover Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Form Dialog with QR Code Flow ────────────────────────────────────────

type CreateStep = "form" | "qrcode";
type CreateMode = "create" | "register";

function InstanceFormDialog({
  open,
  onOpenChange,
  instance,
  vendedores,
  initialVendedorIds,
  onSaveEdit,
  onCreateSuccess,
  defaultApiFlavor,
  lockApiFlavor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  instance: WaInstance | null;
  vendedores: { id: string; nome: string; user_id: string | null }[];
  initialVendedorIds: string[];
  onSaveEdit: (data: any, selectedVendedorIds: string[]) => Promise<void>;
  onCreateSuccess: () => void;
  /** Pré-seleciona o tipo de API ao abrir em modo "create". */
  defaultApiFlavor?: "classic" | "go";
  /** Quando true, impede o usuário de trocar o tipo de API no formulário. */
  lockApiFlavor?: boolean;
}) {
  const [mode, setMode] = useState<CreateMode>("create");
  const [nome, setNome] = useState("");
  const [instanceKey, setInstanceKey] = useState("");
  const [apiUrl, setApiUrl] = useState("https://");
  const [apiKey, setApiKey] = useState("");
  const [apiFlavor, setApiFlavor] = useState<"classic" | "go">("classic");
  const [selectedVendedorIds, setSelectedVendedorIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Buscar instâncias existentes no servidor (modo register)
  const [remoteInstances, setRemoteInstances] = useState<Array<{ name: string; status: string; phone_number: string | null; profile_name: string | null; already_linked: boolean }> | null>(null);
  const [fetchingRemote, setFetchingRemote] = useState(false);

  // QR Code flow state (only for new instances)
  const [step, setStep] = useState<CreateStep>("form");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [createdInstanceId, setCreatedInstanceId] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<"waiting" | "connected" | "expired" | "error">("waiting");
  const [qrError, setQrError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset form when instance changes or dialog opens
  useEffect(() => {
    if (open) {
      setMode("create");
      setNome(instance?.nome || "");
      setInstanceKey(instance?.evolution_instance_key || "");
      setApiUrl(instance?.evolution_api_url || "https://");
      setApiKey((instance as any)?.api_key || "");
      setApiFlavor(
        instance
          ? ((instance as any)?.api_flavor === "go" ? "go" : "classic")
          : (defaultApiFlavor ?? "classic")
      );
      setSelectedVendedorIds(initialVendedorIds);
      setStep("form");
      setQrCode(null);
      setCreatedInstanceId(null);
      setQrStatus("waiting");
      setQrError(null);
      setRemoteInstances(null);
      setFetchingRemote(false);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, instance?.id]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const toggleVendedor = (vendedorId: string) => {
    setSelectedVendedorIds((prev) =>
      prev.includes(vendedorId)
        ? prev.filter((id) => id !== vendedorId)
        : [...prev, vendedorId]
    );
  };

  // Buscar instâncias existentes no servidor Evolution para o usuário escolher
  const handleFetchRemoteInstances = async () => {
    if (!apiUrl.trim()) {
      toast({ title: "URL obrigatória", description: "Informe a URL do servidor Evolution antes de buscar.", variant: "destructive" });
      return;
    }
    setFetchingRemote(true);
    setRemoteInstances(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão inválida");
      const { data, error } = await supabase.functions.invoke("list-evolution-instances", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          api_url: apiUrl.trim(),
          api_key: apiKey.trim(),
          api_flavor: apiFlavor,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao buscar instâncias");
      setRemoteInstances(data.instances || []);
      if (!data.instances?.length) {
        toast({ title: "Nenhuma instância encontrada", description: "O servidor Evolution não retornou instâncias." });
      }
    } catch (e: any) {
      console.error("[list-evolution-instances]", e);
      toast({ title: "Erro ao buscar", description: e.message, variant: "destructive" });
    } finally {
      setFetchingRemote(false);
    }
  };

  const handleSubmitEdit = async () => {
    if (!nome.trim() || !instanceKey.trim() || !apiUrl.trim()) return;
    setSaving(true);
    try {
      await onSaveEdit(
        {
          nome: nome.trim(),
          evolution_instance_key: instanceKey.trim(),
          evolution_api_url: apiUrl.trim(),
          api_key: apiKey.trim() || null,
        },
        selectedVendedorIds
      );
    } finally {
      setSaving(false);
    }
  };

  // For new instances — create or register via edge function (single canonical path) + show QR
  const handleCreateWithQR = async () => {
    const isRegister = mode === "register";
    if (!nome.trim() || !apiUrl.trim()) return;
    if (isRegister && (!apiKey.trim() || !instanceKey.trim())) return;
    setSaving(true);
    setQrError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão inválida");

      const body: Record<string, unknown> = {
        instance_name: nome.trim(),
        api_url: apiUrl.trim(),
        api_flavor: apiFlavor,
        consultor_ids: selectedVendedorIds,
      };

      // Only send api_key if provided (register mode requires it; create mode uses server global)
      if (apiKey.trim()) {
        body.api_key = apiKey.trim();
      }

      if (isRegister) {
        body.register_only = true;
        body.evolution_instance_key = instanceKey.trim();
      }

      const { data, error } = await supabase.functions.invoke("create-wa-instance", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao criar instância");

      setCreatedInstanceId(data.instance_id);
      setQrCode(data.qr_code_base64 || null);
      setStep("qrcode");
      queryClient.invalidateQueries({ queryKey: ["wa-instances"] });
      queryClient.invalidateQueries({ queryKey: ["wa-instance-vendedores"] });

      // Webhook feedback
      if (data.webhook_configured) {
        toast({ title: "✅ Webhook configurado automaticamente" });
      } else if (data.webhook_warning) {
        toast({
          title: "⚠️ Webhook não configurado",
          description: "Configure manualmente na Evolution API. Use o botão 'Copiar URL Webhook'.",
          variant: "destructive",
        });
        console.warn("[webhook-auto-config]", data.webhook_warning);
      }

      // Start polling for connection status
      startQrPolling(data.instance_id);
    } catch (e: any) {
      console.error("[create-wa-instance]", e);
      setQrError(e.message || (isRegister ? "Erro ao registrar instância" : "Erro ao criar instância"));
      toast({ title: isRegister ? "Erro ao registrar" : "Erro ao criar instância", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const startQrPolling = (instanceId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setQrStatus("waiting");

    pollingRef.current = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const { data, error } = await supabase.functions.invoke("get-wa-qrcode", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { instance_id: instanceId },
        });

        if (error) return;

        if (data?.status === "open") {
          setQrStatus("connected");
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          queryClient.invalidateQueries({ queryKey: ["wa-instances"] });
          toast({ title: "✅ WhatsApp conectado!" });
          setTimeout(() => {
            onCreateSuccess();
            onOpenChange(false);
          }, 2000);
          return;
        }

        if (data?.qr_code_base64) {
          setQrCode(data.qr_code_base64);
        }
      } catch (e) {
        console.warn("[qr-polling]", e);
      }
    }, 3000);

    timeoutRef.current = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setQrStatus("expired");
    }, 60000);
  };

  const handleRegenerateQR = () => {
    if (!createdInstanceId) return;
    setQrStatus("waiting");
    setQrCode(null);
    startQrPolling(createdInstanceId);
  };

  // Vendedor selection section (reused for create and edit)
  const vendedorSection = (
    <div>
      <Label>Vincular a Consultores (opcional)</Label>
      <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
        {vendedores.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum consultor ativo encontrado.</p>
        ) : (
          vendedores.map((v) => (
            <label
              key={v.id}
              className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
            >
              <Checkbox
                checked={selectedVendedorIds.includes(v.id)}
                onCheckedChange={() => toggleVendedor(v.id)}
              />
              <span className="text-sm">{v.nome}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );

  // Editing existing instance
  if (instance) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[90vw] max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Edit className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Editar Instância
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Atualize os dados de conexão da instância WhatsApp
              </p>
            </div>
          </DialogHeader>
          <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
            <div>
              <Label>Nome da Instância *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: WhatsApp Vendas" />
            </div>
            <div>
              <Label>Nome da Instância na Evolution API *</Label>
              <Input
                value={instanceKey}
                onChange={(e) => setInstanceKey(e.target.value)}
                placeholder="Ex: Escritorio, MaisEnergia"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label>URL da Evolution API *</Label>
              <Input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://evolution.suaempresa.com"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label>API Key da Evolution</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Cole aqui a API Key / Global Token"
                className="font-mono text-sm"
              />
            </div>
            {vendedorSection}
          </div>
          <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button variant="default" onClick={handleSubmitEdit} disabled={!nome.trim() || !instanceKey.trim() || saving}>
              {saving && <Spinner size="sm" />}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // New instance → 2-step QR flow
  const isRegister = mode === "register";
  const formValid = isRegister
    ? !!(nome.trim() && apiUrl.trim() && apiKey.trim() && instanceKey.trim())
    : !!(nome.trim() && apiUrl.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {step === "form" ? (
              isRegister ? <ServerCog className="w-5 h-5 text-primary" /> : <Smartphone className="w-5 h-5 text-primary" />
            ) : (
              <QrCode className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {step === "form"
                ? (isRegister ? "Registrar Instância Existente" : "Nova Instância WhatsApp")
                : "Conectar WhatsApp"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === "form"
                ? (isRegister
                    ? "Vincule uma instância já criada na Evolution API (requer API Key manual)"
                    : "Cria automaticamente na Evolution API usando a chave global do servidor")
                : "Escaneie o QR Code com o WhatsApp do celular"}
            </p>
          </div>
        </DialogHeader>

        {step === "form" ? (
          <>
            <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
              {/* Mode Toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <Button
                  type="button"
                  variant={mode === "create" ? "default" : "ghost"}
                  className="flex-1 rounded-none"
                  onClick={() => setMode("create")}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Criar Nova
                </Button>
                <Button
                  type="button"
                  variant={mode === "register" ? "default" : "ghost"}
                  className="flex-1 rounded-none"
                  onClick={() => setMode("register")}
                >
                  <ServerCog className="w-3.5 h-3.5 mr-1.5" />
                  Registrar Existente
                </Button>
              </div>

              <div>
                <Label>Nome da Instância *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: WhatsApp Vendas" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {isRegister
                    ? "Nome de exibição no sistema (pode ser diferente do nome na Evolution)."
                    : "Será usado como identificador na Evolution API."}
                </p>
              </div>

              {isRegister && (
                <div>
                  <Label>Nome na Evolution API *</Label>
                  <Input
                    value={instanceKey}
                    onChange={(e) => setInstanceKey(e.target.value)}
                    placeholder="Ex: MaisEnergia, Escritorio"
                    className="font-mono text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Nome exato da instância já criada na Evolution API.
                  </p>
                </div>
              )}

              <div>
                <Label>URL da Evolution API *</Label>
                <Input
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://evolution.suaempresa.com"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label>Tipo de API *</Label>
                <Select
                  value={apiFlavor}
                  onValueChange={(v) => setApiFlavor(v as "classic" | "go")}
                  disabled={lockApiFlavor}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">Evolution Clássica (Baileys / Node)</SelectItem>
                    <SelectItem value="go">Evolution GO (whatsmeow)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {lockApiFlavor
                    ? `Tipo definido pela origem do card (${apiFlavor === "go" ? "Evolution GO" : "Evolution Clássica"}).`
                    : "Selecione conforme a versão do servidor Evolution. Default: Clássica."}
                </p>
              </div>
              {isRegister && (
                <div>
                  <Label>API Key *</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Cole a API Key / Global Token"
                    className="font-mono text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Obrigatória para validar a instância existente.
                  </p>
                </div>
              )}

              {isRegister && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">
                      Não sabe o nome exato? Busque no servidor:
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleFetchRemoteInstances}
                      disabled={fetchingRemote || !apiUrl.trim()}
                      className="gap-1.5 h-7 text-xs"
                    >
                      {fetchingRemote ? <Spinner size="sm" /> : <RefreshCw className="h-3 w-3" />}
                      Buscar instâncias
                    </Button>
                  </div>
                  {remoteInstances && remoteInstances.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1 border-t pt-2">
                      {remoteInstances.map((ri) => {
                        const isSelected = instanceKey === ri.name;
                        return (
                          <button
                            key={ri.name}
                            type="button"
                            disabled={ri.already_linked}
                            onClick={() => {
                              setInstanceKey(ri.name);
                              if (!nome.trim()) setNome(ri.profile_name || ri.name);
                            }}
                            className={`w-full text-left p-2 rounded-md border text-xs transition-colors ${
                              ri.already_linked
                                ? "bg-muted/50 border-border opacity-60 cursor-not-allowed"
                                : isSelected
                                ? "bg-primary/10 border-primary"
                                : "bg-background border-border hover:bg-accent"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-mono font-medium truncate">{ri.name}</p>
                                {(ri.profile_name || ri.phone_number) && (
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {ri.profile_name}{ri.profile_name && ri.phone_number ? " · " : ""}{ri.phone_number}
                                  </p>
                                )}
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-[9px] shrink-0 ${
                                  ri.already_linked
                                    ? "bg-muted text-muted-foreground"
                                    : ri.status === "connected"
                                    ? "bg-success/10 text-success border-success/20"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {ri.already_linked ? "já vinculada" : ri.status}
                              </Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {remoteInstances && remoteInstances.length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic">Nenhuma instância encontrada no servidor.</p>
                  )}
                </div>
              )}

              {!isRegister && (
                <div className="rounded-lg bg-muted/30 border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    🔑 A API Key global configurada no servidor será usada automaticamente para criar a instância.
                  </p>
                </div>
              )}
              {vendedorSection}
              {qrError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {qrError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleCreateWithQR} disabled={!formValid || saving}>
                {saving ? <Spinner size="sm" className="mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                {isRegister ? "Registrar e Conectar" : "Criar e Gerar QR Code"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4 p-5 flex-1 min-h-0">
              {qrStatus === "connected" ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                    <Check className="w-8 h-8 text-success" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">WhatsApp conectado!</p>
                  <p className="text-sm text-muted-foreground">Fechando automaticamente...</p>
                </div>
              ) : qrStatus === "expired" ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 text-warning" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">QR Code expirado</p>
                  <p className="text-xs text-muted-foreground text-center">
                    O tempo de escaneamento expirou. Clique abaixo para gerar um novo QR Code.
                  </p>
                  <Button variant="outline" onClick={handleRegenerateQR} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Gerar Novo QR Code
                  </Button>
                </div>
              ) : (
                <>
                  {qrCode ? (
                    <div className="rounded-xl border border-border bg-background p-3">
                      <img
                        src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                        alt="QR Code WhatsApp"
                        className="w-64 h-64 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-64 h-64 rounded-xl border border-border bg-muted/30 flex items-center justify-center">
                      <Spinner size="lg" />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <p className="text-sm text-muted-foreground">Aguardando escaneamento...</p>
                  </div>
                  <p className="text-xs text-muted-foreground text-center max-w-xs">
                    Abra o WhatsApp no celular → Configurações → Aparelhos conectados → Conectar aparelho → Escaneie o QR Code acima
                  </p>
                </>
              )}
            </div>
            <div className="flex justify-end p-4 border-t border-border bg-muted/30">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
