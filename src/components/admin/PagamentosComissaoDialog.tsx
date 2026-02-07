 import { useState } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "@/hooks/use-toast";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Textarea } from "@/components/ui/textarea";
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from "@/components/ui/table";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Progress } from "@/components/ui/progress";
 import { Plus, Loader2, Trash2, DollarSign } from "lucide-react";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 
 interface PagamentoComissao {
   id: string;
   valor_pago: number;
   data_pagamento: string;
   forma_pagamento: string;
   observacoes: string | null;
 }
 
 interface Comissao {
   id: string;
   vendedor_id: string;
   descricao: string;
   valor_base: number;
   percentual_comissao: number;
   valor_comissao: number;
   mes_referencia: number;
   ano_referencia: number;
   status: string;
   vendedores?: { nome: string };
   pagamentos_comissao?: { valor_pago: number }[];
 }
 
 interface PagamentosComissaoDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   comissao: Comissao;
   onUpdate: () => void;
 }
 
 const FORMAS_PAGAMENTO = [
   { value: "pix", label: "PIX" },
   { value: "transferencia", label: "Transferência" },
   { value: "dinheiro", label: "Dinheiro" },
   { value: "cheque", label: "Cheque" },
 ];
 
 const MESES = [
   "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
   "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
 ];
 
 export function PagamentosComissaoDialog({
   open,
   onOpenChange,
   comissao,
   onUpdate,
 }: PagamentosComissaoDialogProps) {
   const [pagamentos, setPagamentos] = useState<PagamentoComissao[]>([]);
   const [loading, setLoading] = useState(false);
   const [saving, setSaving] = useState(false);
   const [showForm, setShowForm] = useState(false);
   const [formData, setFormData] = useState({
     valor_pago: "",
     forma_pagamento: "",
     data_pagamento: new Date().toISOString().split("T")[0],
     observacoes: "",
   });
 
   const fetchPagamentos = async () => {
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from("pagamentos_comissao")
         .select("*")
         .eq("comissao_id", comissao.id)
         .order("data_pagamento", { ascending: false });
 
       if (error) throw error;
       setPagamentos(data || []);
     } catch (error) {
       console.error("Error fetching pagamentos:", error);
     } finally {
       setLoading(false);
     }
   };
 
   // Fetch pagamentos when dialog opens
   useState(() => {
     if (open) {
       fetchPagamentos();
     }
   });
 
   // Re-fetch when dialog opens
   if (open && pagamentos.length === 0 && !loading) {
     fetchPagamentos();
   }
 
   const totalPago = pagamentos.reduce((acc, p) => acc + p.valor_pago, 0);
   const saldoRestante = comissao.valor_comissao - totalPago;
   const progresso = Math.min((totalPago / comissao.valor_comissao) * 100, 100);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     setSaving(true);
 
     try {
       const { error } = await supabase.from("pagamentos_comissao").insert({
         comissao_id: comissao.id,
         valor_pago: parseFloat(formData.valor_pago),
         forma_pagamento: formData.forma_pagamento,
         data_pagamento: formData.data_pagamento,
         observacoes: formData.observacoes || null,
       });
 
       if (error) throw error;
 
       toast({ title: "Pagamento registrado!" });
       resetForm();
       fetchPagamentos();
       onUpdate();
     } catch (error) {
       console.error("Error saving pagamento:", error);
       toast({ title: "Erro ao registrar pagamento", variant: "destructive" });
     } finally {
       setSaving(false);
     }
   };
 
   const handleDelete = async (id: string) => {
     if (!confirm("Excluir este pagamento?")) return;
 
     try {
       const { error } = await supabase.from("pagamentos_comissao").delete().eq("id", id);
       if (error) throw error;
       toast({ title: "Pagamento excluído!" });
       fetchPagamentos();
       onUpdate();
     } catch (error) {
       console.error("Error deleting pagamento:", error);
       toast({ title: "Erro ao excluir pagamento", variant: "destructive" });
     }
   };
 
   const resetForm = () => {
     setFormData({
       valor_pago: "",
       forma_pagamento: "",
       data_pagamento: new Date().toISOString().split("T")[0],
       observacoes: "",
     });
     setShowForm(false);
   };
 
   const formatCurrency = (value: number) => {
     return new Intl.NumberFormat("pt-BR", {
       style: "currency",
       currency: "BRL",
     }).format(value);
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <DollarSign className="h-5 w-5" />
             Pagamentos - {comissao.vendedores?.nome}
           </DialogTitle>
         </DialogHeader>
 
         {/* Summary */}
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm">Resumo da Comissão</CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="text-sm text-muted-foreground mb-2">
               {comissao.descricao} • {MESES[comissao.mes_referencia - 1]}/{comissao.ano_referencia}
             </div>
 
             <div className="grid grid-cols-3 gap-4 text-center">
               <div>
                 <p className="text-sm text-muted-foreground">Valor Comissão</p>
                 <p className="text-lg font-bold">{formatCurrency(comissao.valor_comissao)}</p>
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Total Pago</p>
                 <p className="text-lg font-bold text-green-600">{formatCurrency(totalPago)}</p>
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Saldo Restante</p>
                 <p className="text-lg font-bold text-orange-600">{formatCurrency(saldoRestante)}</p>
               </div>
             </div>
 
             <div className="space-y-1">
               <div className="flex justify-between text-sm">
                 <span>Progresso</span>
                 <span>{progresso.toFixed(0)}%</span>
               </div>
               <Progress value={progresso} className="h-3" />
             </div>
           </CardContent>
         </Card>
 
         {/* Payments List */}
         <div className="space-y-4">
           <div className="flex items-center justify-between">
             <h3 className="font-medium">Histórico de Pagamentos</h3>
             {!showForm && saldoRestante > 0 && (
               <Button size="sm" onClick={() => setShowForm(true)} className="gap-1">
                 <Plus className="h-4 w-4" />
                 Novo Pagamento
               </Button>
             )}
           </div>
 
           {/* Form */}
           {showForm && (
             <Card>
               <CardContent className="pt-4">
                 <form onSubmit={handleSubmit} className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <Label htmlFor="valor_pago">Valor Pago *</Label>
                       <Input
                         id="valor_pago"
                         type="number"
                         step="0.01"
                         placeholder={`Restante: ${formatCurrency(saldoRestante)}`}
                         value={formData.valor_pago}
                         onChange={(e) => setFormData({ ...formData, valor_pago: e.target.value })}
                         required
                       />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="data_pagamento">Data *</Label>
                       <Input
                         id="data_pagamento"
                         type="date"
                         value={formData.data_pagamento}
                         onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
                         required
                       />
                     </div>
                   </div>
 
                   <div className="space-y-2">
                     <Label>Forma de Pagamento *</Label>
                     <Select
                       value={formData.forma_pagamento}
                       onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}
                       required
                     >
                       <SelectTrigger>
                         <SelectValue placeholder="Selecione" />
                       </SelectTrigger>
                       <SelectContent>
                         {FORMAS_PAGAMENTO.map((fp) => (
                           <SelectItem key={fp.value} value={fp.value}>
                             {fp.label}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
 
                   <div className="space-y-2">
                     <Label htmlFor="observacoes">Observações</Label>
                     <Textarea
                       id="observacoes"
                       value={formData.observacoes}
                       onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                       rows={2}
                     />
                   </div>
 
                   <div className="flex justify-end gap-3">
                     <Button type="button" variant="outline" onClick={resetForm}>
                       Cancelar
                     </Button>
                     <Button type="submit" disabled={saving}>
                       {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                       Registrar
                     </Button>
                   </div>
                 </form>
               </CardContent>
             </Card>
           )}
 
           {/* Table */}
           {loading ? (
             <div className="flex justify-center py-8">
               <Loader2 className="h-6 w-6 animate-spin" />
             </div>
           ) : pagamentos.length === 0 ? (
             <p className="text-center text-muted-foreground py-4">
               Nenhum pagamento registrado
             </p>
           ) : (
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Data</TableHead>
                   <TableHead>Valor</TableHead>
                   <TableHead>Forma</TableHead>
                   <TableHead>Obs</TableHead>
                   <TableHead className="w-12"></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {pagamentos.map((pagamento) => (
                   <TableRow key={pagamento.id}>
                     <TableCell>
                       {format(new Date(pagamento.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                     </TableCell>
                     <TableCell className="font-medium">
                       {formatCurrency(pagamento.valor_pago)}
                     </TableCell>
                     <TableCell>
                       {FORMAS_PAGAMENTO.find((f) => f.value === pagamento.forma_pagamento)?.label ||
                         pagamento.forma_pagamento}
                     </TableCell>
                     <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                       {pagamento.observacoes || "-"}
                     </TableCell>
                     <TableCell>
                       <Button
                         size="sm"
                         variant="ghost"
                         onClick={() => handleDelete(pagamento.id)}
                       >
                         <Trash2 className="h-4 w-4 text-destructive" />
                       </Button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           )}
         </div>
       </DialogContent>
     </Dialog>
   );
 }