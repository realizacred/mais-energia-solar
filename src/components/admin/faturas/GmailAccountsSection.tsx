/**
 * GmailAccountsSection — Seção completa de gerenciamento de contas Gmail.
 * Inclui configuração OAuth e lista de contas conectadas.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGmailAccounts, useDeletarGmailAccount, useToggleGmailAccount } from "@/hooks/useGmailAccounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Mail, Settings, Plus, Trash2, CheckCircle, XCircle,
  Loader2, Eye, EyeOff, RefreshCw, Info, Copy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const REDIRECT_URI = "https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/gmail-oauth?action=callback";

export function GmailAccountsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: accounts = [], isLoading } = useGmailAccounts();
  const deleteMut = useDeletarGmailAccount();
  const toggleMut = useToggleGmailAccount();

  // OAuth config state
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthSaving, setOauthSaving] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [savedClientId, setSavedClientId] = useState("");
  const [savedClientSecret, setSavedClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [oauthLoaded, setOauthLoaded] = useState(false);

  const oauthDirty = clientId !== savedClientId || clientSecret !== savedClientSecret;

  // New account modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newConcessionaria, setNewConcessionaria] = useState("");
  const [connecting, setConnecting] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Verify now
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Load OAuth settings on first render
  async function loadOAuthConfig() {
    if (oauthLoaded) return;
    setOauthLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("site_settings")
        .select("google_client_id, google_client_secret, google_redirect_uri")
        .limit(1)
        .single();
      if (data) {
        setClientId(data.google_client_id || "");
        setClientSecret(data.google_client_secret || "");
        setSavedClientId(data.google_client_id || "");
        setSavedClientSecret(data.google_client_secret || "");
      }
      setOauthLoaded(true);
    } catch { /* ignore */ }
    setOauthLoading(false);
  }

  // Load on mount
  useState(() => { loadOAuthConfig(); });

  async function handleSaveOAuth() {
    setOauthSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("site_settings")
        .update({
          google_client_id: clientId || null,
          google_client_secret: clientSecret || null,
          updated_at: new Date().toISOString(),
        })
        .neq("id", "00000000-0000-0000-0000-000000000000"); // update all rows for tenant (RLS filters)
      if (error) throw error;
      setSavedClientId(clientId);
      setSavedClientSecret(clientSecret);
      toast({ title: "Configurações OAuth salvas" });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
    setOauthSaving(false);
  }

  async function handleConnectNew() {
    if (!newNome.trim()) {
      toast({ title: "Preencha o nome da conta", variant: "destructive" });
      return;
    }
    setConnecting(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!token) { toast({ title: "Erro", description: "Faça login", variant: "destructive" }); return; }

      const params = new URLSearchParams({
        action: "auth_url",
        account_name: newNome.trim(),
        concessionaria: newConcessionaria.trim(),
      });

      const resp = await fetch(`${supabaseUrl}/functions/v1/gmail-oauth?${params}`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const result = await resp.json();
      if (result.auth_url) {
        const popup = window.open(result.auth_url, 'gmail-oauth', 'width=600,height=700,scrollbars=yes');
        const timer = setInterval(() => {
          if (popup?.closed) {
            clearInterval(timer);
            qc.invalidateQueries({ queryKey: ["gmail_accounts"] });
          }
        }, 1000);
      } else {
        toast({ title: "Erro", description: result.error || "Falha ao gerar URL OAuth", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
    setConnecting(false);
  }

  async function handleVerifyNow(accountId: string) {
    setVerifyingId(accountId);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      await fetch(`${supabaseUrl}/functions/v1/check-billing-emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email_account_id: accountId }),
      });
      toast({ title: "Verificação iniciada" });
      qc.invalidateQueries({ queryKey: ["gmail_accounts"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
    setVerifyingId(null);
  }

  function formatTimeAgo(dateStr: string | null): string {
    if (!dateStr) return "Nunca";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Agora";
    if (mins < 60) return `${mins} min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  }

  return (
    <div className="space-y-4">
      {/* PARTE A — OAuth Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" /> Configurações Google OAuth
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Configure no{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Google Cloud Console → APIs → Credenciais → OAuth 2.0
            </a>
          </p>
          {oauthLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Google Client ID</Label>
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxx.apps.googleusercontent.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Google Client Secret</Label>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="GOCSPX-..."
                    className="pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-10"
                    onClick={() => setShowSecret(!showSecret)}
                    type="button"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">URI de Redirecionamento (readonly)</Label>
                <div className="flex gap-2">
                  <Input value={REDIRECT_URI} readOnly className="bg-muted/50 text-muted-foreground font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(REDIRECT_URI);
                      toast({ title: "URI copiada!" });
                    }}
                    type="button"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSaveOAuth} disabled={oauthSaving}>
              {oauthSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Salvar configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PARTE B — Contas Gmail */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="w-4 h-4" /> Contas Gmail
            {accounts.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">({accounts.length})</span>
            )}
          </CardTitle>
          <Button size="sm" onClick={() => { setNewNome(""); setNewConcessionaria(""); setShowNewModal(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Conectar Nova Conta
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Nota informativa */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Apenas UCs com "Leitura automática por email" ativada serão processadas automaticamente.
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma conta Gmail conectada</p>
              <p className="text-xs text-muted-foreground mt-1">Conecte uma conta para receber faturas automaticamente</p>
            </div>
          ) : (
            accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{acc.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{acc.email || "Email não configurado"}</p>
                    {acc.concessionaria_nome && (
                      <p className="text-xs text-muted-foreground">{acc.concessionaria_nome}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={acc.is_active
                      ? "bg-success/10 text-success border-success/20 text-xs"
                      : "bg-muted text-muted-foreground text-xs"
                    }
                  >
                    {acc.is_active ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                    {acc.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Verificado: {formatTimeAgo(acc.ultimo_verificado_at)}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    A cada: {acc.verificar_a_cada_minutos} min
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleVerifyNow(acc.id)}
                    disabled={verifyingId === acc.id}
                  >
                    {verifyingId === acc.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <RefreshCw className="w-3 h-3 mr-1" />
                    }
                    Verificar
                  </Button>
                  <Switch
                    checked={acc.is_active}
                    onCheckedChange={(checked) => toggleMut.mutate({ id: acc.id, is_active: checked })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteId(acc.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Modal Nova Conta */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Conectar Nova Conta Gmail
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Informe um nome e a concessionária antes de autorizar
              </p>
            </div>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da conta <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ex: Gmail Energisa"
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Concessionária (opcional)</Label>
              <Input
                placeholder="Ex: Energisa Minas Gerais"
                value={newConcessionaria}
                onChange={(e) => setNewConcessionaria(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => setShowNewModal(false)} disabled={connecting}>
              Cancelar
            </Button>
            <Button onClick={handleConnectNew} disabled={connecting}>
              {connecting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
              Autorizar Gmail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conta Gmail?</AlertDialogTitle>
            <AlertDialogDescription>A conta será desconectada e os tokens removidos. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteMut.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
