 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "@/hooks/use-toast";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
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
 } from "@/components/ui/dialog";
 import { Loader2, Calendar, CheckCircle, AlertTriangle, Clock } from "lucide-react";
 import { format, addMonths } from "date-fns";
 import { ptBR } from "date-fns/locale";
 
 interface Parcela {
   id: string;
   numero_parcela: number;
   valor: number;
   data_vencimento: string;
   status: string;
   pagamento_id: string | null;
 }
 
 interface Recebimento {
   id: string;
   valor_total: number;
   numero_parcelas: number;
   data_acordo: string;
   clientes?: { nome: string };
 }
 
 interface ParcelasManagerProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   recebimento: Recebimento;
   onUpdate: () => void;
 }
 
 const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
   pendente: { label: "Pendente", color: "bg-yellow-500", icon: <Clock className="h-3 w-3" /> },
   paga: { label: "Paga", color: "bg-green-500", icon: <CheckCircle className="h-3 w-3" /> },
   atrasada: { label: "Atrasada", color: "bg-red-500", icon: <AlertTriangle className="h-3 w-3" /> },
   cancelada: { label: "Cancelada", color: "bg-gray-500", icon: null },
 };
 
 export function ParcelasManager({ open, onOpenChange, recebimento, onUpdate }: ParcelasManagerProps) {
   const [parcelas, setParcelas] = useState<Parcela[]>([]);
   const [loading, setLoading] = useState(true);
   const [generating, setGenerating] = useState(false);
 
   useEffect(() => {
     if (open) {
       fetchParcelas();
     }
   }, [open, recebimento.id]);
 
   const fetchParcelas = async () => {
     try {
       const { data, error } = await supabase
         .from("parcelas")
         .select("*")
         .eq("recebimento_id", recebimento.id)
         .order("numero_parcela");
 
       if (error) throw error;
       setParcelas(data || []);
     } catch (error) {
       console.error("Error fetching parcelas:", error);
       toast({ title: "Erro ao carregar parcelas", variant: "destructive" });
     } finally {
       setLoading(false);
     }
   };
 
   const gerarParcelas = async () => {
     setGenerating(true);
     try {
       // Delete existing parcelas
       await supabase.from("parcelas").delete().eq("recebimento_id", recebimento.id);
 
       // Generate new parcelas
       const valorParcela = recebimento.valor_total / recebimento.numero_parcelas;
       const dataBase = new Date(recebimento.data_acordo);
       
       const novasParcelas = Array.from({ length: recebimento.numero_parcelas }, (_, i) => ({
         recebimento_id: recebimento.id,
         numero_parcela: i + 1,
         valor: Math.round(valorParcela * 100) / 100,
         data_vencimento: format(addMonths(dataBase, i), "yyyy-MM-dd"),
         status: "pendente",
       }));
 
       // Adjust last parcela for rounding
       const totalCalculado = novasParcelas.reduce((acc, p) => acc + p.valor, 0);
       const diferenca = recebimento.valor_total - totalCalculado;
       novasParcelas[novasParcelas.length - 1].valor += diferenca;
 
       const { error } = await supabase.from("parcelas").insert(novasParcelas);
       if (error) throw error;
 
       toast({ title: `${recebimento.numero_parcelas} parcelas geradas!` });
       fetchParcelas();
       onUpdate();
     } catch (error) {
       console.error("Error generating parcelas:", error);
       toast({ title: "Erro ao gerar parcelas", variant: "destructive" });
     } finally {
       setGenerating(false);
     }
   };
 
   const marcarComoPaga = async (parcelaId: string) => {
     try {
       const { error } = await supabase
         .from("parcelas")
         .update({ status: "paga" })
         .eq("id", parcelaId);
 
       if (error) throw error;
       toast({ title: "Parcela marcada como paga!" });
       fetchParcelas();
       onUpdate();
     } catch (error) {
       console.error("Error updating parcela:", error);
       toast({ title: "Erro ao atualizar parcela", variant: "destructive" });
     }
   };
 
   const formatCurrency = (value: number) => {
     return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
   };
 
   const isVencida = (dataVencimento: string, status: string) => {
     return status === "pendente" && new Date(dataVencimento) < new Date();
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Calendar className="h-5 w-5" />
             Parcelas - {recebimento.clientes?.nome}
           </DialogTitle>
         </DialogHeader>
 
         <div className="space-y-4">
           <div className="flex items-center justify-between">
             <div className="text-sm text-muted-foreground">
               {recebimento.numero_parcelas}x de {formatCurrency(recebimento.valor_total / recebimento.numero_parcelas)}
             </div>
             <Button onClick={gerarParcelas} disabled={generating} variant="outline" className="gap-2">
               {generating && <Loader2 className="h-4 w-4 animate-spin" />}
               {parcelas.length > 0 ? "Regenerar Parcelas" : "Gerar Parcelas"}
             </Button>
           </div>
 
           {loading ? (
             <div className="flex justify-center py-8">
               <Loader2 className="h-6 w-6 animate-spin" />
             </div>
           ) : parcelas.length === 0 ? (
             <div className="text-center py-8 text-muted-foreground">
               <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
               <p>Nenhuma parcela gerada</p>
               <p className="text-sm">Clique em "Gerar Parcelas" para criar</p>
             </div>
           ) : (
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Parcela</TableHead>
                   <TableHead>Valor</TableHead>
                   <TableHead>Vencimento</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead className="w-24"></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {parcelas.map((parcela) => {
                   const vencida = isVencida(parcela.data_vencimento, parcela.status);
                   const config = vencida ? STATUS_CONFIG.atrasada : STATUS_CONFIG[parcela.status];
 
                   return (
                     <TableRow key={parcela.id} className={vencida ? "bg-red-50 dark:bg-red-950/20" : ""}>
                       <TableCell className="font-medium">
                         {parcela.numero_parcela}/{recebimento.numero_parcelas}
                       </TableCell>
                       <TableCell>{formatCurrency(parcela.valor)}</TableCell>
                       <TableCell>
                         {format(new Date(parcela.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                       </TableCell>
                       <TableCell>
                         <Badge className={`${config.color} text-white gap-1`}>
                           {config.icon}
                           {config.label}
                         </Badge>
                       </TableCell>
                       <TableCell>
                         {parcela.status !== "paga" && parcela.status !== "cancelada" && (
                           <Button
                             size="sm"
                             variant="ghost"
                             onClick={() => marcarComoPaga(parcela.id)}
                           >
                             <CheckCircle className="h-4 w-4 text-green-600" />
                           </Button>
                         )}
                       </TableCell>
                     </TableRow>
                   );
                 })}
               </TableBody>
             </Table>
           )}
         </div>
       </DialogContent>
     </Dialog>
   );
 }