import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callSuperAdminAction } from "@/lib/superAdminApi";
import {
  ArrowLeft, Building2, Users, BarChart3, Activity, History,
  KeyRound, Mail, UserCog, Shield, UserMinus, UserPlus, Crown, Edit,
  Ban, Lock, Trash2, RotateCcw, AlertTriangle,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const HEALTH_COLORS: Record<string, string> = {
  healthy: "bg-success/10 text-success",
  degraded: "bg-warning/10 text-warning",
  down: "bg-destructive/10 text-destructive",
  unknown: "bg-muted text-muted-foreground",
};

const ALL_ROLES = ["admin", "gerente", "financeiro", "vendedor", "instalador"];

interface Props {
  tenantId: string;
  onBack: () => void;
}

export function SuperAdminTenantDetail({ tenantId, onBack }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ nome: "", documento: "", dominio_customizado: "", plano: "" });
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);

  // User management dialogs
  const [emailTarget, setEmailTarget] = useState<any>(null);
  const [newEmail, setNewEmail] = useState("");
  const [ownerTarget, setOwnerTarget] = useState<any>(null);
  const [passwordTarget, setPasswordTarget] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [banTarget, setBanTarget] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rpcRes, plansRes] = await Promise.all([
        supabase.rpc("get_super_admin_tenant_detail", { _tenant_id: tenantId }),
        plans.length ? Promise.resolve({ data: plans }) : supabase.from("plans").select("id, code, name").eq("is_active", true).order("sort_order"),
      ]);
      if (rpcRes.error) throw rpcRes.error;
      setData(rpcRes.data);
      if (!plans.length && plansRes.data) setPlans(plansRes.data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
        <div className="p-12 text-center"><Spinner size="md" /></div>
      </div>
    );
  }

  const tenant = data.tenant;
  const metrics = data.metrics;
  const sub = data.subscription;
  const health = data.integration_health || [];
  const audit = data.recent_audit || [];
  const users = data.users || [];

  const openEdit = () => {
    setEditForm({
      nome: tenant.nome || "",
      documento: tenant.documento || "",
      dominio_customizado: tenant.dominio_customizado || "",
      plano: tenant.plano || "",
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await callSuperAdminAction({ action: "edit_tenant", tenant_id: tenantId, ...editForm });
      toast.success("Tenant atualizado");
      setEditOpen(false);
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const runAction = async (actionName: string, payload: any, successMsg: string) => {
    setActionLoading(actionName);
    try {
      const res = await callSuperAdminAction(payload);
      toast.success(successMsg);
      if (res.recovery_link) {
        await navigator.clipboard.writeText(res.recovery_link);
        toast.info("Link de recuperação copiado para o clipboard");
      }
      load();
      return res;
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePasswordReset = (userId: string) =>
    runAction("reset_" + userId, { action: "force_password_reset", target_user_id: userId }, "Link de reset gerado");

  const handleToggleUser = (userId: string, currentActive: boolean) =>
    runAction("toggle_" + userId, {
      action: "toggle_user_active", target_user_id: userId, new_active: !currentActive,
    }, currentActive ? "Usuário desativado" : "Usuário ativado");

  const handleChangeEmail = async () => {
    if (!emailTarget || !newEmail) return;
    await runAction("email", {
      action: "change_owner_email", target_user_id: emailTarget.user_id,
      tenant_id: tenantId, new_email: newEmail,
    }, "Email atualizado");
    setEmailTarget(null); setNewEmail("");
  };

  const handleTransferOwnership = async () => {
    if (!ownerTarget) return;
    await runAction("ownership", {
      action: "transfer_ownership", tenant_id: tenantId, target_user_id: ownerTarget.user_id,
    }, "Ownership transferido");
    setOwnerTarget(null);
  };

  const handleToggleRole = (userId: string, role: string, hasRole: boolean) =>
    runAction("role_" + userId + role, {
      action: "update_user_role", target_user_id: userId, tenant_id: tenantId,
      new_role: role, remove_role: hasRole,
    }, hasRole ? `Role ${role} removida` : `Role ${role} adicionada`);

  const handleSetPassword = async () => {
    if (!passwordTarget || !newPassword || newPassword.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres");
      return;
    }
    await runAction("setpw", {
      action: "set_password", target_user_id: passwordTarget.user_id, new_password: newPassword,
    }, "Senha redefinida com sucesso");
    setPasswordTarget(null); setNewPassword("");
  };

  const handleBanUser = async () => {
    if (!banTarget) return;
    await runAction("ban", {
      action: "ban_user", target_user_id: banTarget.user_id,
    }, "Usuário banido");
    setBanTarget(null);
  };

  const handleUnbanUser = (userId: string) =>
    runAction("unban_" + userId, { action: "unban_user", target_user_id: userId }, "Usuário desbanido");

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    await runAction("delete", {
      action: "delete_user_permanently", target_user_id: deleteTarget.user_id,
    }, "Usuário excluído permanentemente");
    setDeleteTarget(null);
  };

  const isDeleted = !!tenant.deleted_at;
  const statusLabel = isDeleted ? "Excluído" : tenant.status;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {tenant.nome}
          </h2>
          <p className="text-sm text-muted-foreground">{tenant.slug} • {tenant.id}</p>
          {tenant.documento && <p className="text-sm text-muted-foreground">Doc: {tenant.documento}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{statusLabel}</Badge>
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Edit className="w-4 h-4 mr-1" /> Editar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="users">Usuários ({users.length})</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Leads", value: metrics.leads_count },
              { label: "Clientes", value: metrics.clientes_count },
              { label: "Usuários", value: metrics.users_count },
              { label: "Projetos", value: metrics.projetos_count },
              { label: "Instâncias WA", value: metrics.wa_instances_count },
              { label: "Conversas", value: metrics.conversas_count },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Informações</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{statusLabel}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Plano</span><span>{sub?.plan_name || tenant.plano}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Owner</span><span className="truncate max-w-[180px]">{data.owner_email || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Domínio</span><span>{tenant.dominio_customizado || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Criado</span><span>{format(new Date(tenant.created_at), "dd/MM/yyyy", { locale: ptBR })}</span></div>
                {sub && (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Assinatura</span><span>{sub.status}</span></div>
                    {sub.trial_ends_at && <div className="flex justify-between"><span className="text-muted-foreground">Trial até</span><span>{format(new Date(sub.trial_ends_at), "dd/MM/yyyy")}</span></div>}
                  </>
                )}
                {isDeleted && (
                  <>
                    <div className="flex justify-between text-destructive"><span>Excluído em</span><span>{format(new Date(tenant.deleted_at), "dd/MM/yyyy HH:mm")}</span></div>
                    {tenant.deleted_reason && <div className="flex justify-between"><span className="text-muted-foreground">Motivo</span><span>{tenant.deleted_reason}</span></div>}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Activity className="w-4 h-4" /> Saúde Integrações</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {health.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma integração verificada</p>
                ) : (
                  health.map((h: any) => (
                    <div key={h.service_key} className="flex items-center justify-between text-sm">
                      <span>{h.service_key}</span>
                      <Badge variant="outline" className={`text-xs ${HEALTH_COLORS[h.status] || HEALTH_COLORS.unknown}`}>
                        {h.status}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users - Enhanced */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" /> Gestão de Usuários do Tenant
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u: any) => {
                      const userRoles: string[] = u.roles || [];
                      const isOwner = u.user_id === tenant.owner_user_id;
                      return (
                        <TableRow key={u.user_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm flex items-center gap-1.5">
                                {u.nome || "Sem nome"}
                                {isOwner && (
                                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                    <Crown className="w-3 h-3 mr-1" /> Owner
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">{u.email || "—"}</p>
                              {u.telefone && <p className="text-xs text-muted-foreground">{u.telefone}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap max-w-[220px]">
                              {ALL_ROLES.map(role => {
                                const has = userRoles.includes(role);
                                return (
                                  <button
                                    key={role}
                                    onClick={() => handleToggleRole(u.user_id, role, has)}
                                    disabled={!!actionLoading}
                                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                                      has
                                        ? "bg-primary/10 text-primary border-primary/20 font-medium"
                                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                                    }`}
                                  >
                                    {role}
                                  </button>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.ativo ? "default" : "destructive"} className="text-xs">
                              {u.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {u.created_at ? format(new Date(u.created_at), "dd/MM/yy", { locale: ptBR }) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end flex-wrap">
                              {/* Change Email */}
                              <Button variant="ghost" size="sm" title="Alterar email"
                                disabled={!!actionLoading}
                                onClick={() => { setEmailTarget(u); setNewEmail(u.email || ""); }}>
                                <Mail className="w-4 h-4" />
                              </Button>
                              {/* Reset Password (generate link) */}
                              <Button variant="ghost" size="sm" title="Gerar link de reset de senha"
                                disabled={!!actionLoading}
                                onClick={() => handlePasswordReset(u.user_id)}>
                                <KeyRound className="w-4 h-4" />
                              </Button>
                              {/* Set Password directly */}
                              <Button variant="ghost" size="sm" title="Redefinir senha manualmente"
                                disabled={!!actionLoading}
                                onClick={() => { setPasswordTarget(u); setNewPassword(""); }}>
                                <Lock className="w-4 h-4" />
                              </Button>
                              {/* Toggle Active */}
                              <Button variant="ghost" size="sm"
                                title={u.ativo ? "Desativar acesso" : "Reativar acesso"}
                                disabled={!!actionLoading}
                                onClick={() => handleToggleUser(u.user_id, u.ativo)}>
                                {u.ativo ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                              </Button>
                              {/* Ban User */}
                              <Button variant="ghost" size="sm" title="Banir usuário (bloquear login)"
                                disabled={!!actionLoading}
                                className="text-warning hover:text-warning"
                                onClick={() => setBanTarget(u)}>
                                <Ban className="w-4 h-4" />
                              </Button>
                              {/* Transfer Ownership */}
                              {!isOwner && (
                                <Button variant="ghost" size="sm" title="Transferir ownership"
                                  disabled={!!actionLoading}
                                  onClick={() => setOwnerTarget(u)}>
                                  <Crown className="w-4 h-4" />
                                </Button>
                              )}
                              {/* Delete permanently */}
                              {!isOwner && (
                                <Button variant="ghost" size="sm" title="Excluir permanentemente"
                                  disabled={!!actionLoading}
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(u)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {users.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum usuário</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Action Legend */}
          <Card>
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Legenda das ações:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> Trocar email</span>
                <span className="flex items-center gap-1"><KeyRound className="w-3 h-3" /> Link de reset</span>
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Redefinir senha</span>
                <span className="flex items-center gap-1"><UserMinus className="w-3 h-3" /> Desativar/Ativar</span>
                <span className="flex items-center gap-1"><Ban className="w-3 h-3" /> Banir (bloquear login)</span>
                <span className="flex items-center gap-1"><Crown className="w-3 h-3" /> Transferir ownership</span>
                <span className="flex items-center gap-1"><Trash2 className="w-3 h-3" /> Excluir permanente</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations">
          <Card>
            <CardContent className="p-4">
              {health.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma integração verificada para este tenant.</p>
              ) : (
                <div className="space-y-3">
                  {health.map((h: any) => (
                    <div key={h.service_key} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{h.service_key}</p>
                        {h.error_message && <p className="text-xs text-muted-foreground mt-1">{h.error_message}</p>}
                        {h.last_checked_at && (
                          <p className="text-xs text-muted-foreground">
                            Última verificação: {format(new Date(h.last_checked_at), "dd/MM HH:mm")}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className={`${HEALTH_COLORS[h.status] || HEALTH_COLORS.unknown}`}>
                        {h.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit">
          <Card>
            <CardContent className="p-0">
              {audit.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground text-center">Nenhuma ação registrada para este tenant</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Detalhes</TableHead>
                        <TableHead>IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(a.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{a.action}</Badge></TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">
                            {a.details?.reason || a.details?.new_email || a.details?.role || JSON.stringify(a.details)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{a.ip_address || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Tenant Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Tenant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={editForm.nome} onChange={(e) => setEditForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div><Label>Documento (CNPJ/CPF)</Label><Input value={editForm.documento} onChange={(e) => setEditForm(f => ({ ...f, documento: e.target.value }))} /></div>
            <div><Label>Domínio Customizado</Label><Input value={editForm.dominio_customizado} onChange={(e) => setEditForm(f => ({ ...f, dominio_customizado: e.target.value }))} /></div>
            <div>
              <Label>Plano</Label>
              <Select value={editForm.plano} onValueChange={(v) => setEditForm(f => ({ ...f, plano: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {plans.map(p => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Email Dialog */}
      <Dialog open={!!emailTarget} onOpenChange={(o) => !o && setEmailTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Email</DialogTitle>
            <DialogDescription>Usuário: {emailTarget?.nome || emailTarget?.email}</DialogDescription>
          </DialogHeader>
          <div><Label>Novo Email</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailTarget(null)}>Cancelar</Button>
            <Button onClick={handleChangeEmail} disabled={!!actionLoading}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog open={!!passwordTarget} onOpenChange={(o) => !o && setPasswordTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Definir nova senha para: <strong>{passwordTarget?.nome}</strong> ({passwordTarget?.email})
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Nova Senha (mín. 6 caracteres)</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova senha..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordTarget(null)}>Cancelar</Button>
            <Button onClick={handleSetPassword} disabled={!!actionLoading || newPassword.length < 6}>
              Redefinir Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban User Dialog */}
      <Dialog open={!!banTarget} onOpenChange={(o) => !o && setBanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-5 h-5" /> Banir Usuário
            </DialogTitle>
            <DialogDescription>
              Banir <strong>{banTarget?.nome}</strong> ({banTarget?.email})?
              Isso bloqueia completamente o login do usuário no Supabase Auth e desativa o perfil.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBanUser} disabled={!!actionLoading}>
              Confirmar Ban
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog open={!!ownerTarget} onOpenChange={(o) => !o && setOwnerTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Ownership</DialogTitle>
            <DialogDescription>
              Transferir a propriedade do tenant para <strong>{ownerTarget?.nome}</strong> ({ownerTarget?.email})?
              O novo owner receberá automaticamente a role admin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOwnerTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleTransferOwnership} disabled={!!actionLoading}>Confirmar Transferência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Excluir Usuário Permanentemente
            </DialogTitle>
            <DialogDescription>
              Excluir <strong>{deleteTarget?.nome}</strong> ({deleteTarget?.email}) permanentemente?
              Esta ação remove o usuário do Supabase Auth, desativa o perfil e libera todas as conversas atribuídas.
              <strong className="block mt-2 text-destructive">Esta ação NÃO pode ser desfeita.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={!!actionLoading}>
              Excluir Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}