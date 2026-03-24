/**
 * UCShareLinkButton — Portal do Cliente: link público + gerenciamento de login.
 * Manages uc_client_tokens (public link) and client_portal_users (login access).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPublicUrl } from "@/lib/getPublicUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Link2, Copy, Check, Trash2, ExternalLink, Share2, UserPlus, KeyRound, Eye, EyeOff } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

interface Props {
  unitId: string;
}

interface ClientToken {
  id: string;
  token: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
  last_accessed_at: string | null;
}

interface PortalUser {
  id: string;
  email: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export function UCShareLinkButton({ unitId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  // --- Tokens (link público) ---
  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["uc_client_tokens", unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uc_client_tokens")
        .select("id, token, label, is_active, created_at, last_accessed_at")
        .eq("unit_id", unitId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientToken[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // --- Portal users (login) ---
  const { data: portalUsers = [] } = useQuery({
    queryKey: ["client_portal_users", unitId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_portal_users")
        .select("id, email, is_active, last_login_at, created_at")
        .eq("unit_id", unitId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalUser[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const createToken = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("uc_client_tokens")
        .insert({ unit_id: unitId, label: "Link do cliente" })
        .select("token")
        .single();
      if (error) throw error;
      return data.token;
    },
    onSuccess: (token) => {
      qc.invalidateQueries({ queryKey: ["uc_client_tokens", unitId] });
      copyToClipboard(token);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao gerar link", description: err.message, variant: "destructive" });
    },
  });

  const deleteToken = useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase
        .from("uc_client_tokens")
        .update({ is_active: false })
        .eq("id", tokenId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uc_client_tokens", unitId] });
      toast({ title: "Link desativado" });
    },
  });

  const createPortalUser = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.rpc("create_client_portal_user" as any, {
        p_unit_id: unitId,
        p_email: email,
        p_password: password,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || "Erro ao criar acesso");
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_portal_users", unitId] });
      setShowCreateUser(false);
      setNewEmail("");
      setNewPassword("");
      toast({ title: "Acesso do cliente criado com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar acesso", description: err.message, variant: "destructive" });
    },
  });

  const resetUserPassword = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data, error } = await supabase.rpc("reset_client_portal_password" as any, {
        p_user_id: userId,
        p_new_password: password,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || "Erro ao resetar senha");
      return result;
    },
    onSuccess: () => {
      setResetUserId(null);
      setResetPassword("");
      toast({ title: "Senha alterada com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao resetar senha", description: err.message, variant: "destructive" });
    },
  });

  const deactivateUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase as any)
        .from("client_portal_users")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_portal_users", unitId] });
      toast({ title: "Acesso desativado" });
    },
  });

  const copyToClipboard = async (token: string) => {
    const url = `${getPublicUrl()}/uc/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copiado!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const activeToken = tokens[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Portal do Cliente
          </CardTitle>
          <div className="flex items-center gap-2">
            {!activeToken && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1"
                onClick={() => createToken.mutate()}
                disabled={createToken.isPending}
              >
                <Link2 className="w-3.5 h-3.5" />
                {createToken.isPending ? "Gerando..." : "Gerar Link"}
              </Button>
            )}
            {portalUsers.length === 0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1"
                onClick={() => setShowCreateUser(true)}
              >
                <UserPlus className="w-3.5 h-3.5" /> Criar Login
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="h-10 bg-muted/50 rounded animate-pulse" />
        ) : (
          <>
            {/* === Link Público === */}
            {activeToken ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Link público (sem login)</p>
                <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-3 border border-border">
                  <code className="text-xs text-muted-foreground flex-1 truncate">
                    {getPublicUrl()}/uc/{activeToken.token}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => copyToClipboard(activeToken.token)}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <a
                    href={`${getPublicUrl()}/uc/${activeToken.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Criado em {formatDate(activeToken.created_at)}
                    {activeToken.last_accessed_at && (
                      <> · Último acesso: {formatDate(activeToken.last_accessed_at)}</>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive hover:text-destructive gap-1"
                    onClick={() => deleteToken.mutate(activeToken.id)}
                    disabled={deleteToken.isPending}
                  >
                    <Trash2 className="w-3 h-3" /> Desativar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Gere um link para compartilhar o portal desta UC com o cliente. O cliente poderá visualizar faturas e economia sem precisar de login.
              </p>
            )}

            {/* === Acesso com Login === */}
            {(portalUsers.length > 0 || showCreateUser) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Acesso com login</p>
                    {portalUsers.length > 0 && !showCreateUser && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs gap-1"
                        onClick={() => setShowCreateUser(true)}
                      >
                        <UserPlus className="w-3 h-3" /> Novo acesso
                      </Button>
                    )}
                  </div>

                  {/* List existing portal users */}
                  {portalUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 border border-border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{u.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.last_login_at
                            ? `Último login: ${formatDate(u.last_login_at)}`
                            : "Nunca acessou"}
                          {" · "}Criado em {formatDate(u.created_at)}
                        </p>
                      </div>
                      <Badge variant="outline" className={u.last_login_at ? "text-success border-success/20" : "text-warning border-warning/20"}>
                        {u.last_login_at ? "Ativo" : "Pendente"}
                      </Badge>

                      {resetUserId === u.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="password"
                            placeholder="Nova senha"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            className="h-7 text-xs w-28"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => resetUserPassword.mutate({ userId: u.id, password: resetPassword })}
                            disabled={!resetPassword || resetPassword.length < 6 || resetUserPassword.isPending}
                          >
                            OK
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setResetUserId(null)}>
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => setResetUserId(u.id)}
                          >
                            <KeyRound className="w-3 h-3" /> Resetar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                            onClick={() => deactivateUser.mutate(u.id)}
                            disabled={deactivateUser.isPending}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Create new user form */}
                  {showCreateUser && (
                    <div className="bg-muted/20 rounded-lg p-4 border border-border space-y-3">
                      <p className="text-xs font-medium text-foreground">Novo acesso para o cliente</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Email</Label>
                          <Input
                            type="email"
                            placeholder="cliente@exemplo.com"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Senha</Label>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Mínimo 6 caracteres"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="h-8 text-sm pr-8"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              className="absolute right-0 top-0 h-8 w-8 p-0"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="text-xs"
                          onClick={() => createPortalUser.mutate({ email: newEmail, password: newPassword })}
                          disabled={!newEmail || newPassword.length < 6 || createPortalUser.isPending}
                        >
                          {createPortalUser.isPending ? "Criando..." : "Criar Acesso"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => {
                            setShowCreateUser(false);
                            setNewEmail("");
                            setNewPassword("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        O cliente poderá fazer login em <strong>/uc/login</strong> com este email e senha para acessar o portal completo.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
