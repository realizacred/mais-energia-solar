 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { AlertTriangle, Loader2, DollarSign } from "lucide-react";
 import { format, differenceInDays } from "date-fns";
 import { ptBR } from "date-fns/locale";
 
 interface ParcelaAtrasada {
   id: string;
   numero_parcela: number;
   valor: number;
   data_vencimento: string;
   recebimento_id: string;
   recebimentos: {
     clientes: { nome: string };
     descricao: string | null;
   };
 }
 
 export function ParcelasAtrasadasWidget() {
   const [parcelas, setParcelas] = useState<ParcelaAtrasada[]>([]);
   const [loading, setLoading] = useState(true);
 
   useEffect(() => {
     fetchParcelasAtrasadas();
   }, []);
 
   const fetchParcelasAtrasadas = async () => {
     try {
       const today = new Date().toISOString().split("T")[0];
       
       const { data, error } = await supabase
         .from("parcelas")
         .select(`
           id,
           numero_parcela,
           valor,
           data_vencimento,
           recebimento_id,
           recebimentos (
             clientes (nome),
             descricao
           )
         `)
         .eq("status", "pendente")
         .lt("data_vencimento", today)
         .order("data_vencimento", { ascending: true })
         .limit(10);
 
       if (error) throw error;
       setParcelas((data as unknown as ParcelaAtrasada[]) || []);
     } catch (error) {
       console.error("Error fetching parcelas atrasadas:", error);
     } finally {
       setLoading(false);
     }
   };
 
   const formatCurrency = (value: number) => {
     return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
   };
 
   const getDiasAtraso = (dataVencimento: string) => {
     return differenceInDays(new Date(), new Date(dataVencimento));
   };
 
   const getPrioridadeColor = (dias: number) => {
     if (dias > 30) return "bg-red-600";
     if (dias > 14) return "bg-red-500";
     if (dias > 7) return "bg-orange-500";
     return "bg-yellow-500";
   };
 
   const totalAtrasado = parcelas.reduce((acc, p) => acc + p.valor, 0);
 
   if (loading) {
     return (
       <Card>
         <CardHeader className="pb-2">
           <CardTitle className="text-sm flex items-center gap-2">
             <AlertTriangle className="h-4 w-4 text-red-500" />
             Parcelas em Atraso
           </CardTitle>
         </CardHeader>
         <CardContent className="flex justify-center py-4">
           <Loader2 className="h-5 w-5 animate-spin" />
         </CardContent>
       </Card>
     );
   }
 
   return (
     <Card>
       <CardHeader className="pb-2">
         <CardTitle className="text-sm flex items-center justify-between">
           <span className="flex items-center gap-2">
             <AlertTriangle className="h-4 w-4 text-red-500" />
             Parcelas em Atraso
           </span>
           {parcelas.length > 0 && (
             <Badge variant="destructive">{parcelas.length}</Badge>
           )}
         </CardTitle>
       </CardHeader>
       <CardContent>
         {parcelas.length === 0 ? (
           <p className="text-sm text-muted-foreground text-center py-4">
             Nenhuma parcela em atraso 🎉
           </p>
         ) : (
           <div className="space-y-3">
             <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
               <DollarSign className="h-4 w-4 text-red-500" />
               <span className="text-sm font-medium">
                 Total em atraso: {formatCurrency(totalAtrasado)}
               </span>
             </div>
             
             <ScrollArea className="h-48">
               <div className="space-y-2">
                 {parcelas.map((parcela) => {
                   const diasAtraso = getDiasAtraso(parcela.data_vencimento);
                   
                   return (
                     <div
                       key={parcela.id}
                       className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                     >
                       <div className="flex-1 min-w-0">
                         <p className="text-sm font-medium truncate">
                           {parcela.recebimentos?.clientes?.nome}
                         </p>
                         <p className="text-xs text-muted-foreground">
                           Parcela {parcela.numero_parcela} • Venc: {format(new Date(parcela.data_vencimento), "dd/MM", { locale: ptBR })}
                         </p>
                       </div>
                       <div className="flex items-center gap-2">
                         <span className="text-sm font-medium">{formatCurrency(parcela.valor)}</span>
                         <Badge className={`${getPrioridadeColor(diasAtraso)} text-white text-xs`}>
                           {diasAtraso}d
                         </Badge>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </ScrollArea>
           </div>
         )}
       </CardContent>
     </Card>
   );
 }