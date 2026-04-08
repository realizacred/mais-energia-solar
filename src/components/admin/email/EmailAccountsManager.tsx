/**
 * EmailAccountsManager — Full CRUD screen for email accounts (IMAP + Gmail).
 * §26: PageHeader. §25: Modal. §27: KPI cards. §12: Skeleton. RB-01..RB-10.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, Plus, Server, RefreshCw, Trash2, Pencil, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/EmailInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import {
  useEmailAccounts, useSaveEmailAccount, useDeleteEmailAccount, useToggleEmailAccount,
  type EmailAccount,
} from "@/hooks/useEmailAccounts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const INTERVAL_OPTIONS = [
  { value: "15", label: "15 minutos" },
  { value: "30", label: "30 minutos" },
  { value: "60", label: "1 hora" },
  { value: "120", label: "2 horas" },
  { value: "360", label: "6 horas" },
  { value: "720", label: "12 horas" },
  { value: "1440", label: "24 horas" },
];

const EMPTY_FORM = {
  nome: "",
  email_address: "",
  provider_type: "imap" as string,
  host: "",
  port: 993,
  username: "",
  imap_password: "",
  is_active: true,
  verificar_a_cada_minutos: 60,
  pasta_monitorada: "INBOX",
  filtro_remetente: "",
  imap_ssl: true,
};

export function EmailAccountsManager() {
  const { data: accounts = [], isLoading } = useEmailAccounts();
  const salvar = useSaveEmailAccount();
  const deletar = useDeleteEmailAccount();
  const toggle = useToggleEmailAccount();

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [syncing, setSyncing] = useState<string | null>(null);

  const activeCount = accounts.filter(a => a.is_active).length;
  const gmailCount = accounts.filter(a => a.provider_type === "gmail").length;
  const imapCount = accounts.filter(a => a.provider_type === "imap").length;

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(acc: EmailAccount) {
    setEditId(acc.id);
    setForm({
      nome: acc.nome || "",
      email_address: acc.email_address,
      provider_type: acc.provider_type || "imap",
      host: acc.host || "",
      port: acc.port || 993,
      username: acc.username || "",
      imap_password: "", // never pre-fill password
      is_active: acc.is_active,
      verificar_a_cada_minutos: acc.verificar_a_cada_minutos || 60,
      pasta_monitorada: acc.pasta_monitorada || "INBOX",
      filtro_remetente: acc.filtro_remetente || "",
      imap_ssl: (acc.port || 993) === 993,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.email_address.trim()) {
      toast.error("Preencha o e-mail da conta");
      return;
    }

    const payload: any = {
      nome: form.nome.trim() || form.email_address,
      email_address: form.email_address.trim(),
      provider_type: form.provider_type,
      is_active: form.is_active,
      verificar_a_cada_minutos: form.verificar_a_cada_minutos,
      pasta_monitorada: form.pasta_monitorada,
      filtro_remetente: form.filtro_remetente.trim() || null,
    };

    if (form.provider_type === "imap") {
      payload.host = form.host.trim();
      payload.port = form.imap_ssl ? 993 : (form.port || 143);
      payload.username = form.username.trim() || form.email_address.trim();
      if (form.imap_password) {
        payload.imap_password_encrypted = form.imap_password; // TODO: encrypt client-side or via edge fn
      }
    }

    if (editId) payload.id = editId;

    try {
      await salvar.mutateAsync(payload);
      toast.success(editId ? "Conta atualizada" : "Conta adicionada");
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    }
  }

  async function handleDelete(acc: EmailAccount) {
    if (!confirm(`Remover a conta "${acc.nome || acc.email_address}"?`)) return;
    try {
      await deletar.mutateAsync(acc.id);
      toast.success("Conta removida");
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    }
  }

  async function handleToggle(acc: EmailAccount) {
    try {
      await toggle.mutateAsync({ id: acc.id, is_active: !acc.is_active });
      toast.success(acc.is_active ? "Conta desativada" : "Conta ativada");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar status");
    }
  }

  async function handleSync(acc: EmailAccount) {
    setSyncing(acc.id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const resp = await fetch(`${supabaseUrl}/functions/v1/email-ingestion`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "sync", email_account_id: acc.id }),
      });
      const result = await resp.json();
      if (result.success) {
        toast.success(`Sincronização concluída: ${result.imported || 0} importados, ${result.duplicates || 0} duplicados`);
      } else {
        toast.error(result.error || "Erro na sincronização");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao sincronizar");
    } finally {
      setSyncing(null);
    }
  }

  async function handleConnectGmail() {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!token) { toast.error("Você precisa estar logado"); return; }

      const resp = await fetch(`${supabaseUrl}/functions/v1/gmail-oauth?action=auth_url`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await resp.json();
      if (data.auth_url) {
        const popup = window.open(data.auth_url, 'gmail-oauth', 'width=600,height=700,scrollbars=yes');
        const timer = setInterval(() => {
          if (popup?.closed) {
            clearInterval(timer);
            // refresh accounts list via query invalidation instead of full reload
            qc.invalidateQueries({ queryKey: ["email-accounts"] });
          }
        }, 1000);
      } else {
        toast.error(data.error || "Erro ao gerar URL de autenticação");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao conectar Gmail");
    }
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {isLoading ? <Skeleton className="h-8 w-12" /> : activeCount}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Contas Ativas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-info bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {isLoading ? <Skeleton className="h-8 w-12" /> : gmailCount}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Gmail OAuth</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {isLoading ? <Skeleton className="h-8 w-12" /> : imapCount}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Servidor IMAP</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Nenhuma conta de email cadastrada"
          description="Adicione uma conta Gmail ou IMAP para receber faturas automaticamente por email."
          action={{ label: "Nova Conta", onClick: openCreate, icon: Plus }}
        />
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <Card key={acc.id} className="bg-card shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    acc.provider_type === "gmail"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-info/10 text-info"
                  }`}>
                    {acc.provider_type === "gmail" ? <Mail className="w-5 h-5" /> : <Server className="w-5 h-5" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">{acc.nome || acc.email_address}</p>
                      <Badge variant="outline" className={`text-xs ${
                        acc.provider_type === "gmail"
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-info/10 text-info border-info/20"
                      }`}>
                        {acc.provider_type === "gmail" ? "Gmail" : "IMAP"}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${
                        acc.is_active
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {acc.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{acc.email_address}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {acc.last_sync_at
                          ? `Verificado ${formatDistanceToNow(new Date(acc.last_sync_at), { addSuffix: true, locale: ptBR })}`
                          : "Nunca verificado"
                        }
                      </span>
                      <span>Verifica a cada: {acc.verificar_a_cada_minutos || 60} min</span>
                      {acc.last_error && (
                        <span className="text-destructive truncate max-w-[200px]" title={acc.last_error}>
                          Erro: {acc.last_error}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(acc)}
                      disabled={syncing === acc.id || !acc.is_active}
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${syncing === acc.id ? "animate-spin" : ""}`} />
                      {syncing === acc.id ? "Verificando..." : "Verificar agora"}
                    </Button>
                    <Switch
                      checked={acc.is_active}
                      onCheckedChange={() => handleToggle(acc)}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(acc)}>
                      <Pencil className="w-4 h-4 text-warning" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(acc)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add button */}
      {accounts.length > 0 && (
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Nova Conta
        </Button>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {editId ? "Editar Conta de Email" : "Nova Conta de Email"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure uma conta Gmail ou IMAP para receber faturas automaticamente
              </p>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-5">
              {/* Basic info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome da conta</Label>
                  <Input
                    value={form.nome}
                    onChange={set("nome")}
                    placeholder="Ex: Email Faturas Energisa"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo <span className="text-destructive">*</span></Label>
                  <Select
                    value={form.provider_type}
                    onValueChange={v => setForm(f => ({ ...f, provider_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="imap">
                        <span className="flex items-center gap-2"><Server className="w-4 h-4" /> Servidor IMAP</span>
                      </SelectItem>
                      <SelectItem value="gmail">
                        <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> Gmail OAuth</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* IMAP fields */}
              {form.provider_type === "imap" && (
                <div className="space-y-4 border border-border rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground">Configurações do Servidor IMAP</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Endereço de e-mail <span className="text-destructive">*</span></Label>
                      <EmailInput
                        value={form.email_address}
                        onChange={(v) => setForm(f => ({ ...f, email_address: v }))}
                        placeholder="faturas@empresa.com.br"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Servidor (Host) <span className="text-destructive">*</span></Label>
                      <Input
                        value={form.host}
                        onChange={set("host")}
                        placeholder="mail.empresa.com.br"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Usuário (login)</Label>
                      <Input
                        value={form.username}
                        onChange={set("username")}
                        placeholder="Mesmo do e-mail se vazio"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Senha <span className="text-destructive">*</span></Label>
                      <Input
                        type="password"
                        value={form.imap_password}
                        onChange={set("imap_password")}
                        placeholder={editId ? "Deixe vazio para manter a atual" : "Senha do email"}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Porta</Label>
                      <Input
                        type="number"
                        value={form.port}
                        onChange={e => setForm(f => ({ ...f, port: parseInt(e.target.value) || 993 }))}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-5">
                      <Label className="text-xs">SSL/TLS</Label>
                      <Switch
                        checked={form.imap_ssl}
                        onCheckedChange={v => setForm(f => ({ ...f, imap_ssl: v, port: v ? 993 : 143 }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Pasta monitorada</Label>
                      <Input
                        value={form.pasta_monitorada}
                        onChange={set("pasta_monitorada")}
                        placeholder="INBOX"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Gmail fields */}
              {form.provider_type === "gmail" && (
                <div className="space-y-4 border border-border rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground">Conexão Gmail OAuth</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Endereço Gmail <span className="text-destructive">*</span></Label>
                    <EmailInput
                      value={form.email_address}
                      onChange={(v) => setForm(f => ({ ...f, email_address: v }))}
                      placeholder="empresa@gmail.com"
                      required
                    />
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Para usar o Gmail, você precisa autorizar o acesso via OAuth.
                      Após salvar esta conta, conecte o Gmail na página de Faturas de Energia.
                    </p>
                    <Button variant="outline" size="sm" onClick={handleConnectGmail} type="button">
                      <Mail className="w-4 h-4 mr-1" /> Conectar Gmail
                    </Button>
                  </div>
                </div>
              )}

              {/* General settings */}
              <div className="space-y-4 border border-border rounded-lg p-4">
                <p className="text-sm font-medium text-foreground">Configurações Gerais</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Verificar a cada</Label>
                    <Select
                      value={String(form.verificar_a_cada_minutos)}
                      onValueChange={v => setForm(f => ({ ...f, verificar_a_cada_minutos: parseInt(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVAL_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Filtro de remetente (opcional)</Label>
                    <Input
                      value={form.filtro_remetente}
                      onChange={set("filtro_remetente")}
                      placeholder="Ex: @energisa.com.br"
                    />
                    <p className="text-[10px] text-muted-foreground">Deixe vazio para aceitar todos os remetentes</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={salvar.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : editId ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
