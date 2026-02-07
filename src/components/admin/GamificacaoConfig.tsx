 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useToast } from "@/hooks/use-toast";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Button } from "@/components/ui/button";
 import { Label } from "@/components/ui/label";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
   Trophy,
   Target,
   Medal,
   Star,
   Loader2,
   Save,
   Crown,
   Zap,
   TrendingUp,
   Clock,
   CheckCircle2,
   Award,
   Flame,
   Calendar,
 } from "lucide-react";
 import { User } from "lucide-react";
 import { format, startOfMonth, endOfMonth } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import { VendedorMetasIndividuais } from "./VendedorMetasIndividuais";
 
 interface GamificationConfig {
   id: string;
   meta_orcamentos_mensal: number;
   meta_conversoes_mensal: number;
   meta_valor_mensal: number;
   comissao_base_percent: number;
   comissao_bonus_meta_percent: number;
   achievement_points: Record<string, number>;
 }
 
 interface RankingEntry {
   vendedor_id: string;
   vendedor_nome: string;
   total_orcamentos: number;
   total_conversoes: number;
   valor_total_vendas: number;
   pontuacao_total: number;
   posicao_ranking: number;
 }
 
 const ACHIEVEMENT_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
   first_conversion: { label: "Primeira Conversão", icon: CheckCircle2 },
   fast_responder: { label: "Resposta Rápida", icon: Zap },
   high_volume: { label: "Alto Volume", icon: TrendingUp },
   conversion_streak: { label: "Sequência de Conversões", icon: Flame },
   top_performer: { label: "Top Performer", icon: Star },
   monthly_champion: { label: "Campeão do Mês", icon: Crown },
   perfect_month: { label: "Mês Perfeito", icon: Award },
   consistency_king: { label: "Rei da Consistência", icon: Calendar },
 };
 
 export function GamificacaoConfig() {
   const { toast } = useToast();
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [config, setConfig] = useState<GamificationConfig | null>(null);
   const [ranking, setRanking] = useState<RankingEntry[]>([]);
 
   useEffect(() => {
     fetchData();
   }, []);
 
   const fetchData = async () => {
     try {
       setLoading(true);
 
       // Fetch config
       const { data: configData, error: configError } = await supabase
         .from("gamification_config")
         .select("*")
         .single();
 
       if (configError && configError.code !== "PGRST116") throw configError;
 
       if (configData) {
         setConfig({
           ...configData,
           achievement_points: configData.achievement_points as Record<string, number>,
         });
       }
 
       // Fetch ranking for current month
       const now = new Date();
       const { data: performanceData, error: perfError } = await supabase
         .from("vendedor_performance_mensal")
         .select(`
           *,
           vendedor:vendedores(nome)
         `)
         .eq("mes", now.getMonth() + 1)
         .eq("ano", now.getFullYear())
         .order("pontuacao_total", { ascending: false });
 
       if (perfError) throw perfError;
 
       if (performanceData) {
         setRanking(
           performanceData.map((p: any, idx) => ({
             vendedor_id: p.vendedor_id,
             vendedor_nome: p.vendedor?.nome || "Desconhecido",
             total_orcamentos: p.total_orcamentos,
             total_conversoes: p.total_conversoes,
             valor_total_vendas: p.valor_total_vendas,
             pontuacao_total: p.pontuacao_total,
             posicao_ranking: idx + 1,
           }))
         );
       }
     } catch (error) {
       console.error("Error fetching gamification data:", error);
       toast({
         title: "Erro",
         description: "Não foi possível carregar os dados de gamificação.",
         variant: "destructive",
       });
     } finally {
       setLoading(false);
     }
   };
 
   const handleSaveConfig = async () => {
     if (!config) return;
 
     try {
       setSaving(true);
 
       const { error } = await supabase
         .from("gamification_config")
         .update({
           meta_orcamentos_mensal: config.meta_orcamentos_mensal,
           meta_conversoes_mensal: config.meta_conversoes_mensal,
           meta_valor_mensal: config.meta_valor_mensal,
           comissao_base_percent: config.comissao_base_percent,
           comissao_bonus_meta_percent: config.comissao_bonus_meta_percent,
           achievement_points: config.achievement_points,
         })
         .eq("id", config.id);
 
       if (error) throw error;
 
       toast({
         title: "Configurações salvas",
         description: "As configurações de gamificação foram atualizadas.",
       });
     } catch (error) {
       console.error("Error saving config:", error);
       toast({
         title: "Erro",
         description: "Não foi possível salvar as configurações.",
         variant: "destructive",
       });
     } finally {
       setSaving(false);
     }
   };
 
   const updateAchievementPoints = (key: string, value: number) => {
     if (!config) return;
     setConfig({
       ...config,
       achievement_points: {
         ...config.achievement_points,
         [key]: value,
       },
     });
   };
 
   if (loading) {
     return (
       <div className="flex items-center justify-center py-12">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   return (
     <div className="space-y-6">
       <Tabs defaultValue="ranking" className="w-full">
         <TabsList className="grid w-full max-w-2xl grid-cols-4">
           <TabsTrigger value="ranking" className="gap-2">
             <Trophy className="h-4 w-4" />
             Ranking
           </TabsTrigger>
           <TabsTrigger value="metas" className="gap-2">
             <Target className="h-4 w-4" />
             Metas
           </TabsTrigger>
           <TabsTrigger value="individuais" className="gap-2">
             <User className="h-4 w-4" />
             Por Vendedor
           </TabsTrigger>
           <TabsTrigger value="conquistas" className="gap-2">
             <Medal className="h-4 w-4" />
             Conquistas
           </TabsTrigger>
         </TabsList>
 
         {/* Ranking Tab */}
         <TabsContent value="ranking" className="mt-6">
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Trophy className="h-5 w-5 text-primary" />
                 Ranking do Mês - {format(new Date(), "MMMM yyyy", { locale: ptBR })}
               </CardTitle>
               <CardDescription>
                 Classificação de vendedores baseada em pontuação total do mês
               </CardDescription>
             </CardHeader>
             <CardContent>
               {ranking.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground">
                   Nenhum dado de performance registrado para este mês.
                 </div>
               ) : (
                 <>
                   {/* Podium for top 3 */}
                   <div className="flex items-end justify-center gap-4 mb-8">
                     {/* 2nd Place */}
                     {ranking[1] && (
                       <div className="flex flex-col items-center">
                         <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                           2
                         </div>
                         <div className="mt-2 text-center">
                           <p className="font-medium text-sm">{ranking[1].vendedor_nome}</p>
                           <p className="text-xs text-muted-foreground">{ranking[1].pontuacao_total} pts</p>
                         </div>
                         <div className="w-20 h-16 bg-gray-200 rounded-t-lg mt-2" />
                       </div>
                     )}
 
                     {/* 1st Place */}
                     {ranking[0] && (
                       <div className="flex flex-col items-center">
                         <Crown className="h-6 w-6 text-yellow-500 mb-1" />
                         <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                           1
                         </div>
                         <div className="mt-2 text-center">
                           <p className="font-semibold">{ranking[0].vendedor_nome}</p>
                           <p className="text-sm text-muted-foreground">{ranking[0].pontuacao_total} pts</p>
                         </div>
                         <div className="w-24 h-24 bg-yellow-100 rounded-t-lg mt-2" />
                       </div>
                     )}
 
                     {/* 3rd Place */}
                     {ranking[2] && (
                       <div className="flex flex-col items-center">
                         <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                           3
                         </div>
                         <div className="mt-2 text-center">
                           <p className="font-medium text-sm">{ranking[2].vendedor_nome}</p>
                           <p className="text-xs text-muted-foreground">{ranking[2].pontuacao_total} pts</p>
                         </div>
                         <div className="w-16 h-12 bg-amber-100 rounded-t-lg mt-2" />
                       </div>
                     )}
                   </div>
 
                   {/* Full Ranking Table */}
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead className="w-16">#</TableHead>
                         <TableHead>Vendedor</TableHead>
                         <TableHead className="text-center">Orçamentos</TableHead>
                         <TableHead className="text-center">Conversões</TableHead>
                         <TableHead className="text-right">Valor Vendas</TableHead>
                         <TableHead className="text-right">Pontuação</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {ranking.map((entry) => (
                         <TableRow key={entry.vendedor_id}>
                           <TableCell>
                             <Badge variant={entry.posicao_ranking <= 3 ? "default" : "outline"}>
                               {entry.posicao_ranking}º
                             </Badge>
                           </TableCell>
                           <TableCell className="font-medium">{entry.vendedor_nome}</TableCell>
                           <TableCell className="text-center">{entry.total_orcamentos}</TableCell>
                           <TableCell className="text-center">{entry.total_conversoes}</TableCell>
                           <TableCell className="text-right">
                             {new Intl.NumberFormat("pt-BR", {
                               style: "currency",
                               currency: "BRL",
                             }).format(entry.valor_total_vendas)}
                           </TableCell>
                           <TableCell className="text-right font-semibold">
                             {entry.pontuacao_total}
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </>
               )}
             </CardContent>
           </Card>
         </TabsContent>
 
         {/* Metas Tab */}
         <TabsContent value="metas" className="mt-6">
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Target className="h-5 w-5 text-primary" />
                 Configuração de Metas Globais
               </CardTitle>
               <CardDescription>
                 Defina os valores padrão de metas mensais para todos os vendedores.
                 Vendedores individuais podem ter metas personalizadas.
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-6">
               {config && (
                 <>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="space-y-2">
                       <Label>Meta de Orçamentos/Mês</Label>
                       <Input
                         type="number"
                         value={config.meta_orcamentos_mensal}
                         onChange={(e) =>
                           setConfig({ ...config, meta_orcamentos_mensal: parseInt(e.target.value) || 0 })
                         }
                       />
                     </div>
                     <div className="space-y-2">
                       <Label>Meta de Conversões/Mês</Label>
                       <Input
                         type="number"
                         value={config.meta_conversoes_mensal}
                         onChange={(e) =>
                           setConfig({ ...config, meta_conversoes_mensal: parseInt(e.target.value) || 0 })
                         }
                       />
                     </div>
                     <div className="space-y-2">
                       <Label>Meta de Valor (R$)/Mês</Label>
                       <Input
                         type="number"
                         value={config.meta_valor_mensal}
                         onChange={(e) =>
                           setConfig({ ...config, meta_valor_mensal: parseFloat(e.target.value) || 0 })
                         }
                       />
                     </div>
                   </div>
 
                   <div className="border-t pt-6">
                     <h3 className="font-medium mb-4">Comissões</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-2">
                         <Label>Comissão Base (%)</Label>
                         <Input
                           type="number"
                           step="0.1"
                           value={config.comissao_base_percent}
                           onChange={(e) =>
                             setConfig({ ...config, comissao_base_percent: parseFloat(e.target.value) || 0 })
                           }
                         />
                         <p className="text-xs text-muted-foreground">
                           Percentual base de comissão sobre vendas
                         </p>
                       </div>
                       <div className="space-y-2">
                         <Label>Bônus por Meta Atingida (%)</Label>
                         <Input
                           type="number"
                           step="0.1"
                           value={config.comissao_bonus_meta_percent}
                           onChange={(e) =>
                             setConfig({
                               ...config,
                               comissao_bonus_meta_percent: parseFloat(e.target.value) || 0,
                             })
                           }
                         />
                         <p className="text-xs text-muted-foreground">
                           Adicional quando o vendedor atinge a meta
                         </p>
                       </div>
                     </div>
                   </div>
 
                   <Button onClick={handleSaveConfig} disabled={saving} className="gap-2">
                     {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                     Salvar Configurações
                   </Button>
                 </>
               )}
             </CardContent>
           </Card>
         </TabsContent>
 
         {/* Metas Individuais Tab */}
         <TabsContent value="individuais" className="mt-6">
           <VendedorMetasIndividuais />
         </TabsContent>
 
         {/* Conquistas Tab */}
         <TabsContent value="conquistas" className="mt-6">
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Medal className="h-5 w-5 text-primary" />
                 Pontuação de Conquistas
               </CardTitle>
               <CardDescription>
                 Configure quantos pontos cada tipo de conquista concede aos vendedores
               </CardDescription>
             </CardHeader>
             <CardContent>
               {config && (
                 <div className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                     {Object.entries(ACHIEVEMENT_LABELS).map(([key, { label, icon: Icon }]) => (
                       <div key={key} className="space-y-2">
                         <Label className="flex items-center gap-2">
                           <Icon className="h-4 w-4 text-muted-foreground" />
                           {label}
                         </Label>
                         <Input
                           type="number"
                           value={config.achievement_points[key] || 0}
                           onChange={(e) => updateAchievementPoints(key, parseInt(e.target.value) || 0)}
                         />
                       </div>
                     ))}
                   </div>
 
                   <Button onClick={handleSaveConfig} disabled={saving} className="gap-2">
                     {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                     Salvar Pontuações
                   </Button>
                 </div>
               )}
             </CardContent>
           </Card>
         </TabsContent>
       </Tabs>
     </div>
   );
 }