import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pencil,
  
  KeyRound,
  Mail,
  UserX,
  UserCheck,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Users,
  UserPlus,
  Save,
  Link2,
  Settings2,
} from "lucide-react";

interface UserWithRoles {
  user_id: string;
  nome: string;
  email?: string;
  ativo: boolean;
  roles: string[];
}

const ROLE_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  admin: { label: "Administrador", color: "bg-destructive/10 text-destructive border-destructive/30", icon: ShieldAlert },
  gerente: { label: "Gerente", color: "bg-accent text-accent-foreground border-border", icon: ShieldCheck },
  vendedor: { label: "Consultor", color: "bg-info/10 text-info border-info/30", icon: Users },
  instalador: { label: "Instalador", color: "bg-success/10 text-success border-success/30", icon: Users },
  financeiro: { label: "Financeiro", color: "bg-warning/10 text-warning border-warning/30", icon: Users },
};

const FEATURE_LABELS: Record<string, { label: string; description: string }> = {
  view_groups: { label: "Ver Grupos", description: "Permite visualizar conversas de grupo no Inbox" },
  view_hidden: { label: "Ver Ocultas", description: "Permite visualizar conversas ocultas no Inbox" },
  delete_leads: { label: "Excluir Leads", description: "Permite excluir leads do sistema" },
  delete_clients: { label: "Excluir Clientes", description: "Permite excluir clientes do sistema" },
};

interface UserEditDialogProps {
  user: UserWithRoles | null;
  onClose: () => void;
  onRefresh: () => void;
  currentUserId?: string;
  onNavigateAway?: () => void;
}

export function UserEditDialog({ user, onClose, onRefresh, currentUserId, onNavigateAway }: UserEditDialogProps) {
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [selectedNewRole, setSelectedNewRole] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  // Keep local state for status toggle
  const [localAtivo, setLocalAtivo] = useState(true);
  const [localRoles, setLocalRoles] = useState<string[]>([]);
  const [linkedVendedor, setLinkedVendedor] = useState<{ id: string; nome: string; telefone: string; email: string; codigo: string } | null>(null);

  const [featurePerms, setFeaturePerms] = useState<Record<string, boolean>>({});
  const [savingPerm, setSavingPerm] = useState<string | null>(null);

  // Sync local state when user prop changes
  useEffect(() => {
    if (user) {
      setEditName(user.nome || "");
      setEditEmail(user.email || "");
      setLocalAtivo(user.ativo ?? true);
      setLocalRoles(user.roles || []);
      setSelectedNewRole("");
      // Fetch linked consultor
      (supabase as any)
        .from("consultores")
        .select("id, nome, telefone, email, codigo")
        .eq("user_id", user.user_id)
        .maybeSingle()
        .then(({ data }) => setLinkedVendedor(data));
      // Fetch feature permissions
      supabase
        .from("user_feature_permissions")
        .select("feature, enabled")
        .eq("user_id", user.user_id)
        .then(({ data }) => {
          const perms: Record<string, boolean> = {};
          (data ?? []).forEach((p) => { perms[p.feature] = p.enabled; });
          setFeaturePerms(perms);
        });
    } else {
      setLinkedVendedor(null);
      setFeaturePerms({});
    }
  }, [user]);

  if (!user) return null;

  const handleToggleFeature = async (feature: string, enabled: boolean) => {
    setSavingPerm(feature);
    try {
      // Upsert: insert or update
      const { error } = await supabase
        .from("user_feature_permissions")
        .upsert(
          { user_id: user.user_id, feature, enabled, granted_by: currentUserId },
          { onConflict: "user_id,tenant_id,feature" }
        );
      if (error) throw error;
      setFeaturePerms((prev) => ({ ...prev, [feature]: enabled }));
      toast({ title: enabled ? "Permissão concedida" : "Permissão removida" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSavingPerm(null);
    }
  };

  const isConsultant = localRoles.includes("vendedor") || localRoles.includes("instalador");

  const availableRoles = Object.keys(ROLE_LABELS).filter(r => !localRoles.includes(r));
  const isSelf = currentUserId === user.user_id;
  const nameChanged = editName.trim() !== user.nome;
  const emailChanged = editEmail.trim() !== (user.email || "");

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ nome: editName.trim() })
        .eq("user_id", user.user_id);
      if (error) throw error;

      // Sync name to linked vendedor
      if (linkedVendedor) {
        await (supabase as any)
          .from("consultores")
          .update({ nome: editName.trim() })
          .eq("user_id", user.user_id);
        setLinkedVendedor({ ...linkedVendedor, nome: editName.trim() });
      }

      toast({ title: "Nome atualizado!", description: `Nome alterado para "${editName.trim()}".` });
      onRefresh();
    } catch (error: any) {
      toast({ title: "Erro ao salvar nome", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!editEmail.trim() || !emailChanged) return;
    setIsUpdatingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão inválida.");

      const response = await supabase.functions.invoke("update-user-email", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { user_id: user.user_id, new_email: editEmail.trim() },
      });

      if (response.error) throw new Error(response.error.message || "Erro ao atualizar email");
      if (response.data?.error) throw new Error(String(response.data.error));

      // Sync email to linked vendedor
      if (linkedVendedor) {
        await (supabase as any)
          .from("consultores")
          .update({ email: editEmail.trim() })
          .eq("user_id", user.user_id);
        setLinkedVendedor({ ...linkedVendedor, email: editEmail.trim() });
      }

      toast({ title: "Email atualizado!", description: `Novo email: ${editEmail.trim()}` });
      onRefresh();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar email", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleToggleActive = async () => {
    setIsTogglingStatus(true);
    const newStatus = !localAtivo;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ ativo: newStatus })
        .eq("user_id", user.user_id);
      if (error) throw error;
      setLocalAtivo(newStatus);
      toast({
        title: newStatus ? "Usuário reativado!" : "Usuário desativado!",
        description: newStatus
          ? `${user.nome} agora pode acessar o sistema.`
          : `${user.nome} não poderá mais acessar o sistema.`,
      });
      onRefresh();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user.email) return;
    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth?type=recovery`,
      });

      if (error) {
        const isRateLimited = error.message.includes("security purposes") ||
          error.message.includes("rate") || (error as any).status === 429;
        if (isRateLimited) {
          toast({ title: "Aguarde um momento", description: "Por segurança, aguarde alguns minutos.", variant: "destructive" });
          setShowResetConfirm(false);
          return;
        }
        throw error;
      }

      toast({ title: "Email enviado!", description: `Link de redefinição enviado para ${user.email}.` });
      setShowResetConfirm(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleAddRole = async () => {
    if (!selectedNewRole) return;
    setIsAddingRole(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: user.user_id, role: selectedNewRole as any });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Perfil já existe", variant: "destructive" });
          return;
        }
        throw error;
      }

      setLocalRoles([...localRoles, selectedNewRole]);
      setSelectedNewRole("");
      toast({ title: "Perfil adicionado!" });
      onRefresh();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsAddingRole(false);
    }
  };

  const handleRemoveRole = async (role: string) => {
    if (role === "admin") {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const remaining = adminRoles?.filter(r => r.user_id !== user.user_id).length ?? 0;
      if (remaining < 1) {
        toast({ title: "Ação bloqueada", description: "Não é possível remover o último administrador.", variant: "destructive" });
        return;
      }
    }

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.user_id)
        .eq("role", role as any);
      if (error) throw error;

      setLocalRoles(localRoles.filter(r => r !== role));
      toast({ title: "Perfil removido!" });

      if (isSelf && role === "admin" && onNavigateAway) {
        onNavigateAway();
        return;
      }
      onRefresh();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteUser = async () => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão inválida.");

      const response = await supabase.functions.invoke("delete-user", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { user_id: user.user_id },
      });

      if (response.error) throw new Error(response.error.message || "Erro ao excluir");
      if (response.data?.error) throw new Error(String(response.data.error));

      toast({ title: "Usuário excluído!", description: `${user.nome} foi removido permanentemente.` });
      setShowDeleteConfirm(false);
      onClose();
      onRefresh();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Editar Usuário
            </DialogTitle>
            <DialogDescription>
              Gerencie os dados, acesso e permissões do usuário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome completo</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-nome"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome do usuário"
                />
                {nameChanged && (
                  <Button size="sm" onClick={handleSaveName} disabled={isSaving || !editName.trim()}>
                    {isSaving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="edit-email">E-mail</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
                {emailChanged && (
                  <Button size="sm" onClick={handleUpdateEmail} disabled={isUpdatingEmail || !editEmail.trim()}>
                    {isUpdatingEmail ? <Spinner size="sm" /> : <Mail className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* Status toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Status do usuário</Label>
                <p className="text-xs text-muted-foreground">
                  {localAtivo ? "Usuário pode acessar o sistema" : "Acesso bloqueado"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={localAtivo
                    ? "bg-success/10 text-success border-success/30"
                    : "bg-muted text-muted-foreground border-border"
                  }
                >
                  {localAtivo ? "Ativo" : "Inativo"}
                </Badge>
                <Switch
                  checked={localAtivo}
                  onCheckedChange={handleToggleActive}
                  disabled={isTogglingStatus || isSelf}
                />
              </div>
            </div>

            <Separator />

            {/* Perfis / Roles */}
            <div className="space-y-3">
              <Label>Perfis de acesso</Label>
              <div className="flex flex-wrap gap-1.5">
                {localRoles.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Sem perfil atribuído</span>
                ) : (
                  localRoles.map((role) => {
                    const roleInfo = ROLE_LABELS[role];
                    return (
                      <Badge key={role} variant="outline" className={`${roleInfo?.color || ""} gap-1`}>
                        {roleInfo?.label || role}
                        <button
                          onClick={() => handleRemoveRole(role)}
                          className="ml-1 hover:text-destructive transition-colors"
                          title="Remover perfil"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })
                )}
              </div>
              {availableRoles.length > 0 && (
                <div className="flex gap-2">
                  <Select value={selectedNewRole} onValueChange={setSelectedNewRole}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Adicionar perfil..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]?.label || role}
                        </SelectItem>
                      ))}</SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddRole}
                    disabled={!selectedNewRole || isAddingRole}
                    className="gap-1"
                  >
                    {isAddingRole ? <Spinner size="sm" /> : <UserPlus className="w-4 h-4" />}
                    Adicionar
                  </Button>
                </div>
              )}
            </div>

            {/* Permissões de funcionalidades */}
            {isConsultant && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="flex items-center gap-1.5">
                    <Settings2 className="w-4 h-4 text-primary" />
                    Permissões de Funcionalidade
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Controle quais funcionalidades este usuário pode acessar.
                  </p>
                  <div className="space-y-2">
                    {Object.entries(FEATURE_LABELS).map(([feature, info]) => (
                      <div key={feature} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/40">
                        <div>
                          <p className="text-sm font-medium">{info.label}</p>
                          <p className="text-[11px] text-muted-foreground">{info.description}</p>
                        </div>
                        <Switch
                          checked={featurePerms[feature] ?? false}
                          onCheckedChange={(checked) => handleToggleFeature(feature, checked)}
                          disabled={savingPerm === feature}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Linked Vendedor */}
            {linkedVendedor && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-primary" />
                  Consultor vinculado
                </Label>
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <p><span className="text-muted-foreground">Código:</span> <span className="font-medium">{linkedVendedor.codigo}</span></p>
                  <p><span className="text-muted-foreground">Telefone:</span> {linkedVendedor.telefone || "—"}</p>
                  <p><span className="text-muted-foreground">Email:</span> {linkedVendedor.email || "—"}</p>
                </div>
              </div>
            )}

            {!linkedVendedor && localRoles.includes("vendedor") && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">
                <p className="font-medium">⚠️ Consultor não vinculado</p>
                <p className="text-xs mt-1">Este usuário tem perfil de consultor mas não está vinculado a um registro de consultor.</p>
              </div>
            )}

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Ações</Label>
              <div className="grid grid-cols-1 gap-2">
                {user.email && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => setShowResetConfirm(true)}
                  >
                    <KeyRound className="w-4 h-4" />
                    Enviar email de redefinição de senha
                  </Button>
                )}
                {!isSelf && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir usuário permanentemente
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Confirm */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Redefinir senha?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Um email será enviado para <span className="font-semibold text-foreground">{user.email}</span> com
              instruções para criar uma nova senha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResettingPassword}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword} disabled={isResettingPassword}>
              {isResettingPassword && <Spinner size="sm" />}
              Enviar email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Excluir usuário permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-destructive">Atenção: Esta ação é irreversível!</span>
              <br /><br />
              O usuário "{user.nome}" será removido permanentemente, incluindo conta de acesso, perfil e roles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting && <Spinner size="sm" />}
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
