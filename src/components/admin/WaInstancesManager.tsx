import { useState, useEffect, useRef } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useWaInstances, type WaInstance } from "@/hooks/useWaInstances";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WaSetupGuide } from "@/components/admin/wa/WaSetupGuide";
import { WaQRCodeDialog } from "@/components/admin/wa/WaQRCodeDialog";

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Wifi }> = {
  connected: { label: "Conectado", className: "bg-success/10 text-success border-success/20", icon: Wifi },
  disconnected: { label: "Desconectado", className: "bg-muted text-muted-foreground border-border", icon: WifiOff },
  connecting: { label: "Conectando...", className: "bg-warning/10 text-warning border-warning/20", icon: RefreshCw },
  error: { label: "Erro", className: "bg-destructive/10 text-destructive border-destructive/20", icon: WifiOff },
};

export function WaInstancesManager() {
  const { instances, loading, createInstance, updateInstance, deleteInstance, checkStatus, checkingStatus, syncHistory } = useWaInstances();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editInstance, setEditInstance] = useState<WaInstance | null>(null);
  const [syncInstance, setSyncInstance] = useState<WaInstance | null>(null);
  const [qrInstance, setQrInstance] = useState<WaInstance | null>(null);
  const [syncDays, setSyncDays] = useState("365");
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-wa-instances"],
    queryFn: async () => {
      const { data } = await supabase.from("consultores").select("id, nome, user_id").eq("ativo", true);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch junction table data for all instances
  const { data: instanceVendedores = [] } = useQuery({
    queryKey: ["wa-instance-vendedores"],
    queryFn: async () => {
      const { data } = await supabase.from("wa_instance_consultores").select("instance_id, consultor_id");
      return data || [];
    },
    staleTime: 30 * 1000,
  });

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
                        <Button size="icon" variant="ghost" className="h-8 w-8">
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
                        <DropdownMenuItem
                          onClick={() => deleteInstance(inst.id)}
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
                      <p>{new Date(inst.last_sync_at).toLocaleString("pt-BR")}</p>
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
        onSave={async (data, selectedVendedorIds) => {
          let instanceId = editInstance?.id;
          if (editInstance) {
            updateInstance({ id: editInstance.id, updates: data });
          } else {
            const created = await createInstance(data as any);
            instanceId = created?.id;
          }

          // Sync junction table
          if (instanceId) {
            const tenantId = instances[0]?.tenant_id || editInstance?.tenant_id;
            if (tenantId) {
              // Delete existing links
              await supabase.from("wa_instance_consultores").delete().eq("instance_id", instanceId);
              // Insert new links
              if (selectedVendedorIds.length > 0) {
                await supabase.from("wa_instance_consultores").insert(
                  selectedVendedorIds.map((vid) => ({
                    instance_id: instanceId!,
                    consultor_id: vid,
                    tenant_id: tenantId,
                  }))
                );
              }
              // Also update legacy vendedor_id for backward compat
              const legacyVendedorId = selectedVendedorIds.length === 1 ? selectedVendedorIds[0] : null;
              await supabase.from("wa_instances").update({ consultor_id: legacyVendedorId } as any).eq("id", instanceId);
            }
            queryClient.invalidateQueries({ queryKey: ["wa-instance-consultores"] });
          }

          setShowCreate(false);
          setEditInstance(null);
        }}
      />

      {/* Sync History Dialog */}
      <Dialog open={!!syncInstance} onOpenChange={(v) => !v && setSyncInstance(null)}>
        <DialogContent className="max-w-md">
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
    </div>
  );
}

// ── Form Dialog with QR Code Flow ────────────────────────────────────────

type CreateStep = "form" | "qrcode";

function InstanceFormDialog({
  open,
  onOpenChange,
  instance,
  vendedores,
  initialVendedorIds,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  instance: WaInstance | null;
  vendedores: { id: string; nome: string; user_id: string | null }[];
  initialVendedorIds: string[];
  onSave: (data: any, selectedVendedorIds: string[]) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [instanceKey, setInstanceKey] = useState("");
  const [apiUrl, setApiUrl] = useState("https://");
  const [apiKey, setApiKey] = useState("");
  const [selectedVendedorIds, setSelectedVendedorIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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
      setNome(instance?.nome || "");
      setInstanceKey(instance?.evolution_instance_key || "");
      setApiUrl(instance?.evolution_api_url || "https://");
      setApiKey((instance as any)?.api_key || "");
      setSelectedVendedorIds(initialVendedorIds);
      setStep("form");
      setQrCode(null);
      setCreatedInstanceId(null);
      setQrStatus("waiting");
      setQrError(null);
    } else {
      // Cleanup on close
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [open, instance, initialVendedorIds]);

  // Cleanup on unmount
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

  // For editing existing instances — keep old flow
  const handleSubmitEdit = async () => {
    if (!nome.trim() || !instanceKey.trim() || !apiUrl.trim()) return;
    setSaving(true);
    try {
      await onSave(
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

  // For new instances — create via edge function + show QR
  const handleCreateWithQR = async () => {
    if (!nome.trim() || !apiUrl.trim() || !apiKey.trim()) return;
    setSaving(true);
    setQrError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão inválida");

      const { data, error } = await supabase.functions.invoke("create-wa-instance", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          instance_name: nome.trim(),
          api_url: apiUrl.trim(),
          api_key: apiKey.trim(),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao criar instância");

      setCreatedInstanceId(data.instance_id);
      setQrCode(data.qr_code_base64 || null);
      setStep("qrcode");
      queryClient.invalidateQueries({ queryKey: ["wa-instances"] });

      // Start polling for connection status
      startQrPolling(data.instance_id);
    } catch (e: any) {
      console.error("[create-wa-instance]", e);
      setQrError(e.message || "Erro ao criar instância");
      toast({ title: "Erro ao criar instância", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const startQrPolling = (instanceId: string) => {
    // Clear existing timers
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setQrStatus("waiting");

    // Poll every 3s
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
          // Connected!
          setQrStatus("connected");
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          queryClient.invalidateQueries({ queryKey: ["wa-instances"] });
          toast({ title: "✅ WhatsApp conectado!" });
          // Auto-close after 2s
          setTimeout(() => {
            onOpenChange(false);
          }, 2000);
          return;
        }

        // Update QR code if available
        if (data?.qr_code_base64) {
          setQrCode(data.qr_code_base64);
        }
      } catch (e) {
        console.warn("[qr-polling]", e);
      }
    }, 3000);

    // Timeout after 60s
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

  // Editing existing instance → old form
  if (instance) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Instância</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
            <div>
              <Label>Vincular a Consultores (opcional)</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
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
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button variant="default" onClick={handleSubmitEdit} disabled={!nome.trim() || !instanceKey.trim() || saving}>
              {saving && <Spinner size="sm" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // New instance → 2-step QR flow
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "form" ? (
              <>
                <Smartphone className="w-5 h-5 text-primary" />
                Nova Instância WhatsApp
              </>
            ) : (
              <>
                <QrCode className="w-5 h-5 text-primary" />
                Conectar WhatsApp
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === "form" ? (
          <>
            <div className="space-y-4">
              <div>
                <Label>Nome da Instância *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: WhatsApp Vendas" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Será usado como identificador na Evolution API.
                </p>
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
                <Label>API Key *</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Cole a API Key / Global Token"
                  className="font-mono text-sm"
                />
              </div>
              {qrError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {qrError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleCreateWithQR} disabled={!nome.trim() || !apiUrl.trim() || !apiKey.trim() || saving}>
                {saving ? <Spinner size="sm" className="mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                Criar e Gerar QR Code
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4">
            {qrStatus === "connected" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                  <Check className="w-8 h-8 text-success" />
                </div>
                <p className="text-lg font-semibold text-foreground">WhatsApp conectado!</p>
                <p className="text-sm text-muted-foreground">Fechando automaticamente...</p>
              </div>
            ) : qrStatus === "expired" ? (
              <div className="flex flex-col items-center gap-3">
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
            <DialogFooter className="w-full mt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
