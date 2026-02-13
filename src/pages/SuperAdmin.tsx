import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, LogOut, Plus, Building2, Users, CreditCard, BarChart3 } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { PortalSwitcher } from "@/components/layout/PortalSwitcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Tenant {
  id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  plano: string;
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
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const has = data?.some((r) => r.role === "super_admin");
    setIsSuperAdmin(!!has);
    setChecking(false);
    if (has) loadAllData();
  };

  const loadAllData = async () => {
    setLoadingData(true);
    try {
      const [tenantsRes, subsRes, plansRes] = await Promise.all([
        supabase.from("tenants").select("*").order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("tenant_id, status, trial_ends_at, current_period_end, plans:plan_id(code, name)"),
        supabase.from("plans").select("id, code, name").eq("is_active", true).order("sort_order"),
      ]);

      setTenants(tenantsRes.data || []);
      setSubscriptions(subsRes.data as any[] || []);
      setPlans(plansRes.data || []);

      // Load metrics for each tenant
      const tenantIds = (tenantsRes.data || []).map((t) => t.id);
      const metricsMap: Record<string, TenantMetrics> = {};

      if (tenantIds.length > 0) {
        const [leadsRes, usersRes, clientesRes] = await Promise.all([
          supabase.from("leads").select("tenant_id", { count: "exact", head: false }).in("tenant_id", tenantIds),
          supabase.from("profiles").select("tenant_id", { count: "exact", head: false }).in("tenant_id", tenantIds),
          supabase.from("clientes").select("tenant_id", { count: "exact", head: false }).in("tenant_id", tenantIds),
        ]);

        for (const tid of tenantIds) {
          metricsMap[tid] = {
            tenant_id: tid,
            leads: (leadsRes.data || []).filter((l) => l.tenant_id === tid).length,
            users: (usersRes.data || []).filter((p) => p.tenant_id === tid).length,
            clientes: (clientesRes.data || []).filter((c) => c.tenant_id === tid).length,
          };
        }
      }
      setMetrics(metricsMap);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoadingData(false);
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

      const { data: session } = await supabase.auth.getSession();
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

  const toggleTenantStatus = async (tenant: Tenant) => {
    const { error } = await supabase
      .from("tenants")
      .update({ ativo: !tenant.ativo })
      .eq("id", tenant.id);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success(`Empresa ${!tenant.ativo ? "ativada" : "desativada"}`);
      loadAllData();
    }
  };

  const updateSubscriptionPlan = async (tenantId: string, planCode: string) => {
    const plan = plans.find((p) => p.code === planCode);
    if (!plan) return;

    const { error } = await supabase
      .from("subscriptions")
      .update({ plan_id: plan.id })
      .eq("tenant_id", tenantId);

    if (error) {
      toast.error("Erro ao alterar plano");
    } else {
      // Also update the tenants.plano column
      await supabase.from("tenants").update({ plano: planCode }).eq("id", tenantId);
      toast.success("Plano atualizado");
      loadAllData();
    }
  };

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

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    trialing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    past_due: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    canceled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const totalLeads = Object.values(metrics).reduce((s, m) => s + m.leads, 0);
  const totalUsers = Object.values(metrics).reduce((s, m) => s + m.users, 0);
  const totalClientes = Object.values(metrics).reduce((s, m) => s + m.clientes, 0);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary" />
          <h1 className="text-lg font-bold">Super Admin</h1>
          <Badge variant="outline" className="text-xs">SaaS Manager</Badge>
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
                <p className="text-2xl font-bold">{tenants.filter((t) => t.ativo).length}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tenants Table */}
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
                      <TableHead className="text-center">Clientes</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => {
                      const sub = getSubscription(tenant.id);
                      const m = getMetrics(tenant.id);
                      const subStatus = sub?.status || "sem assinatura";
                      const planName = (sub?.plans as any)?.name || tenant.plano;

                      return (
                        <TableRow key={tenant.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{tenant.nome}</p>
                              <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={tenant.plano}
                              onValueChange={(v) => updateSubscriptionPlan(tenant.id, v)}
                            >
                              <SelectTrigger className="h-8 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {plans.map((p) => (
                                  <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={tenant.ativo ? "default" : "destructive"} className="text-xs w-fit">
                                {tenant.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[subStatus] || "bg-muted text-muted-foreground"}`}>
                                {subStatus}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-medium">{m.leads}</TableCell>
                          <TableCell className="text-center font-medium">{m.users}</TableCell>
                          <TableCell className="text-center font-medium">{m.clientes}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(tenant.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={tenant.ativo ? "outline" : "default"}
                              size="sm"
                              onClick={() => toggleTenantStatus(tenant)}
                            >
                              {tenant.ativo ? "Desativar" : "Ativar"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {tenants.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
      </main>
    </div>
  );
}
