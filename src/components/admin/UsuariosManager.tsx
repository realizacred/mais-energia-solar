import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isEmailAlreadyRegisteredError, parseInvokeError } from "@/lib/supabaseFunctionError";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Shield, 
  UserPlus, 
  Trash2, 
  Loader2,
  Users,
  ShieldCheck,
  ShieldAlert,
  Plus,
  MoreVertical,
  UserX,
  UserCheck,
  KeyRound,
} from "lucide-react";

interface UserRole {
  id: string;
  user_id: string;
  role: "admin" | "gerente" | "vendedor" | "instalador" | "financeiro";
  created_at: string;
}

interface UserProfile {
  user_id: string;
  nome: string;
  email?: string;
  ativo: boolean;
}

interface UserWithRoles {
  user_id: string;
  nome: string;
  email?: string;
  ativo: boolean;
  roles: string[];
}

interface NewUserForm {
  nome: string;
  email: string;
  password: string;
  role: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  admin: { label: "Administrador", color: "bg-red-100 text-red-800 border-red-200", icon: ShieldAlert },
  gerente: { label: "Gerente", color: "bg-purple-100 text-purple-800 border-purple-200", icon: ShieldCheck },
  vendedor: { label: "Vendedor", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Users },
  instalador: { label: "Instalador", color: "bg-green-100 text-green-800 border-green-200", icon: Users },
  financeiro: { label: "Financeiro", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Users },
};

export function UsuariosManager() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [canManageUsers, setCanManageUsers] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [newUserForm, setNewUserForm] = useState<NewUserForm>({
    nome: "",
    email: "",
    password: "",
    role: "vendedor",
  });
  const [userToDeactivate, setUserToDeactivate] = useState<UserWithRoles | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);
  const [userToResetPassword, setUserToResetPassword] = useState<UserWithRoles | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const checkAndLoad = async () => {
      setCheckingPermission(true);
      setLoading(true);

      if (!user) {
        if (!cancelled) {
          setCanManageUsers(false);
          setCheckingPermission(false);
          setLoading(false);
        }
        return;
      }

      try {
        // Only admins can manage users/roles (matches backend policies)
        const { data: roles, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) throw error;

        const isAdmin = (roles ?? []).some((r) => r.role === "admin");

        if (cancelled) return;
        setCanManageUsers(isAdmin);
        setCheckingPermission(false);

        if (isAdmin) {
          await fetchUsers();
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error("Error checking permissions:", e);
        if (!cancelled) {
          setCanManageUsers(false);
          setCheckingPermission(false);
          setLoading(false);
        }
      }
    };

    checkAndLoad();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const fetchUsers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, nome, ativo")
        .order("nome");

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Fetch emails from edge function (gets from auth.users)
      let emailMap: Record<string, string> = {};
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const response = await supabase.functions.invoke("list-users-emails", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (response.data?.emails) {
            emailMap = response.data.emails;
          }
        }
      } catch (emailError) {
        console.warn("Could not fetch user emails:", emailError);
      }

      // Combine profiles with roles and emails
      const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => {
        return {
          ...profile,
          email: emailMap[profile.user_id] || undefined,
          roles: (roles || [])
            .filter(r => r.user_id === profile.user_id)
            .map(r => r.role),
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os usuários.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async () => {
    if (!selectedUser || !selectedRole) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: selectedUser.user_id,
          role: selectedRole as any,
        });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Perfil já existe",
            description: "Este usuário já possui este perfil.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({ title: "Perfil adicionado com sucesso!" });
      setIsDialogOpen(false);
      setSelectedUser(null);
      setSelectedRole("");
      fetchUsers();
    } catch (error) {
      console.error("Error adding role:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o perfil.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    try {
      // Prevent removal of the last admin role in the system
      if (role === "admin") {
        // Count how many admins exist in the system
        const { data: adminRoles, error: countError } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        if (countError) throw countError;

        const adminCount = adminRoles?.length ?? 0;

        // If there's only 1 admin and we're trying to remove it, block the action
        if (adminCount <= 1) {
          toast({
            title: "Ação bloqueada",
            description: "Não é possível remover o último administrador do sistema.",
            variant: "destructive",
          });
          return;
        }

        // Extra safety: if removing will leave the system with no admins, block
        const remainingAdmins = adminRoles?.filter(r => r.user_id !== userId).length ?? 0;
        if (remainingAdmins < 1) {
          toast({
            title: "Ação bloqueada",
            description: "Não é possível remover o último administrador do sistema.",
            variant: "destructive",
          });
          return;
        }
      }

      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role as "admin" | "gerente" | "vendedor" | "instalador" | "financeiro");

      if (error) throw error;

      toast({ title: "Perfil removido!" });

      // If the logged-in user removed their own admin role, they will immediately lose
      // permission to see/manage other users due to backend policies.
      if (user && userId === user.id && role === "admin") {
        toast({
          title: "Acesso atualizado",
          description: "Você removeu seu próprio perfil de administrador. Entre com outro administrador para continuar.",
          variant: "destructive",
        });
        navigate("/portal", { replace: true });
        return;
      }

      fetchUsers();
    } catch (error) {
      console.error("Error removing role:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o perfil.",
        variant: "destructive",
      });
    }
  };

  const openAddRoleDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRole("");
    setIsDialogOpen(true);
  };

  const handleCreateUser = async () => {
    if (!newUserForm.nome || !newUserForm.email || !newUserForm.password) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (newUserForm.password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sessão inválida. Faça login novamente.");
      }
      
      const response = await supabase.functions.invoke("create-vendedor-user", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          nome: newUserForm.nome,
          email: newUserForm.email,
          password: newUserForm.password,
          role: newUserForm.role,
        },
      });

      if (response.error) {
        const parsed = await parseInvokeError(response.error);
        const msg = parsed.message || "Erro ao criar usuário";
        if (isEmailAlreadyRegisteredError(msg)) {
          throw new Error("Este e-mail já está cadastrado. Use outro e-mail ou crie o usuário com um e-mail diferente.");
        }
        throw new Error(msg);
      }

      if (response.data?.error) {
        const msg = String(response.data.error);
        if (isEmailAlreadyRegisteredError(msg)) {
          throw new Error("Este e-mail já está cadastrado. Use outro e-mail ou crie o usuário com um e-mail diferente.");
        }
        throw new Error(msg);
      }

      toast({ 
        title: "Usuário criado com sucesso!",
        description: `${newUserForm.nome} foi adicionado como ${ROLE_LABELS[newUserForm.role]?.label || newUserForm.role}.`,
      });
      
      setIsCreateDialogOpen(false);
      setNewUserForm({ nome: "", email: "", password: "", role: "vendedor" });
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Erro ao criar usuário",
        description: error.message || "Não foi possível criar o usuário.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Get available roles for user (ones they don't have yet)
  const getAvailableRoles = (user: UserWithRoles) => {
    return Object.keys(ROLE_LABELS).filter(role => !user.roles.includes(role));
  };

  const handleToggleActive = async () => {
    if (!userToDeactivate) return;

    setIsDeactivating(true);
    try {
      const newStatus = !userToDeactivate.ativo;
      const { error } = await supabase
        .from("profiles")
        .update({ ativo: newStatus })
        .eq("user_id", userToDeactivate.user_id);

      if (error) throw error;

      toast({ 
        title: newStatus ? "Usuário reativado!" : "Usuário desativado!",
        description: newStatus 
          ? `${userToDeactivate.nome} agora pode acessar o sistema.`
          : `${userToDeactivate.nome} não poderá mais acessar o sistema.`,
      });
      setUserToDeactivate(null);
      fetchUsers();
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status do usuário.",
        variant: "destructive",
      });
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sessão inválida. Faça login novamente.");
      }

      const response = await supabase.functions.invoke("delete-user", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          user_id: userToDelete.user_id,
        },
      });

      if (response.error) {
        const parsed = await parseInvokeError(response.error);
        throw new Error(parsed.message || "Erro ao excluir usuário");
      }

      if (response.data?.error) {
        throw new Error(String(response.data.error));
      }

      toast({ 
        title: "Usuário excluído!",
        description: `${userToDelete.nome} foi removido permanentemente do sistema.`,
      });
      setUserToDelete(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        title: "Erro ao excluir usuário",
        description: error.message || "Não foi possível excluir o usuário.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!userToResetPassword || !userToResetPassword.email) return;

    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        userToResetPassword.email,
        {
          redirectTo: `${window.location.origin}/auth?type=recovery`,
        }
      );

      if (error) {
        // Handle rate limiting errors specifically
        const isRateLimited = error.message.includes("security purposes") || 
                              error.message.includes("rate") ||
                              error.message.includes("email rate limit") ||
                              (error as any).status === 429;
        
        if (isRateLimited) {
          toast({
            title: "Aguarde um momento",
            description: "Por segurança, aguarde alguns minutos antes de solicitar novamente. Um email pode já ter sido enviado.",
            variant: "destructive",
          });
          setUserToResetPassword(null);
          return;
        }
        throw error;
      }

      toast({ 
        title: "Email de redefinição enviado!",
        description: `Um email foi enviado para ${userToResetPassword.email} com instruções para redefinir a senha.`,
      });
      setUserToResetPassword(null);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast({
        title: "Erro ao enviar email",
        description: error.message || "Não foi possível enviar o email de redefinição.",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (checkingPermission) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!canManageUsers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestão de Usuários</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Somente administradores podem ver e alterar os perfis de outros usuários.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/portal", { replace: true })}>
              Voltar ao portal
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Gestão de Usuários e Perfis
          </CardTitle>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Usuário
          </Button>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Perfis</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.user_id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{user.nome}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={user.ativo 
                            ? "bg-green-50 text-green-700 border-green-200" 
                            : "bg-gray-50 text-gray-500 border-gray-200"
                          }
                        >
                          {user.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {user.roles.length === 0 ? (
                            <span className="text-sm text-muted-foreground">Sem perfil</span>
                          ) : (
                            user.roles.map((role) => {
                              const roleInfo = ROLE_LABELS[role];
                              return (
                                <Badge 
                                  key={role} 
                                  variant="outline"
                                  className={`${roleInfo?.color || ""} gap-1`}
                                >
                                  {roleInfo?.label || role}
                                  <button
                                    onClick={() => handleRemoveRole(user.user_id, role)}
                                    className="ml-1 hover:text-destructive"
                                    title="Remover perfil"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </Badge>
                              );
                            })
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {getAvailableRoles(user).length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAddRoleDialog(user)}
                              className="gap-1"
                            >
                              <UserPlus className="w-3 h-3" />
                              Adicionar Perfil
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => setUserToDeactivate(user)}
                                className={user.ativo ? "text-amber-600" : "text-green-600"}
                              >
                                {user.ativo ? (
                                  <>
                                    <UserX className="mr-2 h-4 w-4" />
                                    Desativar
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    Reativar
                                  </>
                                )}
                              </DropdownMenuItem>
                              {user.email && (
                                <DropdownMenuItem 
                                  onClick={() => setUserToResetPassword(user)}
                                >
                                  <KeyRound className="mr-2 h-4 w-4" />
                                  Redefinir senha
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => setUserToDelete(user)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir permanentemente
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Role Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Perfil</DialogTitle>
            <DialogDescription>
              Selecione um perfil para adicionar ao usuário {selectedUser?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um perfil" />
              </SelectTrigger>
              <SelectContent>
                {selectedUser && getAvailableRoles(selectedUser).map((role) => {
                  const roleInfo = ROLE_LABELS[role];
                  return (
                    <SelectItem key={role} value={role}>
                      <span className="flex items-center gap-2">
                        {roleInfo?.label || role}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddRole} disabled={!selectedRole || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo usuário no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input
                id="nome"
                value={newUserForm.nome}
                onChange={(e) => setNewUserForm({ ...newUserForm, nome: e.target.value })}
                placeholder="Nome do usuário"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Perfil inicial</Label>
              <Select 
                value={newUserForm.role} 
                onValueChange={(value) => setNewUserForm({ ...newUserForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([role, info]) => (
                    <SelectItem key={role} value={role}>
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewUserForm({ nome: "", email: "", password: "", role: "vendedor" });
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate/Reactivate Confirmation Dialog */}
      <AlertDialog open={!!userToDeactivate} onOpenChange={(open) => !open && setUserToDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {userToDeactivate?.ativo ? "Desativar usuário?" : "Reativar usuário?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {userToDeactivate?.ativo 
                ? `O usuário "${userToDeactivate?.nome}" não poderá mais acessar o sistema. Você poderá reativá-lo a qualquer momento.`
                : `O usuário "${userToDeactivate?.nome}" poderá acessar o sistema novamente.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeactivating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleToggleActive} 
              disabled={isDeactivating}
              className={userToDeactivate?.ativo ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700"}
            >
              {isDeactivating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {userToDeactivate?.ativo ? "Desativar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Excluir usuário permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-destructive">Atenção: Esta ação é irreversível!</span>
              <br /><br />
              O usuário "{userToDelete?.nome}" será removido permanentemente do sistema, incluindo:
              <ul className="list-disc ml-4 mt-2">
                <li>Conta de acesso (login)</li>
                <li>Perfil e informações</li>
                <li>Todos os perfis/roles atribuídos</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser} 
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Confirmation Dialog */}
      <AlertDialog open={!!userToResetPassword} onOpenChange={(open) => !open && setUserToResetPassword(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Redefinir senha do usuário?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Um email de redefinição de senha será enviado para:
              <br />
              <span className="font-semibold text-foreground">{userToResetPassword?.email}</span>
              <br /><br />
              O usuário "{userToResetPassword?.nome}" receberá um link para criar uma nova senha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResettingPassword}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResetPassword} 
              disabled={isResettingPassword}
            >
              {isResettingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
