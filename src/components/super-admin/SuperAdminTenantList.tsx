import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callSuperAdminAction } from "@/lib/superAdminApi";
import {
  Plus, Building2, Users, Pause, Play, Ban,
  ChevronLeft, ChevronRight, Trash2, Eye,
} from "lucide-react";
import {
  PageHeader, StatCard, SectionCard, SearchInput,
  StatusBadge, EmptyState, LoadingState,
} from "@/components/ui-kit";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  active: "success",
  suspended: "warning",
  disabled: "destructive",
  pending: "muted",
};

const PAGE_SIZE = 20;

interface Props {
  onSelectTenant: (id: string) => void;
}

export function SuperAdminTenantList({ onSelectTenant }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [plans, setPlans] = useState<{ id: string; code: string; name: string }[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<any>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    nome_empresa: "", slug: "", plano_code: "starter",
    admin_email: "", admin_password: "", admin_nome: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rpcRes, plansRes] = await Promise.all([
        supabase.rpc("get_super_admin_metrics", {
          _status_filter: statusFilter === "all" ? null : statusFilter,
          _search: search.trim() || null,
          _offset: page * PAGE_SIZE,
          _limit: PAGE_SIZE,
        }),
        plans.length ? Promise.resolve({ data: plans }) : supabase.from("plans").select("id, code, name").eq("is_active", true).order("sort_order"),
      ]);

      if (rpcRes.error) throw rpcRes.error;
      setData(rpcRes.data);
      if (!plans.length && plansRes.data) setPlans(plansRes.data as any);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const tenants = data?.tenants || [];
  const totals = data?.totals || {};
  const filteredCount = data?.filtered_count || 0;
  const totalPages = Math.ceil(filteredCount / PAGE_SIZE);

  const handleCreate = async () => {
    if (!form.nome_empresa || !form.admin_email || !form.admin_password) {
      toast.error("Preencha campos obrigatórios");
      return;
    }
    setCreating(true);
    try {
      const slug = form.slug || form.nome_empresa.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const res = await supabase.functions.invoke("create-tenant", { body: { ...form, slug } });
      if (res.error || !res.data?.success) throw new Error(res.data?.error || res.error?.message || "Erro");
      toast.success(res.data.message);
      setCreateOpen(false);
      setForm({ nome_empresa: "", slug: "", plano_code: "starter", admin_email: "", admin_password: "", admin_nome: "" });
      loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    setSuspending(true);
    try {
      await callSuperAdminAction({ action: "suspend_tenant", tenant_id: suspendTarget.id, reason: suspendReason });
      toast.success("Empresa suspensa");
      setSuspendTarget(null); setSuspendReason("");
      loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSuspending(false); }
  };

  const handleReactivate = async (t: any) => {
    try {
      await callSuperAdminAction({ action: "reactivate_tenant", tenant_id: t.id });
      toast.success("Empresa reativada");
      loadData();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDisable = async (t: any) => {
    try {
      await callSuperAdminAction({ action: "disable_tenant", tenant_id: t.id, reason: "Desativação pelo super admin" });
      toast.success("Empresa desativada");
      loadData();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSoftDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await callSuperAdminAction({ action: "soft_delete_tenant", tenant_id: deleteTarget.id, reason: deleteReason });
      toast.success("Empresa marcada para exclusão");
      setDeleteTarget(null); setDeleteReason("");
      loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      {/* Stats — usando StatCard do Design System */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={Building2} label="Total" value={totals.total_tenants || 0} color="primary" />
        <StatCard icon={Play} label="Ativos" value={totals.active_tenants || 0} color="success" />
        <StatCard icon={Pause} label="Suspensos" value={totals.suspended_tenants || 0} color="warning" />
        <StatCard icon={Ban} label="Desativados" value={totals.disabled_tenants || 0} color="destructive" />
        <StatCard icon={Trash2} label="Excluídos" value={totals.deleted_tenants || 0} color="muted" />
      </div>

      {/* Filters + Table — usando SectionCard */}
      <SectionCard
        icon={Building2}
        title="Empresas"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Buscar nome, slug, CNPJ..."
            />
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="suspended">Suspensos</SelectItem>
                <SelectItem value="disabled">Desativados</SelectItem>
                <SelectItem value="deleted">Excluídos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Empresa</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Criar Nova Empresa</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome *</Label>
                    <Input value={form.nome_empresa} onChange={(e) => setForm(f => ({ ...f, nome_empresa: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="auto-gerado" />
                  </div>
                  <div>
                    <Label>Plano</Label>
                    <Select value={form.plano_code} onValueChange={(v) => setForm(f => ({ ...f, plano_code: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {plans.map(p => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-sm font-medium">Admin Inicial</p>
                    <div><Label>Nome</Label><Input value={form.admin_nome} onChange={(e) => setForm(f => ({ ...f, admin_nome: e.target.value }))} /></div>
                    <div><Label>Email *</Label><Input type="email" value={form.admin_email} onChange={(e) => setForm(f => ({ ...f, admin_email: e.target.value }))} /></div>
                    <div><Label>Senha *</Label><Input type="password" value={form.admin_password} onChange={(e) => setForm(f => ({ ...f, admin_password: e.target.value }))} /></div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button onClick={handleCreate} disabled={creating}>{creating ? "Criando..." : "Criar"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
        noPadding
      >
        {loading ? (
          <LoadingState message="Carregando empresas..." />
        ) : tenants.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhuma empresa encontrada"
            description="Tente ajustar os filtros ou crie uma nova empresa"
            action={{ label: "Nova Empresa", onClick: () => setCreateOpen(true), icon: Plus }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Leads</TableHead>
                    <TableHead className="text-center">Usuários</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t: any) => {
                    const isDeleted = !!t.deleted_at;
                    const variant = isDeleted ? "destructive" as const : (STATUS_VARIANT[t.status] || "muted" as const);
                    const statusLabel = isDeleted ? "Excluído" : ({ active: "Ativo", suspended: "Suspenso", disabled: "Desativado", pending: "Pendente" }[t.status] || t.status);
                    return (
                      <TableRow key={t.id} className={isDeleted ? "opacity-60" : ""}>
                        <TableCell>
                          <button onClick={() => onSelectTenant(t.id)} className="text-left hover:underline">
                            <p className="font-medium">{t.nome}</p>
                            <p className="text-xs text-muted-foreground">{t.slug}</p>
                            {t.documento && <p className="text-xs text-muted-foreground">{t.documento}</p>}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{t.plan_name || t.plano}</Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={variant} dot>{statusLabel}</StatusBadge>
                          {t.suspended_reason && t.status !== "active" && (
                            <p className="text-xs text-muted-foreground mt-1 max-w-[120px] truncate" title={t.suspended_reason}>
                              {t.suspended_reason}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{t.leads_count}</TableCell>
                        <TableCell className="text-center">{t.users_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate" title={t.owner_email}>
                          {t.owner_email || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(t.created_at), "dd/MM/yy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end flex-wrap">
                            <Button variant="ghost" size="sm" onClick={() => onSelectTenant(t.id)} title="Detalhes">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {!isDeleted && t.status === "active" && (
                              <Button variant="outline" size="sm" className="text-warning border-warning/30 text-xs h-7"
                                onClick={() => setSuspendTarget(t)}>
                                Suspender
                              </Button>
                            )}
                            {!isDeleted && t.status === "suspended" && (
                              <>
                                <Button variant="outline" size="sm" className="text-success border-success/30 text-xs h-7"
                                  onClick={() => handleReactivate(t)}>Reativar</Button>
                                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 text-xs h-7"
                                  onClick={() => handleDisable(t)}>Desativar</Button>
                              </>
                            )}
                            {!isDeleted && t.status === "disabled" && (
                              <>
                                <Button variant="outline" size="sm" className="text-success border-success/30 text-xs h-7"
                                  onClick={() => handleReactivate(t)}>Reativar</Button>
                                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 text-xs h-7"
                                  onClick={() => setDeleteTarget(t)}>Excluir</Button>
                              </>
                            )}
                            {isDeleted && (
                              <Button variant="outline" size="sm" className="text-success border-success/30 text-xs h-7"
                                onClick={() => handleReactivate(t)}>Restaurar</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t">
                <p className="text-xs text-muted-foreground">{filteredCount} resultados</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs">{page + 1} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* Suspend Dialog */}
      <Dialog open={!!suspendTarget} onOpenChange={(o) => !o && setSuspendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender Empresa</DialogTitle>
            <DialogDescription>
              A empresa <strong>{suspendTarget?.nome}</strong> será suspensa imediatamente.
            </DialogDescription>
          </DialogHeader>
          <div><Label>Motivo</Label><Textarea value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} rows={3} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleSuspend} disabled={suspending}>
              {suspending ? "Suspendendo..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Soft Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Empresa (Soft Delete)</DialogTitle>
            <DialogDescription>
              A empresa <strong>{deleteTarget?.nome}</strong> será marcada para exclusão.
              Os dados serão retidos por 90 dias antes do purge definitivo.
              Todos os usuários serão desativados imediatamente.
            </DialogDescription>
          </DialogHeader>
          <div><Label>Motivo</Label><Textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} rows={3} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleSoftDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
