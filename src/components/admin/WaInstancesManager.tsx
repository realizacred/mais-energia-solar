import { useState } from "react";
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

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Wifi }> = {
  connected: { label: "Conectado", className: "bg-success/10 text-success border-success/20", icon: Wifi },
  disconnected: { label: "Desconectado", className: "bg-muted text-muted-foreground border-border", icon: WifiOff },
  connecting: { label: "Conectando...", className: "bg-warning/10 text-warning border-warning/20", icon: RefreshCw },
  error: { label: "Erro", className: "bg-destructive/10 text-destructive border-destructive/20", icon: WifiOff },
};

export function WaInstancesManager() {
  const { instances, loading, createInstance, updateInstance, deleteInstance } = useWaInstances();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editInstance, setEditInstance] = useState<WaInstance | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Instâncias WhatsApp</h2>
            <p className="text-sm text-muted-foreground">
              {instances.length} instância{instances.length !== 1 ? "s" : ""} configurada{instances.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Instância
        </Button>
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
                        <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
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
  const [nome, setNome] = useState(instance?.nome || "");
  const [instanceKey, setInstanceKey] = useState(instance?.evolution_instance_key || "");
  const [apiUrl, setApiUrl] = useState(instance?.evolution_api_url || "https://");
  const [vendedorId, setVendedorId] = useState(instance?.vendedor_id || "none");
  const [saving, setSaving] = useState(false);

  // Reset form when instance changes
  useState(() => {
    setNome(instance?.nome || "");
    setInstanceKey(instance?.evolution_instance_key || "");
    setApiUrl(instance?.evolution_api_url || "https://");
    setVendedorId(instance?.vendedor_id || "none");
  });

  const handleSubmit = async () => {
    if (!nome.trim() || !instanceKey.trim() || !apiUrl.trim()) return;
    setSaving(true);
    try {
      await onSave({
        nome: nome.trim(),
        evolution_instance_key: instanceKey.trim(),
        evolution_api_url: apiUrl.trim(),
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
            <Label>Instance Key (Evolution API) *</Label>
            <Input
              value={instanceKey}
              onChange={(e) => setInstanceKey(e.target.value)}
              placeholder="minha-instancia"
              className="font-mono text-sm"
              disabled={!!instance}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Identificador único da instância na Evolution API.
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
