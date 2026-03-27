import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isEmailAlreadyRegisteredError, parseInvokeError } from "@/lib/supabaseFunctionError";
import { usePlanGuard } from "@/components/plan";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { EmailInput } from "@/components/ui/EmailInput";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { FormModalTemplate } from "@/components/ui-kit/FormModalTemplate";
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
  Users,
  ShieldCheck,
  ShieldAlert,
  Plus,
  MoreVertical,
  Pencil,
  UserCog,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { UserEditDialog } from "./users/UserEditDialog";

interface UserRole {
  id: string;
  user_id: string;
  role: "admin" | "gerente" | "consultor" | "instalador" | "financeiro";
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
  created_at?: string;
  last_sign_in_at?: string | null;
}

interface NewUserForm {
  nome: string;
  email: string;
  password: string;
  role: string;
  telefone: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  admin: { label: "Administrador", color: "bg-destructive/10 text-destructive border-destructive/20", icon: ShieldAlert },
  gerente: { label: "Gerente", color: "bg-warning/10 text-warning border-warning/20", icon: ShieldCheck },
  consultor: { label: "Consultor", color: "bg-info/10 text-info border-info/20", icon: Users },
  instalador: { label: "Instalador", color: "bg-success/10 text-success border-success/20", icon: Users },
  financeiro: { label: "Financeiro", color: "bg-primary/10 text-primary border-primary/20", icon: Users },
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
    telefone: "",
    password: "",
    role: "consultor",
  });
  const [userToEdit, setUserToEdit] = useState<UserWithRoles | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { guardLimit, LimitDialog } = usePlanGuard();

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

  // ⚠️ HARDENING: Realtime for cross-user sync on profiles/roles
  useEffect(() => {
    if (!canManageUsers) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchUsers(), 700);
    };

    const channel = supabase
      .channel('usuarios-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultores' }, refresh)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [canManageUsers]);

  const fetchUsers = async () => {
    try {
      // Parallel fetch: profiles, roles, and emails
      const [profilesRes, rolesRes, emailsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, nome, ativo, created_at").order("nome"),
        supabase.from("user_roles").select("id, user_id, role, created_at, created_by"),
        (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              return await supabase.functions.invoke("list-users-emails", {
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
            }
          } catch (e) {
            console.warn("Could not fetch user emails:", e);
          }
          return null;
        })(),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const profiles = profilesRes.data;
      const roles = rolesRes.data;
      const emailMap: Record<string, string> = emailsRes?.data?.emails || {};
      const lastSignInMap: Record<string, string | null> = emailsRes?.data?.last_sign_in || {};

      // Combine profiles with roles and emails
      const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => {
        return {
          ...profile,
          email: emailMap[profile.user_id] || undefined,
          last_sign_in_at: lastSignInMap[profile.user_id] ?? null,
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
        .eq("role", role as "admin" | "gerente" | "consultor" | "instalador" | "financeiro");

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
    // Plan limit guard
    const allowed = await guardLimit("max_users");
    if (!allowed) return;

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
          telefone: newUserForm.telefone || undefined,
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
      setNewUserForm({ nome: "", email: "", password: "", role: "consultor", telefone: "" });
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

  const openEditDialog = (u: UserWithRoles) => {
    setUserToEdit(u);
  };

  if (loading || checkingPermission) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-48" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!canManageUsers) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Shield} title="Gestão de Usuários" />
        <EmptyState
          icon={Shield}
          title="Acesso restrito"
          description="Somente administradores podem ver e alterar os perfis de outros usuários."
          action={{ label: "Voltar ao portal", onClick: () => navigate("/portal", { replace: true }) }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Gestão de Usuários"
        description="Gerencie usuários e seus perfis de acesso"
        actions={
          <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Usuário
          </Button>
        }
      />

      <SectionCard
        icon={Users}
        title="Usuários Cadastrados"
        variant="blue"
      >
        
          {users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum usuário encontrado"
              description="Crie um novo usuário para começar"
              action={{ label: "Novo Usuário", onClick: () => setIsCreateDialogOpen(true), icon: Plus }}
            />
          ) : (
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Nome</TableHead>
                    <TableHead className="font-semibold text-foreground">Email</TableHead>
                    <TableHead className="font-semibold text-foreground">Perfis</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-foreground">Criado em</TableHead>
                    <TableHead className="font-semibold text-foreground">Último login</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.user_id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">{user.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.email || "—"}
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
                                  <Button variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveRole(user.user_id, role)}
                                    className="ml-1 h-5 w-5 text-destructive hover:bg-destructive/10"
                                    title="Remover perfil"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </Badge>
                              );
                            })
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={user.ativo 
                            ? "bg-success/10 text-success border-success/20" 
                            : "bg-warning/10 text-warning border-warning/20"
                          }
                        >
                          {user.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {user.last_sign_in_at
                          ? new Date(user.last_sign_in_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
                          : "Nunca"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {getAvailableRoles(user).length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAddRoleDialog(user)}
                              className="gap-1.5"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
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
                              <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar / Gerenciar
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
      </SectionCard>

      {/* Add Role Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md">
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
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddRole} disabled={!selectedRole || saving}>
              {saving && <Spinner size="sm" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <FormModalTemplate
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) setNewUserForm({ nome: "", email: "", password: "", role: "consultor", telefone: "" });
        }}
        title="Criar Novo Usuário"
        icon={UserCog}
        subtitle="Cadastre ou edite um usuário do sistema"
        onSubmit={handleCreateUser}
        submitLabel="Criar Usuário"
        saving={saving}
        className="w-[90vw] max-w-md"
      >
            <p className="text-sm text-muted-foreground -mt-2">
              Preencha os dados para criar um novo usuário no sistema.
            </p>
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
              <EmailInput
                id="email"
                value={newUserForm.email}
                onChange={(v) => setNewUserForm({ ...newUserForm, email: v })}
                required
                blockDisposable
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
              <Label htmlFor="telefone">Telefone</Label>
              <PhoneInput
                value={newUserForm.telefone}
                onChange={(raw) => setNewUserForm({ ...newUserForm, telefone: raw })}
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
      </FormModalTemplate>

      {/* User Edit Dialog */}
      <UserEditDialog
        user={userToEdit}
        onClose={() => setUserToEdit(null)}
        onRefresh={fetchUsers}
        currentUserId={user?.id}
        onNavigateAway={() => navigate("/portal", { replace: true })}
      />

      {LimitDialog}
    </div>
  );
}
