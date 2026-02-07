 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
 import { Download, FileSpreadsheet, Loader2, TrendingUp } from "lucide-react";
 import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
 import { ptBR } from "date-fns/locale";
 
 interface Pagamento {
   id: string;
   valor_pago: number;
   forma_pagamento: string;
   data_pagamento: string;
 }
 
 interface DadosMensal {
   mes: string;
   mesNum: number;
   recebido: number;
 }
 
 interface DadosFormaPagamento {
   name: string;
   value: number;
 }
 
 const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658"];
 
 const FORMAS_PAGAMENTO: Record<string, string> = {
   pix: "PIX",
   boleto: "Boleto",
   cartao_credito: "Cartão de Crédito",
   cartao_debito: "Cartão de Débito",
   dinheiro: "Dinheiro",
   cheque: "Cheque",
   financiamento: "Financiamento",
 };
 
 export function RelatoriosFinanceiros() {
   const [loading, setLoading] = useState(true);
   const [periodo, setPeriodo] = useState("6");
   const [dadosMensais, setDadosMensais] = useState<DadosMensal[]>([]);
   const [dadosFormaPagamento, setDadosFormaPagamento] = useState<DadosFormaPagamento[]>([]);
   const [totais, setTotais] = useState({ recebido: 0, pendente: 0, atrasado: 0 });
 
   useEffect(() => {
     fetchDados();
   }, [periodo]);
 
   const fetchDados = async () => {
     setLoading(true);
     try {
       const mesesAtras = parseInt(periodo);
       const dataInicio = format(startOfMonth(subMonths(new Date(), mesesAtras - 1)), "yyyy-MM-dd");
       
       // Buscar pagamentos
       const { data: pagamentos, error: pagError } = await supabase
         .from("pagamentos")
         .select("*")
         .gte("data_pagamento", dataInicio)
         .order("data_pagamento");
 
       if (pagError) throw pagError;
 
       // Buscar totais de recebimentos
       const { data: recebimentos } = await supabase
         .from("recebimentos")
         .select("valor_total, status");
 
       // Buscar parcelas atrasadas
       const today = new Date().toISOString().split("T")[0];
       const { data: parcelasAtrasadas } = await supabase
         .from("parcelas")
         .select("valor")
         .eq("status", "pendente")
         .lt("data_vencimento", today);
 
       // Processar dados mensais
       const mesesMap = new Map<string, number>();
       for (let i = mesesAtras - 1; i >= 0; i--) {
         const data = subMonths(new Date(), i);
         const chave = format(data, "MMM/yy", { locale: ptBR });
         mesesMap.set(chave, 0);
       }
 
       pagamentos?.forEach((p: Pagamento) => {
         const chave = format(new Date(p.data_pagamento), "MMM/yy", { locale: ptBR });
         if (mesesMap.has(chave)) {
           mesesMap.set(chave, (mesesMap.get(chave) || 0) + p.valor_pago);
         }
       });
 
       setDadosMensais(
         Array.from(mesesMap.entries()).map(([mes, recebido], idx) => ({
           mes,
           mesNum: idx,
           recebido,
         }))
       );
 
       // Processar dados por forma de pagamento
       const formasMap = new Map<string, number>();
       pagamentos?.forEach((p: Pagamento) => {
         const forma = FORMAS_PAGAMENTO[p.forma_pagamento] || p.forma_pagamento;
         formasMap.set(forma, (formasMap.get(forma) || 0) + p.valor_pago);
       });
 
       setDadosFormaPagamento(
         Array.from(formasMap.entries())
           .map(([name, value]) => ({ name, value }))
           .sort((a, b) => b.value - a.value)
       );
 
       // Calcular totais
       const totalRecebido = pagamentos?.reduce((acc: number, p: Pagamento) => acc + p.valor_pago, 0) || 0;
       const totalPendente = recebimentos
         ?.filter((r: { status: string }) => r.status !== "quitado" && r.status !== "cancelado")
         .reduce((acc: number, r: { valor_total: number }) => acc + r.valor_total, 0) || 0;
       const totalAtrasado = parcelasAtrasadas?.reduce((acc: number, p: { valor: number }) => acc + p.valor, 0) || 0;
 
       setTotais({ recebido: totalRecebido, pendente: totalPendente - totalRecebido, atrasado: totalAtrasado });
     } catch (error) {
       console.error("Error fetching report data:", error);
     } finally {
       setLoading(false);
     }
   };
 
   const formatCurrency = (value: number) => {
     return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
   };
 
   const exportToCSV = () => {
     const headers = ["Mês", "Valor Recebido"];
     const rows = dadosMensais.map((d) => [d.mes, d.recebido.toFixed(2)]);
     
     const csvContent = [
       headers.join(","),
       ...rows.map((r) => r.join(",")),
     ].join("\n");
 
     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
     const url = URL.createObjectURL(blob);
     const link = document.createElement("a");
     link.href = url;
     link.download = `relatorio_financeiro_${format(new Date(), "yyyy-MM-dd")}.csv`;
     link.click();
   };
 
   if (loading) {
     return (
       <div className="flex justify-center py-12">
         <Loader2 className="h-8 w-8 animate-spin" />
       </div>
     );
   }
 
   return (
     <div className="space-y-6">
       {/* Header */}
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-4">
           <Select value={periodo} onValueChange={setPeriodo}>
             <SelectTrigger className="w-40">
               <SelectValue placeholder="Período" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="3">Últimos 3 meses</SelectItem>
               <SelectItem value="6">Últimos 6 meses</SelectItem>
               <SelectItem value="12">Últimos 12 meses</SelectItem>
             </SelectContent>
           </Select>
         </div>
         <Button onClick={exportToCSV} variant="outline" className="gap-2">
           <FileSpreadsheet className="h-4 w-4" />
           Exportar CSV
         </Button>
       </div>
 
       {/* Cards de Resumo */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">
               Total Recebido
             </CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-2xl font-bold text-green-600">{formatCurrency(totais.recebido)}</p>
           </CardContent>
         </Card>
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">
               A Receber
             </CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totais.pendente)}</p>
           </CardContent>
         </Card>
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">
               Em Atraso
             </CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-2xl font-bold text-red-600">{formatCurrency(totais.atrasado)}</p>
           </CardContent>
         </Card>
       </div>
 
       {/* Gráficos */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Gráfico de Barras - Recebimentos Mensais */}
         <Card>
           <CardHeader>
             <CardTitle className="text-sm flex items-center gap-2">
               <TrendingUp className="h-4 w-4" />
               Recebimentos por Mês
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={dadosMensais}>
                   <CartesianGrid strokeDasharray="3 3" />
                   <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                   <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                   <Tooltip
                     formatter={(value: number) => [formatCurrency(value), "Recebido"]}
                     labelFormatter={(label) => `Mês: ${label}`}
                   />
                   <Bar dataKey="recebido" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </CardContent>
         </Card>
 
         {/* Gráfico de Pizza - Formas de Pagamento */}
         <Card>
           <CardHeader>
             <CardTitle className="text-sm">Formas de Pagamento</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={dadosFormaPagamento}
                     cx="50%"
                     cy="50%"
                     labelLine={false}
                     outerRadius={80}
                     fill="#8884d8"
                     dataKey="value"
                     label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                   >
                     {dadosFormaPagamento.map((_, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip formatter={(value: number) => formatCurrency(value)} />
                   <Legend />
                 </PieChart>
               </ResponsiveContainer>
             </div>
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }