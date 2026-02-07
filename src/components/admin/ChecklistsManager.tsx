 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Badge } from "@/components/ui/badge";
 import { 
 Table, 
 TableBody, 
 TableCell, 
 TableHead, 
 TableHeader, 
 TableRow 
 } from "@/components/ui/table";
 import { 
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 } from "@/components/ui/dialog";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { toast } from "@/hooks/use-toast";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import {
 ClipboardCheck,
 Search,
 Loader2,
 Eye,
 MapPin,
 Calendar,
 User,
 CheckCircle,
 XCircle,
 Camera,
 Signature,
 Star,
 RefreshCw,
 } from "lucide-react";
 
 interface Checklist {
 id: string;
 data_instalacao: string;
 endereco: string;
 bairro: string | null;
 lead_code: string | null;
 nome_cliente: string;
 placas_local_aprovado: boolean;
 inversor_local_aprovado: boolean;
 avaliacao_atendimento: string;
 adesivo_inversor: boolean;
 plaquinha_relogio: boolean;
 configuracao_wifi: boolean;
 foto_servico: boolean;
 observacoes: string | null;
 fotos_urls: string[];
 assinatura_cliente_url: string | null;
 assinatura_instalador_url: string | null;
 synced: boolean;
 created_at: string;
 instalador_id: string;
 }
 
 const avaliacaoLabels: Record<string, { label: string; color: string; emoji: string }> = {
 otimo: { label: "Ótimo", color: "bg-green-500", emoji: "😄" },
 bom: { label: "Bom", color: "bg-blue-500", emoji: "🙂" },
 razoavel: { label: "Razoável", color: "bg-yellow-500", emoji: "😐" },
 ruim: { label: "Ruim", color: "bg-orange-500", emoji: "😕" },
 muito_ruim: { label: "Muito Ruim", color: "bg-red-500", emoji: "😞" },
 };
 
 export function ChecklistsManager() {
 const [checklists, setChecklists] = useState<Checklist[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchTerm, setSearchTerm] = useState("");
 const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
 const [viewDialogOpen, setViewDialogOpen] = useState(false);
 
 const fetchChecklists = async () => {
   setLoading(true);
   try {
     const { data, error } = await supabase
       .from("checklists_instalacao")
       .select("*")
       .order("created_at", { ascending: false });
 
     if (error) throw error;
     setChecklists(data || []);
   } catch (error) {
     console.error("Error fetching checklists:", error);
     toast({
       title: "Erro ao carregar checklists",
       variant: "destructive",
     });
   } finally {
     setLoading(false);
   }
 };
 
 useEffect(() => {
   fetchChecklists();
 }, []);
 
 const filteredChecklists = checklists.filter(
   (c) =>
     c.nome_cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
     c.endereco.toLowerCase().includes(searchTerm.toLowerCase()) ||
     c.lead_code?.toLowerCase().includes(searchTerm.toLowerCase())
 );
 
 const stats = {
   total: checklists.length,
   otimo: checklists.filter((c) => c.avaliacao_atendimento === "otimo").length,
   bom: checklists.filter((c) => c.avaliacao_atendimento === "bom").length,
   outros: checklists.filter(
     (c) => !["otimo", "bom"].includes(c.avaliacao_atendimento)
   ).length,
   pendentesSync: checklists.filter((c) => !c.synced).length,
 };
 
 const openViewDialog = (checklist: Checklist) => {
   setSelectedChecklist(checklist);
   setViewDialogOpen(true);
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
     {/* Stats Cards */}
     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
       <Card>
         <CardContent className="pt-4">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-primary/10 rounded-lg">
               <ClipboardCheck className="h-5 w-5 text-primary" />
             </div>
             <div>
               <p className="text-2xl font-bold">{stats.total}</p>
               <p className="text-xs text-muted-foreground">Total</p>
             </div>
           </div>
         </CardContent>
       </Card>
       <Card>
         <CardContent className="pt-4">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-green-500/10 rounded-lg">
               <Star className="h-5 w-5 text-green-500" />
             </div>
             <div>
               <p className="text-2xl font-bold">{stats.otimo}</p>
               <p className="text-xs text-muted-foreground">Ótimo</p>
             </div>
           </div>
         </CardContent>
       </Card>
       <Card>
         <CardContent className="pt-4">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-500/10 rounded-lg">
               <Star className="h-5 w-5 text-blue-500" />
             </div>
             <div>
               <p className="text-2xl font-bold">{stats.bom}</p>
               <p className="text-xs text-muted-foreground">Bom</p>
             </div>
           </div>
         </CardContent>
       </Card>
       <Card>
         <CardContent className="pt-4">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-orange-500/10 rounded-lg">
               <RefreshCw className="h-5 w-5 text-orange-500" />
             </div>
             <div>
               <p className="text-2xl font-bold">{stats.pendentesSync}</p>
               <p className="text-xs text-muted-foreground">Pendente Sync</p>
             </div>
           </div>
         </CardContent>
       </Card>
     </div>
 
     {/* Search and Table */}
     <Card>
       <CardHeader className="pb-3">
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
           <CardTitle className="flex items-center gap-2">
             <ClipboardCheck className="h-5 w-5" />
             Registros de Serviço
           </CardTitle>
           <div className="relative w-full sm:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Buscar por cliente, endereço..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-9"
             />
           </div>
         </div>
       </CardHeader>
       <CardContent>
         {filteredChecklists.length === 0 ? (
           <div className="text-center py-12 text-muted-foreground">
             <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
             <p>Nenhum checklist encontrado</p>
           </div>
         ) : (
           <div className="overflow-x-auto">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Data</TableHead>
                   <TableHead>Cliente</TableHead>
                   <TableHead>Endereço</TableHead>
                   <TableHead>Lead</TableHead>
                   <TableHead>Avaliação</TableHead>
                   <TableHead>Sync</TableHead>
                   <TableHead className="text-right">Ações</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {filteredChecklists.map((checklist) => {
                   const avaliacao = avaliacaoLabels[checklist.avaliacao_atendimento];
                   return (
                     <TableRow key={checklist.id}>
                       <TableCell className="whitespace-nowrap">
                         {format(new Date(checklist.data_instalacao), "dd/MM/yyyy", {
                           locale: ptBR,
                         })}
                       </TableCell>
                       <TableCell className="font-medium">
                         {checklist.nome_cliente}
                       </TableCell>
                       <TableCell className="max-w-[200px] truncate">
                         {checklist.endereco}
                         {checklist.bairro && `, ${checklist.bairro}`}
                       </TableCell>
                       <TableCell>
                         {checklist.lead_code ? (
                           <Badge variant="outline">{checklist.lead_code}</Badge>
                         ) : (
                           <span className="text-muted-foreground">-</span>
                         )}
                       </TableCell>
                       <TableCell>
                         <Badge className={`${avaliacao?.color} text-white`}>
                           {avaliacao?.emoji} {avaliacao?.label}
                         </Badge>
                       </TableCell>
                       <TableCell>
                         {checklist.synced ? (
                           <CheckCircle className="h-4 w-4 text-green-500" />
                         ) : (
                           <RefreshCw className="h-4 w-4 text-orange-500" />
                         )}
                       </TableCell>
                       <TableCell className="text-right">
                         <Button
                           variant="ghost"
                           size="icon"
                           onClick={() => openViewDialog(checklist)}
                         >
                           <Eye className="h-4 w-4" />
                         </Button>
                       </TableCell>
                     </TableRow>
                   );
                 })}
               </TableBody>
             </Table>
           </div>
         )}
       </CardContent>
     </Card>
 
     {/* View Dialog */}
     <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
       <DialogContent className="max-w-2xl max-h-[90vh]">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <ClipboardCheck className="h-5 w-5" />
             Detalhes do Checklist
           </DialogTitle>
         </DialogHeader>
         {selectedChecklist && (
           <ScrollArea className="max-h-[70vh] pr-4">
             <div className="space-y-6">
               {/* Info básica */}
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <p className="text-xs text-muted-foreground flex items-center gap-1">
                     <User className="h-3 w-3" /> Cliente
                   </p>
                   <p className="font-medium">{selectedChecklist.nome_cliente}</p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-xs text-muted-foreground flex items-center gap-1">
                     <Calendar className="h-3 w-3" /> Data
                   </p>
                   <p className="font-medium">
                     {format(new Date(selectedChecklist.data_instalacao), "dd/MM/yyyy", {
                       locale: ptBR,
                     })}
                   </p>
                 </div>
                 <div className="col-span-2 space-y-1">
                   <p className="text-xs text-muted-foreground flex items-center gap-1">
                     <MapPin className="h-3 w-3" /> Endereço
                   </p>
                   <p className="font-medium">
                     {selectedChecklist.endereco}
                     {selectedChecklist.bairro && `, ${selectedChecklist.bairro}`}
                   </p>
                 </div>
               </div>
 
               {/* Avaliação */}
               <div className="p-4 bg-muted/50 rounded-lg">
                 <p className="text-sm font-medium mb-2">Avaliação do Cliente</p>
                 {(() => {
                   const av = avaliacaoLabels[selectedChecklist.avaliacao_atendimento];
                   return (
                     <div className="flex items-center gap-3">
                       <span className="text-4xl">{av?.emoji}</span>
                       <Badge className={`${av?.color} text-white text-lg px-4 py-1`}>
                         {av?.label}
                       </Badge>
                     </div>
                   );
                 })()}
               </div>
 
               {/* Checklist items */}
               <div className="space-y-3">
                 <p className="text-sm font-medium">Itens do Checklist</p>
                 <div className="grid grid-cols-2 gap-2">
                   {[
                     { label: "Placas local aprovado", value: selectedChecklist.placas_local_aprovado },
                     { label: "Inversor local aprovado", value: selectedChecklist.inversor_local_aprovado },
                     { label: "Adesivo inversor", value: selectedChecklist.adesivo_inversor },
                     { label: "Plaquinha relógio", value: selectedChecklist.plaquinha_relogio },
                     { label: "Configuração WiFi", value: selectedChecklist.configuracao_wifi },
                     { label: "Foto do serviço", value: selectedChecklist.foto_servico },
                   ].map((item) => (
                     <div
                       key={item.label}
                       className="flex items-center gap-2 p-2 bg-muted/30 rounded"
                     >
                       {item.value ? (
                         <CheckCircle className="h-4 w-4 text-green-500" />
                       ) : (
                         <XCircle className="h-4 w-4 text-red-500" />
                       )}
                       <span className="text-sm">{item.label}</span>
                     </div>
                   ))}
                 </div>
               </div>
 
               {/* Observações */}
               {selectedChecklist.observacoes && (
                 <div className="space-y-2">
                   <p className="text-sm font-medium">Observações</p>
                   <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
                     {selectedChecklist.observacoes}
                   </p>
                 </div>
               )}
 
               {/* Fotos */}
               {selectedChecklist.fotos_urls && selectedChecklist.fotos_urls.length > 0 && (
                 <div className="space-y-2">
                   <p className="text-sm font-medium flex items-center gap-1">
                     <Camera className="h-4 w-4" /> Fotos ({selectedChecklist.fotos_urls.length})
                   </p>
                   <div className="grid grid-cols-3 gap-2">
                     {selectedChecklist.fotos_urls.map((url, i) => (
                       <img
                         key={i}
                         src={url}
                         alt={`Foto ${i + 1}`}
                         className="w-full aspect-square object-cover rounded-lg border"
                       />
                     ))}
                   </div>
                 </div>
               )}
 
               {/* Assinaturas */}
               <div className="grid grid-cols-2 gap-4">
                 {selectedChecklist.assinatura_cliente_url && (
                   <div className="space-y-2">
                     <p className="text-sm font-medium flex items-center gap-1">
                       <Signature className="h-4 w-4" /> Assinatura Cliente
                     </p>
                     <img
                       src={selectedChecklist.assinatura_cliente_url}
                       alt="Assinatura Cliente"
                       className="w-full h-24 object-contain bg-white border rounded"
                     />
                   </div>
                 )}
                 {selectedChecklist.assinatura_instalador_url && (
                   <div className="space-y-2">
                     <p className="text-sm font-medium flex items-center gap-1">
                       <Signature className="h-4 w-4" /> Assinatura Instalador
                     </p>
                     <img
                       src={selectedChecklist.assinatura_instalador_url}
                       alt="Assinatura Instalador"
                       className="w-full h-24 object-contain bg-white border rounded"
                     />
                   </div>
                 )}
               </div>
             </div>
           </ScrollArea>
         )}
       </DialogContent>
     </Dialog>
   </div>
 );
 }