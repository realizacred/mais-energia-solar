import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldAlert, LogOut, Plus, Building2, Users, CreditCard, BarChart3,
  Pause, Play, Ban, History, UserCog, KeyRound, Mail,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { PortalSwitcher } from "@/components/layout/PortalSwitcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogClose, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ──

interface Tenant {
  id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  status: "active" | "suspended" | "disabled" | "pending";
  plano: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  owner_user_id: string | null;
  created_at: string;
}

interface Subscription {
  tenant_id: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string;
  plans: { code: string; name: string } | null;
}

interface TenantMetrics {
  tenant_id: string;
  leads: number;
  users: number;
  clientes: number;
}

interface AuditAction {
  id: string;
  admin_user_id: string;
  action: string;
  target_tenant_id: string | null;
  target_user_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
}

// ── Helpers ──

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Play }> = {
  active: { label: "Ativo", color: "bg-success/10 text-success border-success/20", icon: Play },
  suspended: { label: "Suspenso", color: "bg-warning/10 text-warning border-warning/20", icon: Pause },
  disabled: { label: "Desativado", color: "bg-destructive/10 text-destructive border-destructive/20", icon: Ban },
  pending: { label: "Pendente", color: "bg-muted text-muted-foreground", icon: History },
};

async function callSuperAdminAction(body: Record<string, any>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-action`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// ── Main Component ──

export default function SuperAdmin() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [metrics, setMetrics] = useState<Record<string, TenantMetrics>>({});
  const [plans, setPlans] = useState<{ id: string; code: string; name: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditAction[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Suspend dialog
  const [suspendTarget, setSuspendTarget] = useState<Tenant | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspending, setSuspending] = useState(false);

  // Tenant users dialog
  const [usersTarget, setUsersTarget] = useState<Tenant | null>(null);
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // New tenant form
  const [form, setForm] = useState({
    nome_empresa: "",
    slug: "",
    plano_code: "starter",
    admin_email: "",
    admin_password: "",
    admin_nome: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?from=super-admin", { replace: true });
      return;
    }
    if (user) checkSuperAdmin();
  }, [user, authLoading]);

  const checkSuperAdmin = async () => {
    if (!user) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const has = data?.some((r) => r.role === "super_admin");
    setIsSuperAdmin(!!has);
    setChecking(false);
    if (has) loadAllData();
  };

  const loadAllData = useCallback(async () => {
    setLoadingData(true);
    try {
      // G8: Use server-side RPC instead of N+1 client-side queries
      const [rpcRes, plansRes] = await Promise.all([
        supabase.rpc("get_super_admin_metrics", { _limit: 200 }),
        supabase.from("plans").select("id, code, name").eq("is_active", true).order("sort_order"),
      ]);

      if (rpcRes.error) throw rpcRes.error;
      const rpcData = rpcRes.data as any;

      const tenantsList = (rpcData?.tenants || []).map((t: any) => ({
        id: t.id, nome: t.nome, slug: t.slug, ativo: t.ativo,
        status: t.status, plano: t.plano, suspended_at: t.suspended_at,
        suspended_reason: t.suspended_reason, owner_user_id: t.owner_user_id,
        created_at: t.created_at,
      }));
      setTenants(tenantsList);
      setPlans(plansRes.data || []);

      // Build subscriptions from RPC data
      setSubscriptions((rpcData?.tenants || []).filter((t: any) => t.subscription_status).map((t: any) => ({
        tenant_id: t.id, status: t.subscription_status,
        trial_ends_at: t.trial_ends_at, current_period_end: t.current_period_end,
        plans: t.plan_code ? { code: t.plan_code, name: t.plan_name } : null,
      })));

      // Build metrics from RPC data (already aggregated server-side)
      const metricsMap: Record<string, TenantMetrics> = {};
      for (const t of rpcData?.tenants || []) {
        metricsMap[t.id] = { tenant_id: t.id, leads: t.leads_count || 0, users: t.users_count || 0, clientes: t.clientes_count || 0 };
      }
      setMetrics(metricsMap);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoadingData(false);
    }
  }, []);

  const loadAuditLog = async () => {
    setLoadingAudit(true);
    try {
      const data = await callSuperAdminAction({ action: "get_audit_log" });
      setAuditLog(data.actions || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleCreate = async () => {
    if (!form.nome_empresa || !form.admin_email || !form.admin_password) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (form.admin_password.length < 6) {
      toast.error("Senha deve ter ao menos 6 caracteres");
      return;
    }

    setCreating(true);
    try {
      const slug = form.slug || form.nome_empresa.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const res = await supabase.functions.invoke("create-tenant", {
        body: { ...form, slug },
      });

      if (res.error || !res.data?.success) {
        throw new Error(res.data?.error || res.error?.message || "Erro desconhecido");
      }

      toast.success(res.data.message);
      setCreateOpen(false);
      setForm({ nome_empresa: "", slug: "", plano_code: "starter", admin_email: "", admin_password: "", admin_nome: "" });
      loadAllData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    setSuspending(true);
    try {
      await callSuperAdminAction({
        action: "suspend_tenant",
        tenant_id: suspendTarget.id,
        reason: suspendReason,
      });
      toast.success("Empresa suspensa com sucesso");
      setSuspendTarget(null);
      setSuspendReason("");
      loadAllData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSuspending(false);
    }
  };

  const handleReactivate = async (tenant: Tenant) => {
    try {
      await callSuperAdminAction({ action: "reactivate_tenant", tenant_id: tenant.id });
      toast.success("Empresa reativada");
      loadAllData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDisable = async (tenant: Tenant) => {
    try {
      await callSuperAdminAction({
        action: "disable_tenant",
        tenant_id: tenant.id,
        reason: "Desativação pelo super admin",
      });
      toast.success("Empresa desativada");
      loadAllData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleForcePasswordReset = async (targetUserId: string) => {
    try {
      const data = await callSuperAdminAction({
        action: "force_password_reset",
        target_user_id: targetUserId,
      });
      if (data.recovery_link) {
        await navigator.clipboard.writeText(data.recovery_link);
        toast.success("Link de recuperação copiado para a área de transferência");
      } else {
        toast.success("Reset enviado");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const loadTenantUsers = async (tenant: Tenant) => {
    setUsersTarget(tenant);
    setLoadingUsers(true);
    try {
      const data = await callSuperAdminAction({ action: "get_tenant_users", tenant_id: tenant.id });
      setTenantUsers(data.users || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const updateSubscriptionPlan = async (tenantId: string, planCode: string) => {
    const plan = plans.find((p) => p.code === planCode);
    if (!plan) return;
    const { error } = await supabase.from("subscriptions").update({ plan_id: plan.id }).eq("tenant_id", tenantId);
    if (error) {
      toast.error("Erro ao alterar plano");
    } else {
      await supabase.from("tenants").update({ plano: planCode }).eq("id", tenantId);
      toast.success("Plano atualizado");
      loadAllData();
    }
  };

  // ── Guards ──

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Spinner size="md" />
          <p className="text-sm text-muted-foreground">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md border-destructive/20">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <ShieldAlert className="w-10 h-10 text-destructive" />
            <h2 className="text-xl font-semibold">Acesso Restrito</h2>
            <p className="text-sm text-muted-foreground text-center">
              Apenas Super Admins podem acessar esta área.
            </p>
            <Button onClick={() => navigate("/admin")} variant="outline">Voltar ao Admin</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getSubscription = (tenantId: string) => subscriptions.find((s) => s.tenant_id === tenantId);
  const getMetrics = (tenantId: string) => metrics[tenantId] || { leads: 0, users: 0, clientes: 0 };

  const totalLeads = Object.values(metrics).reduce((s, m) => s + m.leads, 0);
  const totalUsers = Object.values(metrics).reduce((s, m) => s + m.users, 0);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary" />
          <h1 className="text-lg font-bold">Super Admin</h1>
          <Badge variant="outline" className="text-xs">Platform Governance</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
          <PortalSwitcher />
          <Button variant="ghost" size="icon" onClick={() => signOut()}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Building2 className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{tenants.length}</p>
                <p className="text-xs text-muted-foreground">Empresas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="w-8 h-8 text-primary/80" />
              <div>
                <p className="text-2xl font-bold">{totalUsers}</p>
                <p className="text-xs text-muted-foreground">Usuários</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-accent-foreground" />
              <div>
                <p className="text-2xl font-bold">{totalLeads}</p>
                <p className="text-xs text-muted-foreground">Leads Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-secondary-foreground" />
              <div>
                <p className="text-2xl font-bold">{tenants.filter((t) => t.status === "active").length}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tenants">
          <TabsList>
            <TabsTrigger value="tenants">Empresas</TabsTrigger>
            <TabsTrigger value="audit" onClick={loadAuditLog}>Audit Log</TabsTrigger>
          </TabsList>

          {/* ── Tenants Tab ── */}
          <TabsContent value="tenants">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Empresas Cadastradas</CardTitle>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Empresa</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Criar Nova Empresa</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Nome da Empresa *</Label>
                        <Input value={form.nome_empresa} onChange={(e) => setForm((f) => ({ ...f, nome_empresa: e.target.value }))} placeholder="Ex: Solar Tech" />
                      </div>
                      <div>
                        <Label>Slug (URL)</Label>
                        <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="auto-gerado se vazio" />
                      </div>
                      <div>
                        <Label>Plano</Label>
                        <Select value={form.plano_code} onValueChange={(v) => setForm((f) => ({ ...f, plano_code: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {plans.map((p) => (
                              <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium mb-2">Admin Inicial</p>
                        <div className="space-y-3">
                          <div>
                            <Label>Nome</Label>
                            <Input value={form.admin_nome} onChange={(e) => setForm((f) => ({ ...f, admin_nome: e.target.value }))} placeholder="Nome do admin" />
                          </div>
                          <div>
                            <Label>Email *</Label>
                            <Input type="email" value={form.admin_email} onChange={(e) => setForm((f) => ({ ...f, admin_email: e.target.value }))} placeholder="admin@empresa.com" />
                          </div>
                          <div>
                            <Label>Senha *</Label>
                            <Input type="password" value={form.admin_password} onChange={(e) => setForm((f) => ({ ...f, admin_password: e.target.value }))} placeholder="Min 6 caracteres" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancelar</Button>
                      </DialogClose>
                      <Button onClick={handleCreate} disabled={creating}>
                        {creating ? "Criando..." : "Criar Empresa"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                {loadingData ? (
                  <div className="p-8 text-center text-muted-foreground">Carregando...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Leads</TableHead>
                          <TableHead className="text-center">Usuários</TableHead>
                          <TableHead>Criado em</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tenants.map((tenant) => {
                          const sub = getSubscription(tenant.id);
                          const m = getMetrics(tenant.id);
                          const planName = (sub?.plans as any)?.name || tenant.plano;
                          const sc = STATUS_CONFIG[tenant.status] || STATUS_CONFIG.pending;

                          return (
                            <TableRow key={tenant.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{tenant.nome}</p>
                                  <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Select value={tenant.plano} onValueChange={(v) => updateSubscriptionPlan(tenant.id, v)}>
                                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {plans.map((p) => (
                                      <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${sc.color}`}>
                                  {sc.label}
                                </Badge>
                                {tenant.suspended_reason && tenant.status !== "active" && (
                                  <p className="text-xs text-muted-foreground mt-1 max-w-[150px] truncate" title={tenant.suspended_reason}>
                                    {tenant.suspended_reason}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="text-center font-medium">{m.leads}</TableCell>
                              <TableCell className="text-center font-medium">{m.users}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {format(new Date(tenant.created_at), "dd/MM/yyyy", { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end flex-wrap">
                                  {/* View Users */}
                                  <Button variant="ghost" size="sm" title="Ver usuários" onClick={() => loadTenantUsers(tenant)}>
                                    <UserCog className="w-4 h-4" />
                                  </Button>

                                  {/* Status actions */}
                                  {tenant.status === "active" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-warning border-warning/30"
                                      onClick={() => setSuspendTarget(tenant)}
                                    >
                                      <Pause className="w-4 h-4 mr-1" /> Suspender
                                    </Button>
                                  )}
                                  {tenant.status === "suspended" && (
                                    <>
                                      <Button variant="outline" size="sm" className="text-success border-success/30" onClick={() => handleReactivate(tenant)}>
                                        <Play className="w-4 h-4 mr-1" /> Reativar
                                      </Button>
                                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30" onClick={() => handleDisable(tenant)}>
                                        <Ban className="w-4 h-4 mr-1" /> Desativar
                                      </Button>
                                    </>
                                  )}
                                  {tenant.status === "disabled" && (
                                    <Button variant="outline" size="sm" className="text-success border-success/30" onClick={() => handleReactivate(tenant)}>
                                      <Play className="w-4 h-4 mr-1" /> Reativar
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {tenants.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              Nenhuma empresa cadastrada
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Audit Log Tab ── */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Audit Log — Ações do Super Admin
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingAudit ? (
                  <div className="p-8 text-center"><Spinner size="sm" /></div>
                ) : auditLog.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma ação registrada</div>
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
                        {auditLog.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="text-sm whitespace-nowrap">
                              {format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{a.action}</Badge>
                            </TableCell>
                            <TableCell className="text-sm max-w-xs truncate">
                              {a.details?.reason || a.details?.new_email || JSON.stringify(a.details)}
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
      </main>

      {/* ── Suspend Dialog ── */}
      <Dialog open={!!suspendTarget} onOpenChange={(o) => !o && setSuspendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender Empresa</DialogTitle>
            <DialogDescription>
              A empresa <strong>{suspendTarget?.nome}</strong> será suspensa. Todos os usuários perderão acesso imediatamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo da suspensão</Label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Descreva o motivo..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleSuspend} disabled={suspending}>
              {suspending ? "Suspendendo..." : "Confirmar Suspensão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Tenant Users Dialog ── */}
      <Dialog open={!!usersTarget} onOpenChange={(o) => !o && setUsersTarget(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Usuários — {usersTarget?.nome}</DialogTitle>
          </DialogHeader>
          {loadingUsers ? (
            <div className="py-8 text-center"><Spinner size="sm" /></div>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantUsers.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.nome || "—"}</TableCell>
                      <TableCell className="text-sm">{u.email || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(u.roles || []).map((r: string) => (
                            <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.ativo ? "default" : "destructive"} className="text-xs">
                          {u.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Forçar reset de senha"
                          onClick={() => handleForcePasswordReset(u.user_id)}
                        >
                          <KeyRound className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {tenantUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
