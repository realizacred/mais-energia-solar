 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Progress } from "@/components/ui/progress";
 import { Badge } from "@/components/ui/badge";
 import { 
   Table, 
   TableBody, 
   TableCell, 
   TableHead, 
   TableHeader, 
   TableRow 
 } from "@/components/ui/table";
 import { toast } from "@/hooks/use-toast";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import {
   Loader2,
   TrendingUp,
   TrendingDown,
   BarChart3,
   ThumbsUp,
   Meh,
   Sparkles,
 } from "lucide-react";
 import { StarRatingDisplay } from "@/components/ui/star-rating";
 
 interface Avaliacao {
 id: string;
 nome_cliente: string;
 endereco: string;
 avaliacao_atendimento: string;
 data_instalacao: string;
 created_at: string;
 }
 
 const avaliacaoConfig: Record<string, { 
   label: string; 
   color: string; 
   score: number;
   bgClass: string;
 }> = {
   otimo: { label: "Excelente", color: "text-success", score: 5, bgClass: "bg-success" },
   bom: { label: "Bom", color: "text-secondary", score: 4, bgClass: "bg-secondary" },
   razoavel: { label: "Regular", color: "text-warning", score: 3, bgClass: "bg-warning" },
   ruim: { label: "Ruim", color: "text-primary", score: 2, bgClass: "bg-primary" },
   muito_ruim: { label: "Muito Ruim", color: "text-destructive", score: 1, bgClass: "bg-destructive" },
 };
 
 export function AvaliacoesManager() {
 const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
 const [loading, setLoading] = useState(true);
 
 const fetchAvaliacoes = async () => {
   setLoading(true);
   try {
     const { data, error } = await supabase
       .from("checklists_instalacao")
       .select("id, nome_cliente, endereco, avaliacao_atendimento, data_instalacao, created_at")
       .not("avaliacao_atendimento", "is", null)
       .order("created_at", { ascending: false });
 
     if (error) throw error;
     setAvaliacoes(data || []);
   } catch (error) {
     console.error("Error fetching avaliacoes:", error);
     toast({
       title: "Erro ao carregar avaliações",
       variant: "destructive",
     });
   } finally {
     setLoading(false);
   }
 };
 
 useEffect(() => {
   fetchAvaliacoes();
 }, []);
 
 // Calcular estatísticas
 const stats = {
   total: avaliacoes.length,
   otimo: avaliacoes.filter((a) => a.avaliacao_atendimento === "otimo").length,
   bom: avaliacoes.filter((a) => a.avaliacao_atendimento === "bom").length,
   razoavel: avaliacoes.filter((a) => a.avaliacao_atendimento === "razoavel").length,
   ruim: avaliacoes.filter((a) => a.avaliacao_atendimento === "ruim").length,
   muito_ruim: avaliacoes.filter((a) => a.avaliacao_atendimento === "muito_ruim").length,
 };
 
 // Calcular média
 const calcularMedia = () => {
   if (avaliacoes.length === 0) return 0;
   const soma = avaliacoes.reduce((acc, a) => {
     return acc + (avaliacaoConfig[a.avaliacao_atendimento]?.score || 0);
   }, 0);
   return soma / avaliacoes.length;
 };
 
 const media = calcularMedia();
 const percentualPositivo = stats.total > 0 
   ? ((stats.otimo + stats.bom) / stats.total * 100).toFixed(1)
   : "0";
 
 // NPS simplificado (promotores - detratores)
 const nps = stats.total > 0
   ? Math.round(((stats.otimo - (stats.ruim + stats.muito_ruim)) / stats.total) * 100)
   : 0;
 
 if (loading) {
   return (
     <div className="flex items-center justify-center py-12">
       <Loader2 className="h-8 w-8 animate-spin text-primary" />
     </div>
   );
 }
 
 return (
   <div className="space-y-6">
     {/* KPIs principais */}
     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-warning">
         <CardContent className="pt-6">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-sm text-muted-foreground">Média Geral</p>
               <div className="flex items-center gap-2 mt-1">
                 <p className="text-3xl font-bold">{media.toFixed(1)}</p>
                 <span className="text-muted-foreground">/5</span>
               </div>
             </div>
              <div className="p-3 bg-warning/10 rounded-full">
                <Sparkles className="h-6 w-6 text-warning" />
              </div>
           </div>
           <div className="mt-3">
              <StarRatingDisplay value={media} size="sm" />
           </div>
         </CardContent>
       </Card>
 
        <Card className="border-l-4 border-l-success">
         <CardContent className="pt-6">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-sm text-muted-foreground">Satisfação Positiva</p>
                <p className="text-3xl font-bold text-success">{percentualPositivo}%</p>
             </div>
              <div className="p-3 bg-success/10 rounded-full">
                <ThumbsUp className="h-6 w-6 text-success" />
             </div>
           </div>
           <p className="text-xs text-muted-foreground mt-2">
             {stats.otimo + stats.bom} de {stats.total} avaliações
           </p>
         </CardContent>
       </Card>
 
        <Card className="border-l-4 border-l-info">
         <CardContent className="pt-6">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-sm text-muted-foreground">NPS Score</p>
                <p className={`text-3xl font-bold ${nps >= 0 ? 'text-success' : 'text-destructive'}`}>
                 {nps > 0 && '+'}{nps}
               </p>
             </div>
              <div className={`p-3 rounded-full ${nps >= 50 ? 'bg-success/10' : nps >= 0 ? 'bg-warning/10' : 'bg-destructive/10'}`}>
               {nps >= 50 ? (
                  <TrendingUp className="h-6 w-6 text-success" />
               ) : nps >= 0 ? (
                  <Meh className="h-6 w-6 text-warning" />
               ) : (
                  <TrendingDown className="h-6 w-6 text-destructive" />
               )}
             </div>
           </div>
           <p className="text-xs text-muted-foreground mt-2">
             {nps >= 50 ? 'Excelente' : nps >= 0 ? 'Bom' : 'Precisa melhorar'}
           </p>
         </CardContent>
       </Card>
 
        <Card className="border-l-4 border-l-secondary">
         <CardContent className="pt-6">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-sm text-muted-foreground">Total de Avaliações</p>
               <p className="text-3xl font-bold">{stats.total}</p>
             </div>
              <div className="p-3 bg-secondary/10 rounded-full">
                <BarChart3 className="h-6 w-6 text-secondary" />
             </div>
           </div>
           <p className="text-xs text-muted-foreground mt-2">
             Instalações avaliadas
           </p>
         </CardContent>
       </Card>
     </div>
 
     {/* Distribuição das avaliações */}
     <Card>
       <CardHeader>
         <CardTitle className="flex items-center gap-2 text-lg">
           <BarChart3 className="h-5 w-5" />
           Distribuição das Avaliações
         </CardTitle>
       </CardHeader>
       <CardContent>
         <div className="space-y-4">
           {Object.entries(avaliacaoConfig).map(([key, config]) => {
             const count = stats[key as keyof typeof stats] as number || 0;
             const percent = stats.total > 0 ? (count / stats.total) * 100 : 0;
             return (
               <div key={key} className="flex items-center gap-4">
                  <div className="w-28 flex items-center gap-2">
                    <StarRatingDisplay value={config.score} size="sm" />
                   <span className={`text-sm font-medium ${config.color}`}>
                   </span>
                 </div>
                  <span className="w-20 text-sm font-medium">{config.label}</span>
                 <div className="flex-1">
                   <div className="h-6 bg-muted rounded-full overflow-hidden">
                     <div
                       className={`h-full ${config.bgClass} transition-all duration-500`}
                       style={{ width: `${percent}%` }}
                     />
                   </div>
                 </div>
                 <div className="w-20 text-right">
                   <span className="font-semibold">{count}</span>
                   <span className="text-muted-foreground text-sm ml-1">
                     ({percent.toFixed(0)}%)
                   </span>
                 </div>
               </div>
             );
           })}
         </div>
       </CardContent>
     </Card>
 
     {/* Lista de avaliações recentes */}
     <Card>
       <CardHeader>
         <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-warning" />
           Avaliações Recentes
         </CardTitle>
       </CardHeader>
       <CardContent>
         {avaliacoes.length === 0 ? (
           <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
             <p>Nenhuma avaliação registrada</p>
           </div>
         ) : (
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Data</TableHead>
                 <TableHead>Cliente</TableHead>
                 <TableHead>Endereço</TableHead>
                 <TableHead>Avaliação</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {avaliacoes.slice(0, 20).map((avaliacao) => {
                 const config = avaliacaoConfig[avaliacao.avaliacao_atendimento];
                 return (
                   <TableRow key={avaliacao.id}>
                     <TableCell className="whitespace-nowrap">
                       {format(new Date(avaliacao.data_instalacao), "dd/MM/yyyy", {
                         locale: ptBR,
                       })}
                     </TableCell>
                     <TableCell className="font-medium">
                       {avaliacao.nome_cliente}
                     </TableCell>
                     <TableCell className="max-w-[250px] truncate">
                       {avaliacao.endereco}
                     </TableCell>
                     <TableCell>
                        <div className="flex items-center gap-2">
                          <StarRatingDisplay value={config?.score || 0} size="sm" />
                          <Badge className={`${config?.bgClass} text-white`}>
                            {config?.label}
                          </Badge>
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
   </div>
 );
 }