import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CheckCircle, XCircle, UserCheck, Clock } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingUser {
  id: string;
  user_id: string;
  nome: string;
  telefone: string | null;
  cargo_solicitado: string | null;
  status: string;
  created_at: string;
  email?: string;
}

const CARGO_LABELS: Record<string, { label: string; color: string }> = {
  consultor: { label: "Consultor", color: "bg-info/10 text-info" },
  vendedor: { label: "Consultor", color: "bg-info/10 text-info" }, // backward compat
  instalador: { label: "Instalador", color: "bg-success/10 text-success" },
  admin: { label: "Admin", color: "bg-destructive/10 text-destructive" },
  gerente: { label: "Gerente", color: "bg-accent text-accent-foreground" },
  financeiro: { label: "Financeiro", color: "bg-warning/10 text-warning" },
};

export function AprovacaoUsuarios() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectUserId, setRejectUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, nome, ativo, status, cargo_solicitado, telefone, avatar_url, created_at")
        .eq("status", "pendente")
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch emails for pending users
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const { data: emailsData } = await supabase.functions.invoke("list-users-emails", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const emailMap = new Map<string, string>();
        if (emailsData?.users && Array.isArray(emailsData.users)) {
          emailsData.users.forEach((u: { id: string; email: string }) => {
            emailMap.set(u.id, u.email);
          });
        }

        setPendingUsers(
          (data || []).map((p) => ({
            ...p,
            email: emailMap.get(p.user_id) || "—",
          }))
        );
      } else {
        setPendingUsers(data || []);
      }
    } catch (error) {
      console.error("Error fetching pending users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (user: PendingUser) => {
    if (!user.cargo_solicitado) {
      toast({
        title: "Erro",
        description: "Usuário não tem cargo solicitado definido.",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(user.user_id);
    try {
      // 1. Update profile status to 'aprovado'
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ status: "aprovado" })
        .eq("user_id", user.user_id);

      if (profileError) throw profileError;

      // 2. Assign role — normalize "vendedor" → "consultor" for backward compat
      const normalizedCargo = user.cargo_solicitado === "vendedor" ? "consultor" : user.cargo_solicitado;
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert([{
          user_id: user.user_id,
          role: normalizedCargo as "admin" | "gerente" | "consultor" | "instalador" | "financeiro",
        }]);

      if (roleError) throw roleError;

      // 3. If consultor (or legacy "vendedor"), create consultores record
      if (normalizedCargo === "consultor") {
        const codigo = `V${Date.now().toString(36).toUpperCase().slice(-6)}`;
        const { error: vendError } = await supabase.from("consultores").insert({
          nome: user.nome,
          telefone: user.telefone || "",
          email: user.email || "",
          user_id: user.user_id,
          codigo,
          ativo: true,
        } as any);

        if (vendError) {
          console.error("Error creating consultor record:", vendError);
        }
      }

      toast({
        title: "Usuário aprovado! ✅",
        description: `${user.nome} agora tem acesso como ${CARGO_LABELS[user.cargo_solicitado]?.label || user.cargo_solicitado}.`,
      });

      fetchPendingUsers();
    } catch (error: any) {
      console.error("Error approving user:", error);
      toast({
        title: "Erro ao aprovar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "rejeitado" })
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Usuário rejeitado",
        description: "O acesso foi negado.",
      });

      fetchPendingUsers();
    } catch (error: any) {
      console.error("Error rejecting user:", error);
      toast({
        title: "Erro ao rejeitar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setRejectUserId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Spinner size="md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <UserCheck className="w-5 h-5 text-warning" />
            </div>
            <div>
              <CardTitle>Aprovação de Usuários</CardTitle>
              <CardDescription>
                {pendingUsers.length === 0
                  ? "Nenhum usuário aguardando aprovação"
                  : `${pendingUsers.length} usuário(s) aguardando aprovação`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {pendingUsers.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cargo Solicitado</TableHead>
                  <TableHead>Solicitado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => {
                  const cargoInfo = CARGO_LABELS[user.cargo_solicitado || ""] || {
                    label: user.cargo_solicitado || "—",
                    color: "bg-muted text-muted-foreground",
                  };

                  return (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.nome}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.email || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cargoInfo.color}>
                          {cargoInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(user.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(user)}
                            disabled={actionLoading === user.user_id}
                            className="gap-1"
                          >
                            {actionLoading === user.user_id ? (
                              <Spinner size="sm" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setRejectUserId(user.user_id)}
                            disabled={actionLoading === user.user_id}
                            className="gap-1"
                          >
                            <XCircle className="w-3 h-3" />
                            Rejeitar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      <AlertDialog
        open={!!rejectUserId}
        onOpenChange={(open) => !open && setRejectUserId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário não terá acesso ao sistema. Você pode aprovar
              posteriormente se necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectUserId && handleReject(rejectUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
