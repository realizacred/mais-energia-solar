import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, Edit2, Loader2, Building2, Percent, CreditCard, RefreshCw, GripVertical, Check, Clock, AlertCircle, Globe } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Banco {
  id: string;
  nome: string;
  taxa_mensal: number;
  max_parcelas: number;
  ativo: boolean;
  ordem: number;
  fonte_sync: string | null;
  ultima_sync: string | null;
  codigo_bcb: string | null;
  api_customizada_url: string | null;
}

export default function FinanciamentoConfig() {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingBankId, setSyncingBankId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingBanco, setEditingBanco] = useState<Banco | null>(null);
  const [bancoToDelete, setBancoToDelete] = useState<Banco | null>(null);
  
  const [formData, setFormData] = useState({
    nome: "",
    taxa_mensal: "",
    max_parcelas: "60",
    codigo_bcb: "",
    api_customizada_url: "",
  });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("financiamento_bancos")
        .select("*")
        .order("ordem");

      if (error) throw error;
      setBancos((data as Banco[]) || []);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBanco = async () => {
    if (!formData.nome.trim() || !formData.taxa_mensal) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome e taxa mensal.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const taxa = parseFloat(formData.taxa_mensal.replace(",", "."));
      const parcelas = parseInt(formData.max_parcelas);

      if (isNaN(taxa) || taxa <= 0 || taxa > 10) {
        throw new Error("Taxa inválida (deve ser entre 0.01 e 10%)");
      }

      const updateData = {
        nome: formData.nome,
        taxa_mensal: taxa,
        max_parcelas: parcelas,
        codigo_bcb: formData.codigo_bcb || null,
        api_customizada_url: formData.api_customizada_url || null,
        fonte_sync: 'manual' as const,
      };

      if (editingBanco) {
        const { error } = await supabase
          .from("financiamento_bancos")
          .update(updateData)
          .eq("id", editingBanco.id);

        if (error) throw error;
        toast({ title: "Banco atualizado!" });
      } else {
        const maxOrdem = bancos.length > 0 ? Math.max(...bancos.map(b => b.ordem)) : 0;
        const { error } = await supabase
          .from("financiamento_bancos")
          .insert({
            ...updateData,
            ordem: maxOrdem + 1,
          });

        if (error) throw error;
        toast({ title: "Banco cadastrado!" });
      }

      setIsDialogOpen(false);
      setEditingBanco(null);
      setFormData({ nome: "", taxa_mensal: "", max_parcelas: "60", codigo_bcb: "", api_customizada_url: "" });
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar banco:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o banco.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAtivo = async (banco: Banco) => {
    try {
      const { error } = await supabase
        .from("financiamento_bancos")
        .update({ ativo: !banco.ativo })
        .eq("id", banco.id);

      if (error) throw error;
      
      setBancos(prev => 
        prev.map(b => b.id === banco.id ? { ...b, ativo: !b.ativo } : b)
      );
      
      toast({
        title: banco.ativo ? "Banco desativado" : "Banco ativado",
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
    if (!bancoToDelete) return;

    try {
      const { error } = await supabase
        .from("financiamento_bancos")
        .delete()
        .eq("id", bancoToDelete.id);

      if (error) throw error;
      
      setBancos(prev => prev.filter(b => b.id !== bancoToDelete.id));
      toast({ title: "Banco excluído!" });
    } catch (error) {
      console.error("Erro ao excluir banco:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o banco.",
        variant: "destructive",
      });
    } finally {
      setIsDeleteOpen(false);
      setBancoToDelete(null);
    }
  };

  const handleSyncBCB = async (bankId?: string) => {
    if (bankId) {
      setSyncingBankId(bankId);
    } else {
      setSyncingAll(true);
    }

    try {
      const { data, error } = await supabase.functions.invoke('sync-taxas-bcb', {
        body: bankId ? { bank_id: bankId } : undefined,
      });

      if (error) throw error;

      if (data?.success) {
        const resultCount = data.resultados?.length || 0;
        const errorCount = data.erros?.length || 0;
        
        let description = "";
        if (resultCount > 0) {
          const bancosSincronizados = data.resultados.map((r: any) => `${r.banco} (${r.taxa_nova}%)`).join(", ");
          description = `Sincronizados: ${bancosSincronizados}`;
        }
        if (errorCount > 0) {
          const bancosComErro = data.erros.map((e: any) => e.banco).join(", ");
          description += description ? `\n\nNão encontrados: ${bancosComErro}` : `Não encontrados: ${bancosComErro}`;
        }

        toast({ 
          title: resultCount > 0 ? "Sincronização concluída!" : "Nenhum banco sincronizado",
          description: description || "Verifique se os códigos BCB estão configurados.",
          variant: resultCount > 0 ? "default" : "destructive",
        });
        fetchData();
      } else {
        throw new Error(data?.error || "Erro na sincronização");
      }
    } catch (error: any) {
      console.error("Erro ao sincronizar:", error);
      toast({
        title: "Erro na sincronização",
        description: error.message || "Não foi possível conectar à API do Banco Central.",
        variant: "destructive",
      });
    } finally {
      setSyncingBankId(null);
      setSyncingAll(false);
    }
  };

  const handleSyncCustomApi = async (banco: Banco) => {
    if (!banco.api_customizada_url) {
      toast({
        title: "URL não configurada",
        description: "Configure a URL da API customizada para este banco.",
        variant: "destructive",
      });
      return;
    }

    setSyncingBankId(banco.id);
    try {
      const response = await fetch(banco.api_customizada_url);

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const data = await response.json();
      
      // Espera { taxa_mensal: number } ou { rate: number }
      const novaTaxa = data.taxa_mensal || data.rate || data.taxa;
      
      if (typeof novaTaxa !== 'number' || novaTaxa <= 0) {
        throw new Error("Formato de resposta inválido. Esperado: { taxa_mensal: number }");
      }

      const { error } = await supabase
        .from("financiamento_bancos")
        .update({ 
          taxa_mensal: novaTaxa,
          fonte_sync: 'api_customizada',
          ultima_sync: new Date().toISOString(),
        })
        .eq("id", banco.id);

      if (error) throw error;

      toast({ 
        title: "Taxa atualizada!",
        description: `${banco.nome}: ${novaTaxa.toFixed(2)}% a.m.`,
      });
      fetchData();
    } catch (error: any) {
      console.error("Erro ao sincronizar:", error);
      toast({
        title: "Erro na sincronização",
        description: error.message || "Não foi possível conectar à API.",
        variant: "destructive",
      });
    } finally {
      setSyncingBankId(null);
    }
  };

  const openEditDialog = (banco: Banco) => {
    setEditingBanco(banco);
    setFormData({
      nome: banco.nome,
      taxa_mensal: banco.taxa_mensal.toString(),
      max_parcelas: banco.max_parcelas.toString(),
      codigo_bcb: banco.codigo_bcb || "",
      api_customizada_url: banco.api_customizada_url || "",
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingBanco(null);
    setFormData({ nome: "", taxa_mensal: "", max_parcelas: "60", codigo_bcb: "", api_customizada_url: "" });
    setIsDialogOpen(true);
  };

  const getFonteSyncBadge = (banco: Banco) => {
    if (!banco.fonte_sync || banco.fonte_sync === 'manual') {
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Edit2 className="w-3 h-3" />
          Manual
        </Badge>
      );
    }
    if (banco.fonte_sync === 'bcb') {
      return (
        <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
          <Check className="w-3 h-3" />
          BCB
        </Badge>
      );
    }
    if (banco.fonte_sync === 'api_customizada') {
      return (
        <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
          <Globe className="w-3 h-3" />
          API
        </Badge>
      );
    }
    return null;
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
    <div className="space-y-6">
      {/* Header with Sync All Button */}
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <RefreshCw className="w-5 h-5" />
                Sincronização Automática
              </CardTitle>
              <CardDescription>
                Atualize as taxas de todos os bancos configurados com código BCB
              </CardDescription>
            </div>
            <Button
              onClick={() => handleSyncBCB()}
              disabled={syncingAll || !!syncingBankId}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {syncingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Sincronizar Todos com BCB
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Bancos Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-brand-blue">
                <Building2 className="w-5 h-5" />
                Bancos e Taxas
              </CardTitle>
              <CardDescription>
                Configure os bancos, códigos BCB e APIs customizadas
              </CardDescription>
            </div>
            <Button onClick={openNewDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Banco
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bancos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Nenhum banco cadastrado</p>
              <Button onClick={openNewDialog} variant="outline" className="mt-4">
                Cadastrar primeiro banco
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Taxa Mensal</TableHead>
                    <TableHead>Máx. Parcelas</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead>Última Sync</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bancos.map((banco) => (
                    <TableRow key={banco.id} className={!banco.ativo ? "opacity-50" : ""}>
                      <TableCell>
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{banco.nome}</p>
                          {banco.codigo_bcb && (
                            <p className="text-xs text-muted-foreground">BCB: {banco.codigo_bcb}</p>
                          )}
                          {banco.api_customizada_url && (
                            <p className="text-xs text-blue-600 truncate max-w-[150px]">
                              API: {banco.api_customizada_url}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/20">
                          <Percent className="w-3 h-3 mr-1" />
                          {banco.taxa_mensal.toFixed(2)}% a.m.
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          <CreditCard className="w-3 h-3 mr-1" />
                          {banco.max_parcelas}x
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getFonteSyncBadge(banco)}
                      </TableCell>
                      <TableCell>
                        {banco.ultima_sync ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(banco.ultima_sync), "dd/MM HH:mm", { locale: ptBR })}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {format(new Date(banco.ultima_sync), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={banco.ativo}
                            onCheckedChange={() => handleToggleAtivo(banco)}
                          />
                          <span className={`text-sm ${banco.ativo ? "text-green-600" : "text-muted-foreground"}`}>
                            {banco.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {banco.codigo_bcb && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSyncBCB(banco.id)}
                                    disabled={syncingBankId === banco.id}
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  >
                                    {syncingBankId === banco.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Sincronizar com BCB</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {banco.api_customizada_url && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSyncCustomApi(banco)}
                                    disabled={syncingBankId === banco.id}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    {syncingBankId === banco.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Globe className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Sincronizar com API customizada</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(banco)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setBancoToDelete(banco);
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

      {/* Legenda */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Edit2 className="w-3 h-3" />
                Manual
              </Badge>
              <span className="text-muted-foreground">Taxa inserida manualmente</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
                <Check className="w-3 h-3" />
                BCB
              </Badge>
              <span className="text-muted-foreground">Sincronizado com Banco Central</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
                <Globe className="w-3 h-3" />
                API
              </Badge>
              <span className="text-muted-foreground">Sincronizado com API customizada</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBanco ? "Editar Banco" : "Novo Banco"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Banco *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Santander Solar"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxa">Taxa Mensal (%) *</Label>
                <Input
                  id="taxa"
                  value={formData.taxa_mensal}
                  onChange={(e) => setFormData(prev => ({ ...prev, taxa_mensal: e.target.value }))}
                  placeholder="Ex: 1.29"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parcelas">Máx. Parcelas</Label>
                <Input
                  id="parcelas"
                  type="number"
                  value={formData.max_parcelas}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_parcelas: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-3">Sincronização Automática (Opcional)</p>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo_bcb" className="flex items-center gap-2">
                    Código BCB
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertCircle className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Código da instituição no Banco Central. Ex: 033 (Santander), 001 (BB), 104 (Caixa)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="codigo_bcb"
                    value={formData.codigo_bcb}
                    onChange={(e) => setFormData(prev => ({ ...prev, codigo_bcb: e.target.value }))}
                    placeholder="Ex: 033"
                    maxLength={5}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="api_url" className="flex items-center gap-2">
                    URL da API Customizada
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertCircle className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>URL que retorna JSON com taxa_mensal. Ex: {"{ taxa_mensal: 1.29 }"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="api_url"
                    value={formData.api_customizada_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, api_customizada_url: e.target.value }))}
                    placeholder="https://api.exemplo.com/taxa"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveBanco} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingBanco ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir banco?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O banco "{bancoToDelete?.nome}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
