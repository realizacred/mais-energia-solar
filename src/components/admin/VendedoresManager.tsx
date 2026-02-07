import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatPhone, formatName } from "@/lib/validations";
import { isEmailAlreadyRegisteredError, parseInvokeError } from "@/lib/supabaseFunctionError";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Copy, Check, Trash2, Edit2, Users, Link as LinkIcon, Phone, Mail, Loader2, UserCheck, Eye, EyeOff, KeyRound, Unlink } from "lucide-react";

interface Vendedor {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  codigo: string;
  ativo: boolean;
  user_id: string | null;
  created_at: string;
}

interface UserProfile {
  user_id: string;
  nome: string;
}

interface VendedoresManagerProps {
  leads: { vendedor: string | null }[];
}

export default function VendedoresManager({ leads }: VendedoresManagerProps) {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null);
  const [vendedorToDelete, setVendedorToDelete] = useState<Vendedor | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nome: "", telefone: "", email: "", user_id: "", senha: "", tipoAcesso: "criar" as "criar" | "vincular" });
  const [showPassword, setShowPassword] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const isNewVendedor = !editingVendedor;
  const isLinkingExistingUser = isNewVendedor && formData.tipoAcesso === "vincular";

  // Count leads per vendedor (by nome, case-insensitive)
  const leadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(lead => {
      if (lead.vendedor) {
        const normalizedName = lead.vendedor.toLowerCase();
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
        .from("vendedores")
        .select("*")
        .order("nome");

      if (error) throw error;
      setVendedores(data || []);
    } catch (error) {
      console.error("Erro ao buscar vendedores:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os vendedores.",
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
      if (isLinkingExistingUser) {
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
            description: "Preencha email e senha para criar o acesso do vendedor.",
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
          .from("vendedores")
          .update({
            nome: formData.nome,
            telefone: formData.telefone,
            email: formData.email || null,
            user_id: formData.user_id || null,
          })
          .eq("id", editingVendedor.id);

        if (error) throw error;
        toast({ title: "Vendedor atualizado!" });
      } else {
        // If linking an existing user, skip user creation
        if (isLinkingExistingUser) {
          const { error: vendedorError } = await supabase
            .from("vendedores")
            .insert({
              nome: formData.nome,
              telefone: formData.telefone,
              email: formData.email || null,
              user_id: formData.user_id,
              codigo: "temp", // Will be overwritten by trigger
            } as any);

          if (vendedorError) throw vendedorError;

          toast({
            title: "Vendedor cadastrado!",
            description: "Usuário existente vinculado ao Portal do Vendedor.",
          });

          // Refresh users list
          fetchUsers();
        } else {
        // Create user account first
        setCreatingUser(true);
        
        // Get current session to pass auth token
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
              role: "vendedor",
            },
          }
        );

        if (userError) {
          const parsed = await parseInvokeError(userError);
          const msg = parsed.message || "Erro ao criar usuário";

          if (isEmailAlreadyRegisteredError(msg)) {
            // Mantém o modal aberto e guia o usuário pro fluxo correto.
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
        
        // Create vendedor with the new user_id
        const { error: vendedorError } = await supabase
          .from("vendedores")
          .insert({
            nome: formData.nome,
            telefone: formData.telefone,
            email: formData.email,
            user_id: newUserId,
            codigo: "temp", // Will be overwritten by trigger
          } as any);

        if (vendedorError) throw vendedorError;
        
        toast({ 
          title: "Vendedor cadastrado!", 
          description: `Acesso criado para ${formData.email}`,
        });
        
        // Refresh users list
        fetchUsers();
        }
      }

      setIsDialogOpen(false);
      setEditingVendedor(null);
      setFormData({ nome: "", telefone: "", email: "", user_id: "", senha: "", tipoAcesso: "criar" });
      fetchVendedores();
    } catch (error: any) {
      console.error("Erro ao salvar vendedor:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o vendedor.",
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
        .from("vendedores")
        .update({ ativo: !vendedor.ativo })
        .eq("id", vendedor.id);

      if (error) throw error;
      
      setVendedores(prev => 
        prev.map(v => v.id === vendedor.id ? { ...v, ativo: !v.ativo } : v)
      );
      
      toast({
        title: vendedor.ativo ? "Vendedor desativado" : "Vendedor ativado",
        description: vendedor.ativo 
          ? "O link do vendedor não funcionará mais." 
          : "O link do vendedor está ativo novamente.",
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
        .from("vendedores")
        .delete()
        .eq("id", vendedorToDelete.id);

      if (error) throw error;
      
      setVendedores(prev => prev.filter(v => v.id !== vendedorToDelete.id));
      toast({ title: "Vendedor excluído!" });
    } catch (error) {
      console.error("Erro ao excluir vendedor:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o vendedor.",
        variant: "destructive",
      });
    } finally {
      setIsDeleteOpen(false);
      setVendedorToDelete(null);
    }
  };

  const copyLink = async (vendedor: Vendedor) => {
    // Always use the published URL for vendor links
    const baseUrl = "https://maisenergiasolar.lovable.app";
    const link = `${baseUrl}/?v=${vendedor.codigo}`;
    
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
    });
    setShowPassword(false);
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingVendedor(null);
    setFormData({ nome: "", telefone: "", email: "", user_id: "", senha: "", tipoAcesso: "criar" });
    setShowPassword(false);
    setIsDialogOpen(true);
  };

  // Get user name by user_id
  const getUserName = (userId: string | null) => {
    if (!userId) return null;
    const user = users.find(u => u.user_id === userId);
    return user?.nome;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-brand-blue">
              <Users className="w-5 h-5" />
              Vendedores ({vendedores.length})
            </CardTitle>
            <Button onClick={openNewDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Vendedor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {vendedores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Nenhum vendedor cadastrado</p>
              <Button onClick={openNewDialog} variant="outline" className="mt-4">
                Cadastrar primeiro vendedor
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Usuário Vinculado</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendedores.map((vendedor) => (
                    <TableRow key={vendedor.id} className={!vendedor.ativo ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{vendedor.nome}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
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
                          <Badge variant="secondary" className="gap-1">
                            <UserCheck className="w-3 h-3" />
                            {getUserName(vendedor.user_id) || "Vinculado"}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          {leadCounts[vendedor.nome.toLowerCase()] || 0} leads
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={vendedor.ativo}
                            onCheckedChange={() => handleToggleAtivo(vendedor)}
                          />
                          <span className={`text-sm ${vendedor.ativo ? "text-green-600" : "text-muted-foreground"}`}>
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
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          {copiedId === vendedor.id ? "Copiado!" : "Copiar"}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(vendedor)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVendedor ? "Editar Vendedor" : "Novo Vendedor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: formatName(e.target.value) }))}
                placeholder="Nome do vendedor"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData(prev => ({ ...prev, telefone: formatPhone(e.target.value) }))}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>
            {/* Tipo de acesso - escolha entre criar novo ou vincular existente */}
            {isNewVendedor && (
              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <Label>Tipo de Acesso ao Portal *</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoAcesso"
                      value="criar"
                      checked={formData.tipoAcesso === "criar"}
                      onChange={() => setFormData(prev => ({ ...prev, tipoAcesso: "criar", user_id: "" }))}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-sm">Criar acesso novo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoAcesso"
                      value="vincular"
                      checked={formData.tipoAcesso === "vincular"}
                      onChange={() => setFormData(prev => ({ ...prev, tipoAcesso: "vincular", email: "", senha: "" }))}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-sm">Vincular usuário existente</span>
                  </label>
                </div>
              </div>
            )}

            {/* Campos para CRIAR NOVO ACESSO */}
            {isNewVendedor && formData.tipoAcesso === "criar" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    <Mail className="w-3 h-3 inline mr-1" />
                    Será usado para login no Portal do Vendedor.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha *</Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={showPassword ? "text" : "password"}
                      value={formData.senha}
                      onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <KeyRound className="w-3 h-3 inline mr-1" />
                    Senha padrão que o vendedor usará para acessar.
                  </p>
                </div>
              </>
            )}

            {/* Campos para VINCULAR USUÁRIO EXISTENTE */}
            {isNewVendedor && formData.tipoAcesso === "vincular" && (
              <div className="space-y-2">
                <Label htmlFor="user_id">Usuário *</Label>
                <Select
                  value={formData.user_id}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, user_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  <UserCheck className="w-3 h-3 inline mr-1" />
                  Escolha um usuário que já existe no sistema.
                </p>
              </div>
            )}

            {/* Email para edição (readonly quando já tem user vinculado) */}
            {editingVendedor && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  disabled={!!editingVendedor?.user_id}
                />
              </div>
            )}
            
            {/* Vincular/Alterar/Desvincular usuário - edição */}
            {editingVendedor && (
              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label>Usuário Vinculado</Label>
                  {formData.user_id && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, user_id: "" }))}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 h-7"
                    >
                      <Unlink className="w-3 h-3" />
                      Desvincular
                    </Button>
                  )}
                </div>
                
                {formData.user_id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded bg-background border">
                      <UserCheck className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{getUserName(formData.user_id) || "Usuário vinculado"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Este usuário pode acessar o Portal do Vendedor. Para alterar, primeiro desvincule.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Select
                      value={formData.user_id || "none"}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, user_id: value === "none" ? "" : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um usuário..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum (sem acesso ao portal)</SelectItem>
                        {availableUsers.map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            {user.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      <UserCheck className="w-3 h-3 inline mr-1" />
                      Vincular permite que o usuário acesse o Portal do Vendedor.
                    </p>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {saving && creatingUser 
                ? "Criando acesso..." 
                : editingVendedor 
                  ? "Salvar" 
                  : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Vendedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {vendedorToDelete?.nome}? 
              O link deixará de funcionar. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
