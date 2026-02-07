 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "@/hooks/use-toast";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from "@/components/ui/table";
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogFooter,
   DialogDescription,
 } from "@/components/ui/dialog";
 import { Badge } from "@/components/ui/badge";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import {
   Loader2,
   CheckCircle,
   XCircle,
   Eye,
   Clock,
   DollarSign,
   User,
   MapPin,
 } from "lucide-react";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 
 interface ClientePendente {
   id: string;
   nome: string;
   telefone: string;
   cidade: string | null;
   estado: string | null;
   created_at: string;
   lead_id: string | null;
   simulacao_aceita_id: string | null;
   leads?: {
     vendedor: string | null;
     lead_code: string | null;
   } | null;
   simulacoes?: {
     investimento_estimado: number | null;
     potencia_recomendada_kwp: number | null;
   } | null;
 }
 
 export function ValidacaoVendasManager() {
   const [clientesPendentes, setClientesPendentes] = useState<ClientePendente[]>([]);
   const [loading, setLoading] = useState(true);
   const [approving, setApproving] = useState<string | null>(null);
   const [selectedCliente, setSelectedCliente] = useState<ClientePendente | null>(null);
   const [detailsOpen, setDetailsOpen] = useState(false);
   const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
   
   // Approval form
   const [percentualComissao, setPercentualComissao] = useState("2.0");
 
   useEffect(() => {
     fetchPendentes();
   }, []);
 
   const fetchPendentes = async () => {
     setLoading(true);
     try {
       // Get "Aguardando Validação" status
       const { data: statusData } = await supabase
         .from("lead_status")
         .select("id")
         .eq("nome", "Aguardando Validação")
         .single();
 
       if (!statusData) {
         setClientesPendentes([]);
         return;
       }
 
       // Get leads with this status that have been converted to clients
       const { data: leads } = await supabase
         .from("leads")
         .select("id")
         .eq("status_id", statusData.id);
 
       if (!leads || leads.length === 0) {
         setClientesPendentes([]);
         return;
       }
 
       const leadIds = leads.map(l => l.id);
 
       // Get clients associated with these leads
       const { data, error } = await supabase
         .from("clientes")
         .select(`
           id,
           nome,
           telefone,
           cidade,
           estado,
           created_at,
           lead_id,
           simulacao_aceita_id,
           leads(vendedor, lead_code),
           simulacoes:simulacao_aceita_id(investimento_estimado, potencia_recomendada_kwp)
         `)
         .in("lead_id", leadIds)
         .order("created_at", { ascending: false });
 
       if (error) throw error;
       setClientesPendentes(data || []);
     } catch (error) {
       console.error("Error fetching pending sales:", error);
       toast({ title: "Erro ao carregar vendas pendentes", variant: "destructive" });
     } finally {
       setLoading(false);
     }
   };
 
   const handleApprove = async () => {
     if (!selectedCliente) return;
 
     setApproving(selectedCliente.id);
     try {
       // Get "Convertido" status
       const { data: convertidoStatus } = await supabase
         .from("lead_status")
         .select("id")
         .eq("nome", "Convertido")
         .single();
 
       if (!convertidoStatus) {
         throw new Error("Status 'Convertido' não encontrado");
       }
 
       // Update lead status to Convertido
       if (selectedCliente.lead_id) {
         await supabase
           .from("leads")
           .update({ status_id: convertidoStatus.id })
           .eq("id", selectedCliente.lead_id);
 
         // Also update orcamentos
         await supabase
           .from("orcamentos")
           .update({ status_id: convertidoStatus.id })
           .eq("lead_id", selectedCliente.lead_id);
       }
 
       // Create commission if we have simulation value and vendedor
       const valorBase = selectedCliente.simulacoes?.investimento_estimado || 0;
       const vendedorNome = selectedCliente.leads?.vendedor;
 
       if (valorBase > 0 && vendedorNome) {
         // Get vendedor_id
         const { data: vendedorData } = await supabase
           .from("vendedores")
           .select("id")
           .eq("nome", vendedorNome)
           .eq("ativo", true)
           .single();
 
         if (vendedorData) {
           const currentDate = new Date();
           const percentual = parseFloat(percentualComissao);
           const valorComissao = (valorBase * percentual) / 100;
 
           await supabase.from("comissoes").insert({
             vendedor_id: vendedorData.id,
             cliente_id: selectedCliente.id,
             descricao: `Venda - ${selectedCliente.nome} (${selectedCliente.simulacoes?.potencia_recomendada_kwp || 0}kWp)`,
             valor_base: valorBase,
             percentual_comissao: percentual,
             valor_comissao: valorComissao,
             mes_referencia: currentDate.getMonth() + 1,
             ano_referencia: currentDate.getFullYear(),
             status: "pendente",
           });
         }
       }
 
       toast({
         title: "Venda validada!",
         description: `Venda de ${selectedCliente.nome} foi aprovada e comissão gerada.`,
       });
 
       setApprovalDialogOpen(false);
       setSelectedCliente(null);
       fetchPendentes();
     } catch (error: any) {
       console.error("Error approving sale:", error);
       toast({
         title: "Erro ao validar venda",
         description: error.message,
         variant: "destructive",
       });
     } finally {
       setApproving(null);
     }
   };
 
   const handleReject = async (cliente: ClientePendente) => {
     if (!confirm(`Rejeitar a venda de ${cliente.nome}? O lead voltará para status anterior.`)) {
       return;
     }
 
     try {
       // Get "Negociação" status
       const { data: negociacaoStatus } = await supabase
         .from("lead_status")
         .select("id")
         .eq("nome", "Negociação")
         .single();
 
       if (negociacaoStatus && cliente.lead_id) {
         await supabase
           .from("leads")
           .update({ status_id: negociacaoStatus.id })
           .eq("id", cliente.lead_id);
 
         await supabase
           .from("orcamentos")
           .update({ status_id: negociacaoStatus.id })
           .eq("lead_id", cliente.lead_id);
       }
 
       // Remove client record
       await supabase.from("clientes").delete().eq("id", cliente.id);
 
       toast({
         title: "Venda rejeitada",
         description: `A venda de ${cliente.nome} foi rejeitada. O lead voltou para negociação.`,
       });
 
       fetchPendentes();
     } catch (error) {
       console.error("Error rejecting sale:", error);
       toast({ title: "Erro ao rejeitar venda", variant: "destructive" });
     }
   };
 
   const formatCurrency = (value: number) => {
     return new Intl.NumberFormat("pt-BR", {
       style: "currency",
       currency: "BRL",
     }).format(value);
   };
 
   const valorComissaoPreview = () => {
     const valorBase = selectedCliente?.simulacoes?.investimento_estimado || 0;
     const percentual = parseFloat(percentualComissao) || 0;
     return (valorBase * percentual) / 100;
   };
 
   if (loading) {
     return (
       <div className="flex items-center justify-center py-12">
         <Loader2 className="w-8 h-8 animate-spin text-primary" />
       </div>
     );
   }
 
   return (
     <div className="space-y-6">
       {/* Stats Card */}
       <Card>
         <CardContent className="pt-6">
           <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-amber-500/10">
               <Clock className="h-5 w-5 text-amber-600" />
             </div>
             <div>
               <p className="text-sm text-muted-foreground">Vendas Aguardando Validação</p>
               <p className="text-2xl font-bold">{clientesPendentes.length}</p>
             </div>
           </div>
         </CardContent>
       </Card>
 
       {/* Table */}
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <CheckCircle className="h-5 w-5" />
             Validar Vendas
           </CardTitle>
         </CardHeader>
         <CardContent>
           {clientesPendentes.length === 0 ? (
             <div className="text-center py-12 text-muted-foreground">
               <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
               <p>Nenhuma venda pendente de validação</p>
             </div>
           ) : (
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Cliente</TableHead>
                   <TableHead>Vendedor</TableHead>
                   <TableHead>Localização</TableHead>
                   <TableHead className="text-right">Valor Venda</TableHead>
                   <TableHead className="text-right">Comissão (2%)</TableHead>
                   <TableHead>Data</TableHead>
                   <TableHead className="w-40"></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {clientesPendentes.map((cliente) => {
                   const valorVenda = cliente.simulacoes?.investimento_estimado || 0;
                   const comissaoEstimada = (valorVenda * 2) / 100;
 
                   return (
                     <TableRow key={cliente.id}>
                       <TableCell>
                         <div>
                           <p className="font-medium">{cliente.nome}</p>
                           <p className="text-xs text-muted-foreground">
                             {cliente.leads?.lead_code || "-"}
                           </p>
                         </div>
                       </TableCell>
                       <TableCell>
                         <div className="flex items-center gap-2">
                           <User className="h-4 w-4 text-muted-foreground" />
                           {cliente.leads?.vendedor || "-"}
                         </div>
                       </TableCell>
                       <TableCell>
                         <div className="flex items-center gap-2">
                           <MapPin className="h-4 w-4 text-muted-foreground" />
                           {cliente.cidade}, {cliente.estado}
                         </div>
                       </TableCell>
                       <TableCell className="text-right font-medium">
                         {valorVenda > 0 ? formatCurrency(valorVenda) : "-"}
                       </TableCell>
                       <TableCell className="text-right text-green-600">
                         {comissaoEstimada > 0 ? formatCurrency(comissaoEstimada) : "-"}
                       </TableCell>
                       <TableCell>
                         {format(new Date(cliente.created_at), "dd/MM/yyyy", { locale: ptBR })}
                       </TableCell>
                       <TableCell>
                         <div className="flex items-center gap-1">
                           <Button
                             size="sm"
                             variant="ghost"
                             onClick={() => {
                               setSelectedCliente(cliente);
                               setDetailsOpen(true);
                             }}
                           >
                             <Eye className="h-4 w-4" />
                           </Button>
                           <Button
                             size="sm"
                             variant="default"
                            className="bg-emerald-600 hover:bg-emerald-700"
                             onClick={() => {
                               setSelectedCliente(cliente);
                               setPercentualComissao("2.0");
                               setApprovalDialogOpen(true);
                             }}
                           >
                             <CheckCircle className="h-4 w-4 mr-1" />
                             Aprovar
                           </Button>
                           <Button
                             size="sm"
                             variant="ghost"
                             onClick={() => handleReject(cliente)}
                           >
                             <XCircle className="h-4 w-4 text-destructive" />
                           </Button>
                         </div>
                       </TableCell>
                     </TableRow>
                   );
                 })}
               </TableBody>
             </Table>
           )}
         </CardContent>
       </Card>
 
       {/* Details Dialog */}
       <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Detalhes da Venda</DialogTitle>
           </DialogHeader>
           {selectedCliente && (
             <div className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <Label className="text-muted-foreground">Cliente</Label>
                   <p className="font-medium">{selectedCliente.nome}</p>
                 </div>
                 <div>
                   <Label className="text-muted-foreground">Telefone</Label>
                   <p>{selectedCliente.telefone}</p>
                 </div>
                 <div>
                   <Label className="text-muted-foreground">Localização</Label>
                   <p>{selectedCliente.cidade}, {selectedCliente.estado}</p>
                 </div>
                 <div>
                   <Label className="text-muted-foreground">Vendedor</Label>
                   <p>{selectedCliente.leads?.vendedor || "-"}</p>
                 </div>
                 <div>
                   <Label className="text-muted-foreground">Potência</Label>
                   <p>{selectedCliente.simulacoes?.potencia_recomendada_kwp || 0} kWp</p>
                 </div>
                 <div>
                   <Label className="text-muted-foreground">Valor Investimento</Label>
                   <p className="font-bold text-primary">
                     {formatCurrency(selectedCliente.simulacoes?.investimento_estimado || 0)}
                   </p>
                 </div>
               </div>
             </div>
           )}
         </DialogContent>
       </Dialog>
 
       {/* Approval Dialog */}
       <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
               Aprovar Venda
             </DialogTitle>
             <DialogDescription>
               Confirme os dados da comissão para {selectedCliente?.nome}
             </DialogDescription>
           </DialogHeader>
           {selectedCliente && (
             <div className="space-y-4">
               <div className="p-4 bg-muted rounded-lg space-y-2">
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Vendedor</span>
                   <span className="font-medium">{selectedCliente.leads?.vendedor || "-"}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Valor da Venda</span>
                   <span className="font-medium">
                     {formatCurrency(selectedCliente.simulacoes?.investimento_estimado || 0)}
                   </span>
                 </div>
               </div>
 
               <div className="space-y-2">
                 <Label htmlFor="percentual">Percentual de Comissão (%)</Label>
                 <Input
                   id="percentual"
                   type="number"
                   step="0.1"
                   value={percentualComissao}
                   onChange={(e) => setPercentualComissao(e.target.value)}
                 />
               </div>
 
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                     <span className="font-medium">Valor da Comissão</span>
                   </div>
                  <span className="text-xl font-bold text-emerald-600">
                     {formatCurrency(valorComissaoPreview())}
                   </span>
                 </div>
               </div>
             </div>
           )}
           <DialogFooter>
             <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
               Cancelar
             </Button>
             <Button
               onClick={handleApprove}
               disabled={approving === selectedCliente?.id}
              className="bg-emerald-600 hover:bg-emerald-700"
             >
               {approving === selectedCliente?.id && (
                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
               )}
               Confirmar Aprovação
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 }