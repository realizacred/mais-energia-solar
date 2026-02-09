import { useState, useEffect } from "react";
import {
  Smartphone,
  Plus,
  Trash2,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
  Copy,
  ExternalLink,
  MoreVertical,
  Edit,
  Link2,
  CheckCircle2,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useWaInstances, type WaInstance } from "@/hooks/useWaInstances";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WaSetupGuide } from "@/components/admin/wa/WaSetupGuide";

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Wifi }> = {
  connected: { label: "Conectado", className: "bg-success/10 text-success border-success/20", icon: Wifi },
  disconnected: { label: "Desconectado", className: "bg-muted text-muted-foreground border-border", icon: WifiOff },
  connecting: { label: "Conectando...", className: "bg-warning/10 text-warning border-warning/20", icon: RefreshCw },
  error: { label: "Erro", className: "bg-destructive/10 text-destructive border-destructive/20", icon: WifiOff },
};

export function WaInstancesManager() {
  const { instances, loading, createInstance, updateInstance, deleteInstance, checkStatus, checkingStatus, syncHistory } = useWaInstances();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editInstance, setEditInstance] = useState<WaInstance | null>(null);
  const [syncInstance, setSyncInstance] = useState<WaInstance | null>(null);
  const [syncDays, setSyncDays] = useState("365");
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-wa-instances"],
    queryFn: async () => {
      const { data } = await supabase.from("vendedores").select("id, nome, user_id").eq("ativo", true);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const webhookBaseUrl = `https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/evolution-webhook`;

  const copyWebhookUrl = (inst: WaInstance) => {
    const url = `${webhookBaseUrl}?instance=${encodeURIComponent(inst.evolution_instance_key)}&secret=${encodeURIComponent(inst.webhook_secret)}`;
    navigator.clipboard.writeText(url);
    toast({ title: "URL copiada!", description: "Cole na configuração de webhook da Evolution API." });
  };

  const connectedCount = instances.filter((i) => i.status === "connected").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Instâncias WhatsApp</h2>
            <p className="text-sm text-muted-foreground">
              {connectedCount}/{instances.length} conectada{connectedCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
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
                <Loader2 className="h-4 w-4 animate-spin" />
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
      </div>

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
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Smartphone className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground/70">Nenhuma instância configurada</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Conecte sua primeira instância da Evolution API para começar a receber e enviar mensagens pelo WhatsApp.
            </p>
            <Button onClick={() => setShowCreate(true)} className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Configurar Primeira Instância
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {instances.map((inst) => {
            const st = STATUS_CONFIG[inst.status] || STATUS_CONFIG.disconnected;
            const StatusIcon = st.icon;
            const vendedor = vendedores.find((v) => v.id === inst.vendedor_id);

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

                  {vendedor && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Link2 className="h-3 w-3" />
                      <span>{vendedor.nome}</span>
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
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Verificando...
                    </div>
                  )}
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
        vendedores={vendedores}
        onSave={async (data) => {
          if (editInstance) {
            updateInstance({ id: editInstance.id, updates: data });
          } else {
            await createInstance(data as any);
          }
          setShowCreate(false);
          setEditInstance(null);
        }}
      />

      {/* Sync History Dialog */}
      <Dialog open={!!syncInstance} onOpenChange={(v) => !v && setSyncInstance(null)}>
        <DialogContent className="sm:max-w-md">
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
            <Button variant="outline" onClick={() => setSyncInstance(null)} disabled={isSyncing}>
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
              {isSyncing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sincronizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Form Dialog ────────────────────────────────────────

function InstanceFormDialog({
  open,
  onOpenChange,
  instance,
  vendedores,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  instance: WaInstance | null;
  vendedores: { id: string; nome: string; user_id: string | null }[];
  onSave: (data: any) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [instanceKey, setInstanceKey] = useState("");
  const [apiUrl, setApiUrl] = useState("https://");
  const [apiKey, setApiKey] = useState("");
  const [vendedorId, setVendedorId] = useState("none");
  const [saving, setSaving] = useState(false);

  // Reset form when instance changes or dialog opens
  useEffect(() => {
    if (open) {
      setNome(instance?.nome || "");
      setInstanceKey(instance?.evolution_instance_key || "");
      setApiUrl(instance?.evolution_api_url || "https://");
      setApiKey((instance as any)?.api_key || "");
      setVendedorId(instance?.vendedor_id || "none");
    }
  }, [open, instance]);

  // Detect if value looks like a UUID (API Key) instead of an instance name
  // No longer block UUIDs in instance key field since we have a dedicated API Key field
  
  const handleSubmit = async () => {
    if (!nome.trim() || !instanceKey.trim() || !apiUrl.trim()) return;
    setSaving(true);
    try {
      await onSave({
        nome: nome.trim(),
        evolution_instance_key: instanceKey.trim(),
        evolution_api_url: apiUrl.trim(),
        api_key: apiKey.trim() || null,
        vendedor_id: vendedorId === "none" ? null : vendedorId,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{instance ? "Editar Instância" : "Nova Instância WhatsApp"}</DialogTitle>
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
            <p className="text-[10px] text-muted-foreground mt-1">
              O nome exato como aparece na Evolution API.
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
            <Label>API Key da Evolution</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Cole aqui a API Key / Global Token"
              className="font-mono text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Opcional. Se vazio, usa a chave global configurada nas secrets do projeto.
            </p>
          </div>
          <div>
            <Label>Vincular a Vendedor (opcional)</Label>
            <Select value={vendedorId} onValueChange={setVendedorId}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (compartilhado)</SelectItem>
                {vendedores.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!nome.trim() || !instanceKey.trim() || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {instance ? "Salvar" : "Criar Instância"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
