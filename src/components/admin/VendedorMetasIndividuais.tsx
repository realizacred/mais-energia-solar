 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useToast } from "@/hooks/use-toast";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Button } from "@/components/ui/button";
 import { Label } from "@/components/ui/label";
 import { Switch } from "@/components/ui/switch";
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
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import { User, Edit2, Save, Loader2, Target, TrendingUp } from "lucide-react";
 
 interface Vendedor {
   id: string;
   nome: string;
   ativo: boolean;
 }
 
 interface VendedorMeta {
   id: string;
   vendedor_id: string;
   mes: number;
   ano: number;
   meta_orcamentos: number | null;
   meta_conversoes: number | null;
   meta_valor: number | null;
   comissao_percent: number | null;
   usa_meta_individual: boolean;
 }
 
 interface GlobalConfig {
   meta_orcamentos_mensal: number;
   meta_conversoes_mensal: number;
   meta_valor_mensal: number;
   comissao_base_percent: number;
 }
 
 export function VendedorMetasIndividuais() {
   const { toast } = useToast();
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [vendedores, setVendedores] = useState<Vendedor[]>([]);
   const [metas, setMetas] = useState<Map<string, VendedorMeta>>(new Map());
   const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
   const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null);
   const [editingMeta, setEditingMeta] = useState<Partial<VendedorMeta>>({});
 
   const currentYear = new Date().getFullYear();
   const currentMonth = new Date().getMonth() + 1;
 
   useEffect(() => {
     fetchData();
   }, []);
 
   const fetchData = async () => {
     try {
       setLoading(true);
 
       // Fetch global config
       const { data: configData } = await supabase
         .from("gamification_config")
         .select("meta_orcamentos_mensal, meta_conversoes_mensal, meta_valor_mensal, comissao_base_percent")
         .single();
 
       if (configData) {
         setGlobalConfig({
           meta_orcamentos_mensal: configData.meta_orcamentos_mensal,
           meta_conversoes_mensal: configData.meta_conversoes_mensal,
           meta_valor_mensal: Number(configData.meta_valor_mensal),
           comissao_base_percent: Number(configData.comissao_base_percent),
         });
       }
 
       // Fetch vendedores
       const { data: vendedoresData } = await supabase
         .from("vendedores")
         .select("id, nome, ativo")
         .eq("ativo", true)
         .order("nome");
 
       if (vendedoresData) {
         setVendedores(vendedoresData);
       }
 
       // Fetch metas for current month
       const { data: metasData } = await supabase
         .from("vendedor_metas")
         .select("*")
         .eq("mes", currentMonth)
         .eq("ano", currentYear);
 
       if (metasData) {
         const metasMap = new Map<string, VendedorMeta>();
         for (const meta of metasData) {
           metasMap.set(meta.vendedor_id, {
             id: meta.id,
             vendedor_id: meta.vendedor_id,
             mes: meta.mes,
             ano: meta.ano,
             meta_orcamentos: meta.meta_orcamentos,
             meta_conversoes: meta.meta_conversoes,
             meta_valor: meta.meta_valor ? Number(meta.meta_valor) : null,
             comissao_percent: meta.comissao_percent ? Number(meta.comissao_percent) : null,
             usa_meta_individual: meta.usa_meta_individual || false,
           });
         }
         setMetas(metasMap);
       }
     } catch (error) {
       console.error("Error fetching data:", error);
       toast({
         title: "Erro",
         description: "Não foi possível carregar os dados.",
         variant: "destructive",
       });
     } finally {
       setLoading(false);
     }
   };
 
   const handleEditVendedor = (vendedor: Vendedor) => {
     const existingMeta = metas.get(vendedor.id);
     setEditingVendedor(vendedor);
     setEditingMeta({
       vendedor_id: vendedor.id,
       mes: currentMonth,
       ano: currentYear,
       meta_orcamentos: existingMeta?.meta_orcamentos ?? globalConfig?.meta_orcamentos_mensal ?? 30,
       meta_conversoes: existingMeta?.meta_conversoes ?? globalConfig?.meta_conversoes_mensal ?? 10,
       meta_valor: existingMeta?.meta_valor ?? globalConfig?.meta_valor_mensal ?? 150000,
       comissao_percent: existingMeta?.comissao_percent ?? globalConfig?.comissao_base_percent ?? 2,
       usa_meta_individual: existingMeta?.usa_meta_individual ?? false,
     });
   };
 
   const handleSaveMeta = async () => {
     if (!editingVendedor) return;
 
     try {
       setSaving(true);
 
       const existingMeta = metas.get(editingVendedor.id);
 
       if (existingMeta) {
         // Update
         const { error } = await supabase
           .from("vendedor_metas")
           .update({
             meta_orcamentos: editingMeta.meta_orcamentos,
             meta_conversoes: editingMeta.meta_conversoes,
             meta_valor: editingMeta.meta_valor,
             comissao_percent: editingMeta.comissao_percent,
             usa_meta_individual: editingMeta.usa_meta_individual,
           })
           .eq("id", existingMeta.id);
 
         if (error) throw error;
       } else {
         // Insert
         const { error } = await supabase.from("vendedor_metas").insert({
           vendedor_id: editingVendedor.id,
           mes: currentMonth,
           ano: currentYear,
           meta_orcamentos: editingMeta.meta_orcamentos,
           meta_conversoes: editingMeta.meta_conversoes,
           meta_valor: editingMeta.meta_valor,
           comissao_percent: editingMeta.comissao_percent,
           usa_meta_individual: editingMeta.usa_meta_individual,
         });
 
         if (error) throw error;
       }
 
       toast({
         title: "Sucesso",
         description: `Metas de ${editingVendedor.nome} atualizadas.`,
       });
 
       setEditingVendedor(null);
       fetchData();
     } catch (error) {
       console.error("Error saving meta:", error);
       toast({
         title: "Erro",
         description: "Não foi possível salvar as metas.",
         variant: "destructive",
       });
     } finally {
       setSaving(false);
     }
   };
 
   if (loading) {
     return (
       <div className="flex items-center justify-center py-12">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   return (
     <>
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <User className="h-5 w-5 text-primary" />
             Metas Individuais por Vendedor
           </CardTitle>
           <CardDescription>
             Configure metas personalizadas para cada vendedor. Vendedores sem meta individual usarão as metas globais.
           </CardDescription>
         </CardHeader>
         <CardContent>
           {vendedores.length === 0 ? (
             <div className="text-center py-8 text-muted-foreground">
               Nenhum vendedor ativo encontrado.
             </div>
           ) : (
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Vendedor</TableHead>
                   <TableHead className="text-center">Tipo</TableHead>
                   <TableHead className="text-center">Meta Orçamentos</TableHead>
                   <TableHead className="text-center">Meta Conversões</TableHead>
                   <TableHead className="text-right">Meta Valor</TableHead>
                   <TableHead className="text-center">Comissão</TableHead>
                   <TableHead className="w-16"></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {vendedores.map((vendedor) => {
                   const meta = metas.get(vendedor.id);
                   const usaIndividual = meta?.usa_meta_individual ?? false;
 
                   return (
                     <TableRow key={vendedor.id}>
                       <TableCell className="font-medium">{vendedor.nome}</TableCell>
                       <TableCell className="text-center">
                         <Badge variant={usaIndividual ? "default" : "outline"}>
                           {usaIndividual ? "Individual" : "Global"}
                         </Badge>
                       </TableCell>
                       <TableCell className="text-center">
                         {usaIndividual && meta?.meta_orcamentos != null
                           ? meta.meta_orcamentos
                           : globalConfig?.meta_orcamentos_mensal ?? "-"}
                       </TableCell>
                       <TableCell className="text-center">
                         {usaIndividual && meta?.meta_conversoes != null
                           ? meta.meta_conversoes
                           : globalConfig?.meta_conversoes_mensal ?? "-"}
                       </TableCell>
                       <TableCell className="text-right">
                         {new Intl.NumberFormat("pt-BR", {
                           style: "currency",
                           currency: "BRL",
                           maximumFractionDigits: 0,
                         }).format(
                           usaIndividual && meta?.meta_valor != null
                             ? meta.meta_valor
                             : globalConfig?.meta_valor_mensal ?? 0
                         )}
                       </TableCell>
                       <TableCell className="text-center">
                         {usaIndividual && meta?.comissao_percent != null
                           ? `${meta.comissao_percent}%`
                           : `${globalConfig?.comissao_base_percent ?? 2}%`}
                       </TableCell>
                       <TableCell>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => handleEditVendedor(vendedor)}
                         >
                           <Edit2 className="h-4 w-4" />
                         </Button>
                       </TableCell>
                     </TableRow>
                   );
                 })}
               </TableBody>
             </Table>
           )}
         </CardContent>
       </Card>
 
       {/* Edit Dialog */}
       <Dialog open={!!editingVendedor} onOpenChange={() => setEditingVendedor(null)}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <Target className="h-5 w-5 text-primary" />
               Metas de {editingVendedor?.nome}
             </DialogTitle>
             <DialogDescription>
               Configure metas personalizadas para este vendedor no mês atual.
             </DialogDescription>
           </DialogHeader>
 
           <div className="space-y-4">
             <div className="flex items-center justify-between rounded-lg border p-3">
               <div>
                 <p className="font-medium">Usar meta individual</p>
                 <p className="text-sm text-muted-foreground">
                   Desativado usa valores globais
                 </p>
               </div>
               <Switch
                 checked={editingMeta.usa_meta_individual ?? false}
                 onCheckedChange={(checked) =>
                   setEditingMeta({ ...editingMeta, usa_meta_individual: checked })
                 }
               />
             </div>
 
             {editingMeta.usa_meta_individual && (
               <div className="space-y-4 pt-2">
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Meta Orçamentos</Label>
                     <Input
                       type="number"
                       value={editingMeta.meta_orcamentos ?? ""}
                       onChange={(e) =>
                         setEditingMeta({
                           ...editingMeta,
                           meta_orcamentos: parseInt(e.target.value) || 0,
                         })
                       }
                     />
                   </div>
                   <div className="space-y-2">
                     <Label>Meta Conversões</Label>
                     <Input
                       type="number"
                       value={editingMeta.meta_conversoes ?? ""}
                       onChange={(e) =>
                         setEditingMeta({
                           ...editingMeta,
                           meta_conversoes: parseInt(e.target.value) || 0,
                         })
                       }
                     />
                   </div>
                 </div>
 
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Meta Valor (R$)</Label>
                     <Input
                       type="number"
                       value={editingMeta.meta_valor ?? ""}
                       onChange={(e) =>
                         setEditingMeta({
                           ...editingMeta,
                           meta_valor: parseFloat(e.target.value) || 0,
                         })
                       }
                     />
                   </div>
                   <div className="space-y-2">
                     <Label>Comissão (%)</Label>
                     <Input
                       type="number"
                       step="0.1"
                       value={editingMeta.comissao_percent ?? ""}
                       onChange={(e) =>
                         setEditingMeta({
                           ...editingMeta,
                           comissao_percent: parseFloat(e.target.value) || 0,
                         })
                       }
                     />
                   </div>
                 </div>
               </div>
             )}
           </div>
 
           <DialogFooter>
             <Button variant="outline" onClick={() => setEditingVendedor(null)}>
               Cancelar
             </Button>
             <Button onClick={handleSaveMeta} disabled={saving} className="gap-2">
               {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
               Salvar
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </>
   );
 }