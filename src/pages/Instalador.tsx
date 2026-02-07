 import { useEffect, useState, useCallback } from "react";
 import { useNavigate, useSearchParams } from "react-router-dom";
 import { useAuth } from "@/hooks/useAuth";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent } from "@/components/ui/card";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Calendar } from "@/components/ui/calendar";
 import { format, isSameDay, parseISO } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import { Loader2, CalendarDays, List } from "lucide-react";
 import { toast } from "@/hooks/use-toast";
 import { ServicoEmAndamento } from "@/components/instalador/ServicoEmAndamento";
 import { InstaladorHeader } from "@/components/instalador/InstaladorHeader";
 import { InstaladorStatsCards } from "@/components/instalador/InstaladorStatsCards";
 import { ServicoCard, type ServicoAgendado } from "@/components/instalador/ServicoCard";
 import Footer from "@/components/layout/Footer";
 
 export default function Instalador() {
   const { user, loading: authLoading, signOut } = useAuth();
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const adminAsInstalador = searchParams.get("as"); // Admin viewing as specific installer
   
   const [servicos, setServicos] = useState<ServicoAgendado[]>([]);
   const [loading, setLoading] = useState(true);
   const [selectedDate, setSelectedDate] = useState<Date>(new Date());
   const [view, setView] = useState<"lista" | "calendario">("lista");
   const [hasAccess, setHasAccess] = useState(false);
   const [accessChecked, setAccessChecked] = useState(false);
   const [activeServico, setActiveServico] = useState<ServicoAgendado | null>(null);
   const [isAdminMode, setIsAdminMode] = useState(false);
   const [targetInstaladorId, setTargetInstaladorId] = useState<string | null>(null);
   const [instaladorName, setInstaladorName] = useState<string | null>(null);
 
   useEffect(() => {
     if (!authLoading && !user) {
       navigate("/auth?from=instalador", { replace: true });
       return;
     }
 
    if (user && !accessChecked) {
       checkAccess();
     }
  }, [user, authLoading, navigate, accessChecked]);
 
   const checkAccess = async () => {
     if (!user) return;

     try {
       const { data: roles, error } = await supabase
         .from("user_roles")
         .select("role")
         .eq("user_id", user.id);

       if (error) throw error;

       const isInstalador = roles?.some(r => r.role === "instalador");
       const isAdmin = roles?.some(r => ["admin", "gerente"].includes(r.role));

       if (!isInstalador && !isAdmin) {
        setAccessChecked(true);
         navigate("/portal", { replace: true });
         return;
       }

       // Admin viewing as specific installer (via ?as=user_id parameter)
       if (isAdmin && adminAsInstalador) {
         setIsAdminMode(true);
         setTargetInstaladorId(adminAsInstalador);
         
         // Try to get instalador name from profiles
         const { data: profile } = await supabase
           .from("profiles")
           .select("nome")
           .eq("id", adminAsInstalador)
           .single();
         
         if (profile?.nome) {
           setInstaladorName(profile.nome);
         }
       } else if (isInstalador) {
         // Regular instalador viewing their own portal
         setTargetInstaladorId(user.id);
       } else if (isAdmin && !adminAsInstalador) {
         // Admin without ?as parameter - redirect to portal selector
         setAccessChecked(true);
         navigate("/portal", { replace: true });
         return;
       }

       setHasAccess(true);
      setAccessChecked(true);
     } catch (error) {
       console.error("Error checking access:", error);
      setAccessChecked(true);
       navigate("/portal", { replace: true });
     }
   };
 
   const fetchServicos = useCallback(async () => {
     if (!targetInstaladorId) return;

     setLoading(true);
     try {
       const { data, error } = await supabase
         .from("servicos_agendados")
         .select(`
           id,
           tipo,
           status,
           data_agendada,
           hora_inicio,
           hora_fim,
           data_hora_inicio,
           data_hora_fim,
           endereco,
           bairro,
           cidade,
           descricao,
           observacoes,
           observacoes_conclusao,
           fotos_urls,
           cliente:clientes(nome, telefone)
         `)
         .eq("instalador_id", targetInstaladorId)
         .order("data_agendada", { ascending: true });

       if (error) throw error;
       setServicos(data || []);
     } catch (error) {
       console.error("Error fetching servicos:", error);
       toast({
         title: "Erro ao carregar serviços",
         description: "Tente novamente mais tarde.",
         variant: "destructive",
       });
     } finally {
       setLoading(false);
     }
   }, [targetInstaladorId]);

   // Fetch servicos when targetInstaladorId is set
   useEffect(() => {
     if (targetInstaladorId && hasAccess) {
       fetchServicos();
     }
   }, [targetInstaladorId, hasAccess, fetchServicos]);
 
   const updateServicoStatus = async (id: string, status: "agendado" | "em_andamento" | "concluido" | "cancelado" | "reagendado") => {
     try {
       const { error } = await supabase
         .from("servicos_agendados")
         .update({ status })
         .eq("id", id);
 
       if (error) throw error;
 
       toast({
         title: "Status atualizado",
         description: `Status do serviço atualizado`,
       });
 
       fetchServicos();
     } catch (error) {
       console.error("Error updating status:", error);
       toast({
         title: "Erro ao atualizar",
         description: "Tente novamente.",
         variant: "destructive",
       });
     }
   };
 
   const handleSignOut = async () => {
     await signOut();
     navigate("/auth");
   };
 
   const servicosHoje = servicos.filter(s => 
     isSameDay(parseISO(s.data_agendada), new Date())
   );
 
   const servicosSelecionados = servicos.filter(s =>
     isSameDay(parseISO(s.data_agendada), selectedDate)
   );
 
   const diasComServico = servicos.map(s => parseISO(s.data_agendada));
 
   const handleOpenServico = (servico: ServicoAgendado) => {
     setActiveServico(servico);
   };
 
   const handleCloseServico = () => {
     setActiveServico(null);
   };
 
   const handleServiceUpdated = () => {
     fetchServicos();
   };
 
  if (authLoading || (!accessChecked)) {
     return (
       <div className="min-h-screen flex items-center justify-center">
         <Loader2 className="w-8 h-8 animate-spin text-primary" />
       </div>
     );
   }

  if (accessChecked && !hasAccess) {
     return null;
  }
 
   return (
     <>
       {activeServico && (
         <ServicoEmAndamento
           servico={activeServico}
           onClose={handleCloseServico}
           onServiceUpdated={handleServiceUpdated}
         />
       )}
 
       <div className="min-h-screen flex flex-col bg-muted/30">
         <InstaladorHeader 
           userName={isAdminMode && instaladorName ? instaladorName : user?.email} 
           onSignOut={handleSignOut}
           isAdminMode={isAdminMode}
         />
 
         <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl space-y-6">
           <InstaladorStatsCards
             servicosHoje={servicosHoje.length}
             servicosEmAndamento={servicos.filter(s => s.status === "em_andamento").length}
             servicosConcluidos={servicos.filter(s => s.status === "concluido").length}
           />
 
           <Tabs value={view} onValueChange={(v) => setView(v as "lista" | "calendario")} className="space-y-6">
             <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-card shadow-sm border">
               <TabsTrigger value="lista" className="gap-2">
                 <List className="h-4 w-4" />
                 Lista
               </TabsTrigger>
               <TabsTrigger value="calendario" className="gap-2">
                 <CalendarDays className="h-4 w-4" />
                 Calendário
               </TabsTrigger>
             </TabsList>
 
             <TabsContent value="lista" className="space-y-4">
               {loading ? (
                 <div className="flex flex-col items-center justify-center py-16">
                   <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                   <span className="text-sm text-muted-foreground">Carregando serviços...</span>
                </div>
               ) : servicos.filter(s => s.status !== "cancelado" && s.status !== "concluido").length === 0 ? (
                 <Card className="text-center py-16 border-dashed border-2">
                   <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4 mx-auto">
                     <CalendarDays className="h-8 w-8 text-muted-foreground" />
                   </div>
                   <h3 className="font-semibold text-foreground mb-1">Nenhum serviço agendado</h3>
                   <p className="text-muted-foreground text-sm">Novos atendimentos aparecerão aqui</p>
                 </Card>
               ) : (
                 <div className="space-y-4">
                   {servicos
                     .filter(s => s.status !== "cancelado" && s.status !== "concluido")
                     .map(servico => (
                       <ServicoCard key={servico.id} servico={servico} onOpenServico={handleOpenServico} />
                     ))
                   }
                 </div>
               )}
             </TabsContent>
 
             <TabsContent value="calendario" className="space-y-6">
               <Card className="shadow-sm">
                 <CardContent className="p-4 sm:p-5">
                 <Calendar
                   mode="single"
                   selected={selectedDate}
                   onSelect={(date) => date && setSelectedDate(date)}
                   locale={ptBR}
                     className="mx-auto"
                   modifiers={{
                     hasService: diasComServico,
                   }}
                   modifiersStyles={{
                     hasService: {
                         fontWeight: "700",
                         backgroundColor: "hsl(var(--primary) / 0.15)",
                         color: "hsl(var(--primary))",
                         borderRadius: "50%",
                     },
                   }}
                 />
               </CardContent>
             </Card>
 
               <div className="space-y-4">
                 <div className="flex items-center gap-3 pb-2 border-b">
                   <div className="p-2 rounded-lg bg-muted">
                     <CalendarDays className="h-5 w-5 text-muted-foreground" />
                   </div>
                   <h3 className="font-semibold text-lg text-foreground">
                     {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                   </h3>
                </div>
 
                 {servicosSelecionados.length === 0 ? (
                   <Card className="text-center py-10 border-dashed border-2">
                     <p className="text-muted-foreground">Nenhum serviço neste dia</p>
                   </Card>
                 ) : (
                   servicosSelecionados.map(servico => (
                     <ServicoCard key={servico.id} servico={servico} onOpenServico={handleOpenServico} />
                   ))
                 )}
               </div>
             </TabsContent>
           </Tabs>
         </main>
 
         <Footer />
       </div>
     </>
   );
 }