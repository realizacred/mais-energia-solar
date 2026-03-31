/**
 * EmailIntegrationsPage — Admin page for managing email accounts and ingestion.
 * §26: Header. §27: KPI cards. §12: Skeleton. §16: Queries in hooks only.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail, Plus, RefreshCw, Trash2, CheckCircle2, XCircle, Clock,
  AlertTriangle, FileText, Settings2, Eye, EyeOff,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useEmailAccounts,
  useEmailIngestionSummary,
  useEmailIngestionRuns,
  useSaveEmailAccount,
  useDeleteEmailAccount,
  useTriggerEmailSync,
  useClearFailedRuns,
  type EmailAccount,
} from "@/hooks/useEmailAccounts";

// ─── Role Labels ────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  invoices: "Faturas",
  operational: "Operacional",
  support: "Suporte",
};

const PROVIDER_LABELS: Record<string, string> = {
  gmail: "Gmail (OAuth)",
  imap: "IMAP",
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  active: { icon: CheckCircle2, color: "text-success", label: "Ativo" },
  error: { icon: XCircle, color: "text-destructive", label: "Erro" },
  inactive: { icon: Clock, color: "text-muted-foreground", label: "Inativo" },
};

function getAccountStatus(account: EmailAccount) {
  if (!account.is_active) return "inactive";
  if (account.last_error) return "error";
  return "active";
}

// ─── KPI Section ────────────────────────────────────────────────

function KPISection() {
  const { data, isLoading } = useEmailIngestionSummary();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
        ))}
      </div>
    );
  }

  const kpis = [
    { label: "Contas Ativas", value: data?.active_accounts ?? 0, icon: Mail, color: "primary" as const },
    { label: "E-mails Processados (30d)", value: data?.emails_processed_30d ?? 0, icon: FileText, color: "info" as const },
    { label: "Faturas Importadas (30d)", value: data?.invoices_imported_30d ?? 0, icon: CheckCircle2, color: "success" as const },
    { label: "Erros (30d)", value: data?.errors_30d ?? 0, icon: AlertTriangle, color: "warning" as const },
  ];

  const borderMap = { primary: "border-l-primary", info: "border-l-info", success: "border-l-success", warning: "border-l-warning" };
  const bgMap = { primary: "bg-primary/10 text-primary", info: "bg-info/10 text-info", success: "bg-success/10 text-success", warning: "bg-warning/10 text-warning" };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((k) => (
        <Card key={k.label} className={`border-l-[3px] ${borderMap[k.color]} bg-card shadow-sm`}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bgMap[k.color]}`}>
              <k.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{k.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{k.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Account Form Modal ─────────────────────────────────────────

interface AccountFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<EmailAccount> | null;
}

function AccountFormModal({ open, onOpenChange, initial }: AccountFormProps) {
  const save = useSaveEmailAccount();
  const initialSettings = (initial?.settings || {}) as Record<string, unknown>;
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email_address: initial?.email_address || "",
    provider_type: initial?.provider_type || "gmail",
    account_role: initial?.account_role || "invoices",
    host: initial?.host || "",
    port: initial?.port?.toString() || "993",
    username: initial?.username || "",
    password: (initialSettings.password as string) || "",
    use_ssl: (initialSettings.use_ssl as boolean) ?? true,
    is_active: initial?.is_active ?? true,
  });

  const isImap = form.provider_type === "imap";

  const handleSave = async () => {
    if (!form.email_address) {
      toast({ title: "E-mail obrigatório", variant: "destructive" });
      return;
    }
    try {
      await save.mutateAsync({
        id: initial?.id,
        email_address: form.email_address,
        provider_type: form.provider_type,
        account_role: form.account_role as any,
        host: isImap ? form.host : null,
        port: isImap ? parseInt(form.port) || 993 : null,
        username: isImap ? form.username : null,
        is_active: form.is_active,
        settings: isImap ? { password: form.password, use_ssl: form.use_ssl } : {},
      });
      toast({ title: initial?.id ? "Conta atualizada" : "Conta adicionada" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {initial?.id ? "Editar Conta" : "Nova Conta de E-mail"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Configure a conta para leitura automática</p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={form.email_address} onChange={e => setForm(f => ({ ...f, email_address: e.target.value }))} placeholder="faturas@empresa.com" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provedor</Label>
                <Select value={form.provider_type} onValueChange={v => setForm(f => ({ ...f, provider_type: v as "gmail" | "imap" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail (OAuth)</SelectItem>
                    <SelectItem value="imap">IMAP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Finalidade</Label>
                <Select value={form.account_role} onValueChange={v => setForm(f => ({ ...f, account_role: v as "invoices" | "operational" | "support" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoices">Faturas</SelectItem>
                    <SelectItem value="operational">Operacional</SelectItem>
                    <SelectItem value="support">Suporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isImap && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">IMAP não suportado no momento</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    As Edge Functions do Supabase não suportam conexões TCP (necessárias para IMAP).
                    <strong> Alternativas:</strong> Use <strong>Gmail OAuth</strong> (funciona com Google Workspace),
                    ou configure o encaminhamento automático deste e-mail para uma conta Gmail já conectada.
                  </p>
                </div>
              </div>
            )}

            {isImap && (
              <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                <p className="text-xs font-semibold text-foreground">Configuração IMAP</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Servidor (host)</Label>
                    <Input value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="imap.gmail.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Porta</Label>
                    <Input value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} placeholder="993" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="usuario@servidor.com" />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••"
                      className="pr-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-9"
                      onClick={() => setShowPassword(v => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.use_ssl} onCheckedChange={v => setForm(f => ({ ...f, use_ssl: v }))} />
                  <Label className="text-xs">Usar conexão segura (SSL)</Label>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Conta ativa</Label>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancelar</Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Accounts Table ─────────────────────────────────────────────

function AccountsTable() {
  const { data: accounts, isLoading } = useEmailAccounts();
  const deleteAccount = useDeleteEmailAccount();
  const triggerSync = useTriggerEmailSync();
  const [formOpen, setFormOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<EmailAccount | null>(null);

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>;
  }

  if (!accounts || accounts.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-3">
            <Mail className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma conta de e-mail cadastrada</p>
          <p className="text-xs text-muted-foreground mt-1">Adicione sua primeira conta para começar a ingestão automática</p>
          <Button size="sm" className="mt-4" onClick={() => { setEditAccount(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar Conta
          </Button>
        </div>
        {formOpen && (
          <AccountFormModal
            open={formOpen}
            onOpenChange={setFormOpen}
            initial={editAccount}
          />
        )}
      </>
    );
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta conta de e-mail?")) return;
    try {
      await deleteAccount.mutateAsync(id);
      toast({ title: "Conta excluída" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleSync = async (id: string) => {
    try {
      await triggerSync.mutateAsync(id);
      toast({ title: "Sincronização iniciada" });
    } catch (e: any) {
      toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <div className="flex items-center justify-end mb-3">
        <Button size="sm" onClick={() => { setEditAccount(null); setFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nova Conta
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold text-foreground">E-mail</TableHead>
              <TableHead className="font-semibold text-foreground">Tipo</TableHead>
              <TableHead className="font-semibold text-foreground">Finalidade</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="font-semibold text-foreground">Última Leitura</TableHead>
              <TableHead className="w-[120px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((acc) => {
              const status = getAccountStatus(acc);
              const cfg = STATUS_CONFIG[status];
              const StatusIcon = cfg.icon;
              return (
                <TableRow key={acc.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-foreground">{acc.email_address}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{PROVIDER_LABELS[acc.provider_type] || acc.provider_type}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{ROLE_LABELS[acc.account_role] || acc.account_role}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    {acc.last_error && (
                      <p className="text-[10px] text-destructive mt-0.5 truncate max-w-[200px]">{acc.last_error}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {acc.last_sync_at
                      ? new Date(acc.last_sync_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
                      : "Nunca"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSync(acc.id)} disabled={triggerSync.isPending}>
                        <RefreshCw className={`w-4 h-4 text-primary ${triggerSync.isPending ? "animate-spin" : ""}`} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditAccount(acc); setFormOpen(true); }}>
                        <Settings2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(acc.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {formOpen && (
        <AccountFormModal
          open={formOpen}
          onOpenChange={setFormOpen}
          initial={editAccount}
        />
      )}
    </>
  );
}

// ─── Runs History ───────────────────────────────────────────────

function RunsHistory() {
  const { data: accounts } = useEmailAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const accountId = selectedAccountId || accounts?.[0]?.id || null;
  const { data: runs, isLoading } = useEmailIngestionRuns(accountId);
  const clearFailed = useClearFailedRuns();

  const failedCount = runs?.filter(r => r.status === "failed").length || 0;

  const handleClearFailed = async () => {
    if (!accountId) return;
    try {
      await clearFailed.mutateAsync(accountId);
      toast({ title: "Execuções com falha removidas" });
    } catch {
      toast({ title: "Erro ao limpar", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        {accounts && accounts.length > 1 && (
          <Select value={accountId || ""} onValueChange={v => setSelectedAccountId(v)}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Selecione uma conta..." />
            </SelectTrigger>
            <SelectContent>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.email_address}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {failedCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleClearFailed} disabled={clearFailed.isPending}>
            <Trash2 className="w-4 h-4 mr-1.5" />
            Limpar falhas ({failedCount})
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
      ) : !runs || runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma execução registrada</p>
          <p className="text-xs text-muted-foreground mt-1">Sincronize uma conta para ver o histórico</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Data</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground">Detalhes</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Processados</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Importados</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Duplicados</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Erros</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map(r => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm text-foreground">
                    {new Date(r.started_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${r.status === "completed" ? "border-success/40 text-success" : r.status === "failed" ? "border-destructive/40 text-destructive" : ""}`}
                    >
                      {r.status === "completed" ? "Concluído" : r.status === "failed" ? "Falhou" : "Executando"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    {r.status === "failed" && r.error_message ? (
                      <p className="text-xs text-destructive truncate" title={r.error_message}>
                        {r.error_message}
                      </p>
                    ) : r.status === "completed" ? (
                      <p className="text-xs text-muted-foreground">
                        {r.imported_count > 0 ? `${r.imported_count} fatura(s) importada(s)` : "Nenhuma fatura nova"}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.processed_count}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-success">{r.imported_count}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">{r.duplicate_count}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-destructive">{r.error_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export function EmailIntegrationsPage() {
  return (
    <div className="space-y-6">
      {/* §26: Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Integrações de E-mail</h1>
            <p className="text-sm text-muted-foreground">Gerencie contas e ingestão automática de dados</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <KPISection />

      {/* Tabs */}
      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">Contas</TabsTrigger>
          <TabsTrigger value="history">Histórico de Ingestão</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <AccountsTable />
        </TabsContent>

        <TabsContent value="history">
          <RunsHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
