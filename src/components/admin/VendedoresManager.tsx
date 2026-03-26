import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { WaAutoMessageToggle } from "@/components/vendor/WaAutoMessageToggle";
import { ConsultorHorariosEdit } from "@/components/admin/settings/ConsultorHorariosEdit";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatPhone, formatName } from "@/lib/validations";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { getPublicUrl } from "@/lib/getPublicUrl";
import { isEmailAlreadyRegisteredError, parseInvokeError } from "@/lib/supabaseFunctionError";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormModalTemplate } from "@/components/ui-kit/FormModalTemplate";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/EmailInput";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Copy, Check, Trash2, Edit2, Users, Link as LinkIcon, Phone, Mail, UserCheck, Eye, EyeOff, KeyRound, Unlink, Send, TicketCheck, Download, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui-kit/Spinner";
import { SearchInput } from "@/components/ui-kit";
import { TablePagination } from "@/components/ui-kit/TablePagination";

interface Vendedor {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  codigo: string;
  slug: string | null;
  ativo: boolean;
  user_id: string | null;
  created_at: string;
  percentual_comissao: number;
}

interface UserProfile {
  user_id: string;
  nome: string;
}

interface VendedoresManagerProps {
  leads?: { consultor: string | null }[];
}

export default function VendedoresManager({ leads: propLeads }: VendedoresManagerProps = {}) {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null);
  const [vendedorToDelete, setVendedorToDelete] = useState<Vendedor | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nome: "", telefone: "", email: "", user_id: "", senha: "", tipoAcesso: "convite" as "convite" | "criar" | "vincular", percentual_comissao: "2" });
  const [showPassword, setShowPassword] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState<string | null>(null);
  const { toast } = useToast();

  // ── Search, filters, pagination ─────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const isNewVendedor = !editingVendedor;
  const isLinkingExistingUser = isNewVendedor && formData.tipoAcesso === "vincular";
  const isInviteFlow = isNewVendedor && formData.tipoAcesso === "convite";

  // Generate invite for a vendedor
  const generateInvite = async (vendedorId: string, vendedorEmail: string, vendedorTelefone: string) => {
    try {
      setGeneratingInvite(vendedorId);

      // Get tenant_id from current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão inválida");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      // Revoke previous invites for this vendedor
      await supabase
        .from("vendor_invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("consultor_id", vendedorId)
        .is("used_at", null)
        .is("revoked_at", null);

      // Create new invite
      const { data: invite, error } = await supabase
        .from("vendor_invites")
        .insert({
          consultor_id: vendedorId,
          tenant_id: profile.tenant_id,
          email: vendedorEmail,
          created_by: user.id,
        })
        .select("token")
        .single();

      if (error) throw error;

      const link = `${getPublicUrl()}/ativar-conta?token=${invite.token}`;
      setInviteLink(link);
      setInviteDialogOpen(true);

      toast({
        title: "Convite gerado!",
        description: "Copie o link e envie ao consultor.",
      });

      return link;
    } catch (err: any) {
      toast({
        title: "Erro ao gerar convite",
        description: err.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setGeneratingInvite(null);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
      toast({ title: "Link copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const sendInviteViaWhatsApp = (telefone: string) => {
    if (!inviteLink) return;
    const message = encodeURIComponent(
      `🔐 Ative sua conta no CRM!\n\nClique no link abaixo para criar sua senha e acessar o sistema:\n\n${inviteLink}\n\n⏰ Este link expira em 48 horas.`
    );
    const phone = telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
  };

  // Fetch leads if not provided via props
  const { data: fetchedLeadsData } = useQuery({
    queryKey: ["leads-consultor-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("consultor").is("deleted_at", null);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !propLeads,
  });
  const fetchedLeads = fetchedLeadsData || [];

  const leads = propLeads || fetchedLeads;

  // Count leads per consultor (by nome, case-insensitive)
  const leadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(lead => {
      if (lead.consultor) {
        const normalizedName = lead.consultor.toLowerCase();
        counts[normalizedName] = (counts[normalizedName] || 0) + 1;
      }
    });
    return counts;
  }, [leads]);

  useEffect(() => {
    fetchVendedores();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch profiles with user_id to link to vendedores
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    }
  };

  // Get list of user_ids already linked to vendedores
  const linkedUserIds = useMemo(() => {
    return vendedores
      .filter(v => v.user_id && v.id !== editingVendedor?.id)
      .map(v => v.user_id);
  }, [vendedores, editingVendedor]);

  // Available users (not yet linked to another vendedor)
  const availableUsers = useMemo(() => {
    return users.filter(u => !linkedUserIds.includes(u.user_id));
  }, [users, linkedUserIds]);

  const fetchVendedores = async () => {
    try {
      const { data, error } = await supabase
        .from("consultores")
        .select("id, nome, telefone, email, codigo, slug, ativo, user_id, created_at, percentual_comissao")
        .order("nome");

      if (error) throw error;
      setVendedores(data as any || []);
    } catch (error) {
      console.error("Erro ao buscar vendedores:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os consultores.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nome.trim() || !formData.telefone.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome e telefone.",
        variant: "destructive",
      });
      return;
    }

    // Validate based on access type
    if (isNewVendedor) {
      if (isInviteFlow) {
        if (!formData.email.trim()) {
          toast({
            title: "Email obrigatório",
            description: "Preencha o email para enviar o convite.",
            variant: "destructive",
          });
          return;
        }
      } else if (isLinkingExistingUser) {
        if (!formData.user_id) {
          toast({
            title: "Usuário obrigatório",
            description: "Selecione um usuário existente para vincular.",
            variant: "destructive",
          });
          return;
        }
      } else {
        if (!formData.email.trim() || !formData.senha.trim()) {
          toast({
            title: "Campos obrigatórios",
            description: "Preencha email e senha para criar o acesso do consultor.",
            variant: "destructive",
          });
          return;
        }
        if (formData.senha.length < 6) {
          toast({
            title: "Senha muito curta",
            description: "A senha deve ter pelo menos 6 caracteres.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (editingVendedor) {
        // Update
        const { error } = await supabase
          .from("consultores")
          .update({
            nome: formData.nome,
            telefone: formData.telefone,
            email: formData.email || null,
            user_id: formData.user_id || null,
            percentual_comissao: parseFloat(formData.percentual_comissao) || 0,
          })
          .eq("id", editingVendedor.id);

        if (error) throw error;
        toast({ title: "Consultor atualizado!" });
      } else {
        // INVITE FLOW — create vendedor first, then generate invite
        if (isInviteFlow) {
          const { data: newVendedor, error: vendedorError } = await supabase
            .from("consultores")
            .insert({
              nome: formData.nome,
              telefone: formData.telefone,
              email: formData.email,
              percentual_comissao: parseFloat(formData.percentual_comissao) || 0,
              codigo: "temp",
            } as any)
            .select("id")
            .single();

          if (vendedorError) throw vendedorError;

          // Generate invite link
          await generateInvite(newVendedor.id, formData.email, formData.telefone);

          toast({
            title: "Consultor cadastrado!",
            description: "Convite gerado. Envie o link ao consultor.",
          });

          fetchUsers();
        } else if (isLinkingExistingUser) {
          const { error: vendedorError } = await supabase
            .from("consultores")
            .insert({
              nome: formData.nome,
              telefone: formData.telefone,
              email: formData.email || null,
              user_id: formData.user_id,
              percentual_comissao: parseFloat(formData.percentual_comissao) || 0,
              codigo: "temp",
            } as any);

          if (vendedorError) throw vendedorError;

          toast({
            title: "Consultor cadastrado!",
            description: "Usuário existente vinculado ao Portal do Consultor.",
          });

          fetchUsers();
        } else {
          // CRIAR ACESSO DIRETO (fallback)
          setCreatingUser(true);
          
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error("Sessão inválida. Faça login novamente.");
          }
          
          const { data: userResult, error: userError } = await supabase.functions.invoke(
            "create-vendedor-user",
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              body: {
                email: formData.email,
                password: formData.senha,
                nome: formData.nome,
                role: "consultor",
              },
            }
          );

          if (userError) {
            const parsed = await parseInvokeError(userError);
            const msg = parsed.message || "Erro ao criar usuário";

            if (isEmailAlreadyRegisteredError(msg)) {
              setFormData((prev) => ({ ...prev, tipoAcesso: "vincular", senha: "" }));
              toast({
                title: "E-mail já cadastrado",
                description:
                  "Esse e-mail já existe no sistema. Selecione 'Vincular usuário existente' e escolha o usuário na lista.",
                variant: "destructive",
              });
              return;
            }

            throw new Error(msg);
          }

          if (userResult?.error) {
            const msg = String(userResult.error);
            if (isEmailAlreadyRegisteredError(msg)) {
              setFormData((prev) => ({ ...prev, tipoAcesso: "vincular", senha: "" }));
              toast({
                title: "E-mail já cadastrado",
                description:
                  "Esse e-mail já existe no sistema. Selecione 'Vincular usuário existente' e escolha o usuário na lista.",
                variant: "destructive",
              });
              return;
            }
            throw new Error(msg);
          }

          const newUserId = userResult?.user_id;
          
          const { error: vendedorError } = await supabase
            .from("consultores")
            .insert({
              nome: formData.nome,
              telefone: formData.telefone,
              email: formData.email,
              user_id: newUserId,
              percentual_comissao: parseFloat(formData.percentual_comissao) || 0,
              codigo: "temp",
            } as any);

          if (vendedorError) throw vendedorError;
          
          toast({ 
            title: "Consultor cadastrado!", 
            description: `Acesso criado para ${formData.email}`,
          });
          
          fetchUsers();
        }
      }

      setIsDialogOpen(false);
      setEditingVendedor(null);
      setFormData({ nome: "", telefone: "", email: "", user_id: "", senha: "", tipoAcesso: "convite", percentual_comissao: "2" });
      fetchVendedores();
    } catch (error: any) {
      console.error("Erro ao salvar vendedor:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o consultor.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setCreatingUser(false);
    }
  };

  const handleToggleAtivo = async (vendedor: Vendedor) => {
    try {
      const { error } = await supabase
        .from("consultores")
        .update({ ativo: !vendedor.ativo })
        .eq("id", vendedor.id);

      if (error) throw error;
      
      setVendedores(prev => 
        prev.map(v => v.id === vendedor.id ? { ...v, ativo: !v.ativo } : v)
      );
      
      toast({
        title: vendedor.ativo ? "Consultor desativado" : "Consultor ativado",
        description: vendedor.ativo 
          ? "O link do consultor não funcionará mais." 
          : "O link do consultor está ativo novamente.",
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!vendedorToDelete) return;

    try {
      const { error } = await supabase
        .from("consultores")
        .delete()
        .eq("id", vendedorToDelete.id);

      if (error) throw error;
      
      setVendedores(prev => prev.filter(v => v.id !== vendedorToDelete.id));
      toast({ title: "Consultor excluído!" });
    } catch (error) {
      console.error("Erro ao excluir vendedor:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o consultor.",
        variant: "destructive",
      });
    } finally {
      setIsDeleteOpen(false);
      setVendedorToDelete(null);
    }
  };

  const copyLink = async (vendedor: Vendedor) => {
    // Use configurable domain for vendor links
    const link = `${getPublicUrl()}/v/${vendedor.slug || vendedor.codigo}`;
    
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(vendedor.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "Link copiado!" });
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Copie manualmente: " + link,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (vendedor: Vendedor) => {
    setEditingVendedor(vendedor);
    setFormData({
      nome: vendedor.nome,
      telefone: vendedor.telefone,
      email: vendedor.email || "",
      user_id: vendedor.user_id || "",
      senha: "",
      tipoAcesso: "criar",
      percentual_comissao: String(vendedor.percentual_comissao ?? 2),
    });
    setShowPassword(false);
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingVendedor(null);
    setFormData({ nome: "", telefone: "", email: "", user_id: "", senha: "", tipoAcesso: "convite", percentual_comissao: "2" });
    setShowPassword(false);
    setIsDialogOpen(true);
  };

  // Get user name by user_id
  const getUserName = (userId: string | null) => {
    if (!userId) return null;
    const user = users.find(u => u.user_id === userId);
    return user?.nome;
  };

  // ── Filtered & paginated data ────────────────────────────
  const filteredVendedores = useMemo(() => {
    return vendedores.filter((v) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches =
          v.nome.toLowerCase().includes(term) ||
          v.telefone.includes(searchTerm) ||
          v.email?.toLowerCase().includes(term);
        if (!matches) return false;
      }
      if (filterStatus !== "todos") {
        if (filterStatus === "ativo" && !v.ativo) return false;
        if (filterStatus === "inativo" && v.ativo) return false;
      }
      return true;
    });
  }, [vendedores, searchTerm, filterStatus]);

  const paginatedVendedores = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredVendedores.slice(start, start + pageSize);
  }, [filteredVendedores, page, pageSize]);

  const handleSearchChange = useCallback((v: string) => { setSearchTerm(v); setPage(1); }, []);
  const handleFilterStatus = useCallback((v: string) => { setFilterStatus(v); setPage(1); }, []);

  const activeFilterCount = (filterStatus !== "todos" ? 1 : 0);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setFilterStatus("todos");
    setPage(1);
  }, []);

  const handleExportCSV = useCallback(() => {
    if (filteredVendedores.length === 0) return;
    const headers = ["Nome", "Telefone", "E-mail", "Código", "Comissão %", "Ativo", "Vinculado"];
    const rows = filteredVendedores.map((v) => [
      v.nome,
      v.telefone,
      v.email || "",
      v.codigo,
      String(v.percentual_comissao ?? 0),
      v.ativo ? "Sim" : "Não",
      v.user_id ? "Sim" : "Não",
    ]);
    const csvContent = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    a.download = `consultores_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${filteredVendedores.length} consultores exportados` });
  }, [filteredVendedores, toast]);

  const activeCount = vendedores.filter(v => v.ativo).length;
  const inactiveCount = vendedores.filter(v => !v.ativo).length;
  const linkedCount = vendedores.filter(v => v.user_id).length;

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      {/* §26 Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Consultores</h1>
            <p className="text-sm text-muted-foreground">Gerencie consultores, links e acessos ao portal</p>
          </div>
        </div>
        <Button onClick={openNewDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Consultor
        </Button>
      </div>

      {/* §27 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{vendedores.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-success bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{activeCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-warning bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
              <EyeOff className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{inactiveCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Inativos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-info bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{linkedCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Vinculados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* §4 Table */}
      {vendedores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum consultor cadastrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Cadastre o primeiro consultor para começar</p>
          <Button onClick={openNewDialog} variant="outline" className="mt-4 gap-2">
            <Plus className="w-4 h-4" />
            Cadastrar primeiro consultor
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Nome</TableHead>
                <TableHead className="font-semibold text-foreground">Contato</TableHead>
                <TableHead className="font-semibold text-foreground">Usuário Vinculado</TableHead>
                <TableHead className="font-semibold text-foreground">Comissão</TableHead>
                <TableHead className="font-semibold text-foreground">Leads</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground">Link</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendedores.map((vendedor) => (
                <TableRow key={vendedor.id} className={cn("hover:bg-muted/30 transition-colors", !vendedor.ativo && "opacity-50")}>
                  <TableCell className="font-medium text-foreground">{vendedor.nome}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm text-foreground">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        {vendedor.telefone}
                      </div>
                      {vendedor.email && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          {vendedor.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {vendedor.user_id ? (
                      <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/20">
                        <UserCheck className="w-3 h-3" />
                        {getUserName(vendedor.user_id) || "Vinculado"}
                      </Badge>
                    ) : vendedor.email ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        disabled={generatingInvite === vendedor.id}
                        onClick={() => generateInvite(vendedor.id, vendedor.email!, vendedor.telefone)}
                      >
                        {generatingInvite === vendedor.id ? (
                          <Spinner size="sm" />
                        ) : (
                          <TicketCheck className="w-3 h-3" />
                        )}
                        Enviar Convite
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {vendedor.percentual_comissao ?? 0}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const count = leadCounts[vendedor.nome.toLowerCase()] || 0;
                      const badgeCls = count === 0
                        ? "bg-muted text-muted-foreground border-border"
                        : count <= 10
                          ? "bg-warning/10 text-warning border-warning/20"
                          : "bg-success/10 text-success border-success/20";
                      return (
                        <Badge variant="outline" className={`text-xs rounded-full ${badgeCls}`}>
                          {count} leads
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {/* §28 Switch with padding, no overflow-hidden */}
                    <div className="flex items-center gap-2 px-1">
                      <Switch
                        checked={vendedor.ativo}
                        onCheckedChange={() => handleToggleAtivo(vendedor)}
                      />
                      <span className={`text-sm ${vendedor.ativo ? "text-success" : "text-muted-foreground"}`}>
                        {vendedor.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(vendedor)}
                      className="gap-2"
                      disabled={!vendedor.ativo}
                    >
                      {copiedId === vendedor.id ? (
                        <Check className="w-3 h-3 text-success" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copiedId === vendedor.id ? "Copiado!" : "Copiar"}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(vendedor)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setVendedorToDelete(vendedor);
                          setIsDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <FormModalTemplate
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingVendedor ? "Editar Consultor" : "Novo Consultor"}
        icon={UserCheck}
        subtitle="Cadastre ou edite um consultor"
        onSubmit={handleSave}
        submitLabel={saving && creatingUser 
          ? "Criando acesso..." 
          : editingVendedor 
            ? "Salvar" 
            : "Cadastrar"}
        saving={saving}
      >
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: formatName(e.target.value) }))}
                placeholder="Nome do consultor"
                maxLength={100}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone *</Label>
                <PhoneInput
                  id="telefone"
                  value={formData.telefone}
                  onChange={(raw) => setFormData(prev => ({ ...prev, telefone: raw }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentual_comissao">Comissão (%)</Label>
                <Input
                  id="percentual_comissao"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.percentual_comissao}
                  onChange={(e) => setFormData(prev => ({ ...prev, percentual_comissao: e.target.value }))}
                  placeholder="2.0"
                />
                <p className="text-xs text-muted-foreground">
                  Percentual de comissão sobre vendas deste vendedor.
                </p>
              </div>
            </div>
            {/* Tipo de acesso */}
            {isNewVendedor && (
              <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
                <Label>Tipo de Acesso ao Portal *</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tipoAcesso" value="convite" checked={formData.tipoAcesso === "convite"} onChange={() => setFormData(prev => ({ ...prev, tipoAcesso: "convite", user_id: "", senha: "" }))} className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Enviar convite</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tipoAcesso" value="criar" checked={formData.tipoAcesso === "criar"} onChange={() => setFormData(prev => ({ ...prev, tipoAcesso: "criar", user_id: "" }))} className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground">Criar com senha</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tipoAcesso" value="vincular" checked={formData.tipoAcesso === "vincular"} onChange={() => setFormData(prev => ({ ...prev, tipoAcesso: "vincular", email: "", senha: "" }))} className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground">Vincular existente</span>
                  </label>
                </div>
                {formData.tipoAcesso === "convite" && (
                  <p className="text-xs text-muted-foreground">
                    <TicketCheck className="w-3 h-3 inline mr-1" />
                    O vendedor receberá um link para criar sua própria senha. Recomendado.
                  </p>
                )}
              </div>
            )}

            {/* Email para convite */}
            {isNewVendedor && formData.tipoAcesso === "convite" && (
              <div className="space-y-2">
                <Label htmlFor="email">Email do consultor *</Label>
                <EmailInput id="email" value={formData.email} onChange={(v) => setFormData(prev => ({ ...prev, email: v }))} required blockDisposable />
                <p className="text-xs text-muted-foreground"><Mail className="w-3 h-3 inline mr-1" />Será usado para login após ativação do convite.</p>
              </div>
            )}

            {/* Campos para CRIAR NOVO ACESSO */}
            {isNewVendedor && formData.tipoAcesso === "criar" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <EmailInput id="email" value={formData.email} onChange={(v) => setFormData(prev => ({ ...prev, email: v }))} required blockDisposable />
                  <p className="text-xs text-muted-foreground"><Mail className="w-3 h-3 inline mr-1" />Será usado para login no Portal do Consultor.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha *</Label>
                  <div className="relative">
                    <Input id="senha" type={showPassword ? "text" : "password"} value={formData.senha} onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" className="pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground"><KeyRound className="w-3 h-3 inline mr-1" />Senha padrão que o consultor usará para acessar.</p>
                </div>
              </>
            )}

            {/* Vincular existente */}
            {isNewVendedor && formData.tipoAcesso === "vincular" && (
              <div className="space-y-2">
                <Label htmlFor="user_id">Usuário *</Label>
                <Select value={formData.user_id} onValueChange={(value) => setFormData((prev) => ({ ...prev, user_id: value }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione um usuário..." /></SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>{user.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground"><UserCheck className="w-3 h-3 inline mr-1" />Escolha um usuário que já existe no sistema.</p>
              </div>
            )}

            {/* Email para edição */}
            {editingVendedor && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <EmailInput id="email" value={formData.email} onChange={(v) => setFormData(prev => ({ ...prev, email: v }))} disabled={!!editingVendedor?.user_id} />
              </div>
            )}
            
            {/* Vincular/Alterar/Desvincular usuário - edição */}
            {editingVendedor && (
              <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label>Usuário Vinculado</Label>
                  {formData.user_id && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setFormData(prev => ({ ...prev, user_id: "" }))} className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 h-7">
                      <Unlink className="w-3 h-3" />Desvincular
                    </Button>
                  )}
                </div>
                {formData.user_id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded bg-background border border-border">
                      <UserCheck className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{getUserName(formData.user_id) || "Usuário vinculado"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Este usuário pode acessar o Portal do Consultor. Para alterar, primeiro desvincule.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Select value={formData.user_id || "none"} onValueChange={(value) => setFormData(prev => ({ ...prev, user_id: value === "none" ? "" : value }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione um usuário..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum (sem acesso ao portal)</SelectItem>
                        {availableUsers.map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>{user.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground"><UserCheck className="w-3 h-3 inline mr-1" />Vincular permite que o usuário acesse o Portal do Consultor.</p>
                  </div>
                )}
              </div>
            )}
            
            {isNewVendedor && (
              <p className="text-sm text-muted-foreground">
                <LinkIcon className="w-3 h-3 inline mr-1" />
                O link único será gerado automaticamente após o cadastro.
              </p>
            )}

            {/* Horário Individual do Consultor */}
            {editingVendedor && (
              <ConsultorHorariosEdit consultorId={editingVendedor.id} />
            )}

            {/* WhatsApp Auto-Message Settings */}
            {editingVendedor && (
              <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">WhatsApp Automático</p>
                <WaAutoMessageToggle vendedorId={editingVendedor.id} />
              </div>
            )}
      </FormModalTemplate>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Consultor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {vendedorToDelete?.nome}? 
              O link deixará de funcionar. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="border-destructive text-destructive hover:bg-destructive/10 border bg-transparent"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite Link Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <TicketCheck className="w-5 h-5 text-primary" />
              Convite Gerado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Envie este link ao consultor para que ele ative sua conta. O link expira em 48 horas.
            </p>
            <div className="flex gap-2">
              <Input value={inviteLink || ""} readOnly className="text-xs font-mono" />
              <Button variant="outline" size="icon" onClick={copyInviteLink}>
                {inviteCopied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setInviteDialogOpen(false)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                const v = vendedores.find(v => inviteLink?.includes(v.id)) || vendedores[vendedores.length - 1];
                if (v) sendInviteViaWhatsApp(v.telefone);
              }}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              Enviar via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
