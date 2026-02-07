 import { useState } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { toast } from "@/hooks/use-toast";
 import { Loader2, CheckCircle2, Sun, Sparkles } from "lucide-react";
 import { StarRating } from "@/components/ui/star-rating";
 import logoBrancaImg from "@/assets/logo-branca.png";
 
 // Mapeamento de estrelas para valores de avaliação
 const starToValue: Record<number, string> = {
   1: "muito_ruim",
   2: "ruim",
   3: "razoavel",
   4: "bom",
   5: "otimo",
 };
 
 export default function Avaliacao() {
   const [nome, setNome] = useState("");
   const [endereco, setEndereco] = useState("");
   const [rating, setRating] = useState(0);
   const [observacoes, setObservacoes] = useState("");
   const [submitting, setSubmitting] = useState(false);
   const [submitted, setSubmitted] = useState(false);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     if (!nome.trim() || !endereco.trim() || rating === 0) {
       toast({
         title: "Campos obrigatórios",
         description: "Por favor, preencha seu nome, endereço e selecione uma avaliação.",
         variant: "destructive",
       });
       return;
     }
 
     setSubmitting(true);
     try {
       const avaliacaoValue = starToValue[rating] || "razoavel";
       
       const { error } = await supabase
         .from("checklists_instalacao")
         .insert({
           nome_cliente: nome.trim(),
           endereco: endereco.trim(),
           avaliacao_atendimento: avaliacaoValue,
           observacoes: observacoes.trim() || null,
           data_instalacao: new Date().toISOString().split('T')[0],
           instalador_id: "00000000-0000-0000-0000-000000000000",
         });
 
       if (error) throw error;
 
       setSubmitted(true);
       toast({
         title: "Avaliação enviada!",
         description: "Muito obrigado pelo seu feedback!",
       });
     } catch (error) {
       console.error("Error submitting evaluation:", error);
       toast({
         title: "Erro ao enviar",
         description: "Tente novamente em alguns instantes.",
         variant: "destructive",
       });
     } finally {
       setSubmitting(false);
     }
   };
 
   if (submitted) {
     return (
       <div className="min-h-screen gradient-mesh flex items-center justify-center p-4">
         <Card className="w-full max-w-md text-center animate-scale-in shadow-xl">
           <CardContent className="pt-10 pb-10">
             <div className="relative w-24 h-24 mx-auto mb-6">
               <div className="absolute inset-0 bg-success/20 rounded-full animate-ping" />
               <div className="relative w-24 h-24 bg-success/10 rounded-full flex items-center justify-center">
                 <CheckCircle2 className="h-12 w-12 text-success" />
               </div>
             </div>
             <h2 className="text-2xl font-bold text-foreground mb-3">
               Obrigado pela sua avaliação!
             </h2>
             <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
               Seu feedback é muito importante para continuarmos melhorando nossos serviços de energia solar.
             </p>
             <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary">
               <Sun className="h-5 w-5" />
               <span className="font-medium">Mais Economia para Você!</span>
             </div>
           </CardContent>
         </Card>
       </div>
     );
   }
 
   return (
     <div className="min-h-screen gradient-mesh">
       {/* Header corporativo */}
       <header className="gradient-blue text-white py-5 shadow-lg">
         <div className="container mx-auto px-4 flex items-center justify-center">
           <img src={logoBrancaImg} alt="Mais Energia Solar" className="h-10 sm:h-12" />
         </div>
       </header>
 
       <main className="container mx-auto px-4 py-8 sm:py-12 max-w-lg">
         <Card className="shadow-xl border-0 animate-fade-in">
           <CardHeader className="text-center pb-4">
             <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3">
               <Sparkles className="h-8 w-8 text-primary" />
             </div>
             <CardTitle className="text-2xl sm:text-3xl">Avalie Nosso Atendimento</CardTitle>
             <CardDescription className="text-base mt-2">
               Sua opinião é muito importante para nós!
             </CardDescription>
           </CardHeader>
           
           <CardContent>
             <form onSubmit={handleSubmit} className="space-y-6">
               {/* Nome */}
               <div className="space-y-2">
                 <label className="text-sm font-medium text-foreground">
                   Seu Nome <span className="text-destructive">*</span>
                 </label>
                 <Input
                   value={nome}
                   onChange={(e) => setNome(e.target.value)}
                   placeholder="Digite seu nome completo"
                   disabled={submitting}
                   className="h-12"
                 />
               </div>
 
               {/* Endereço */}
               <div className="space-y-2">
                 <label className="text-sm font-medium text-foreground">
                   Endereço da Instalação <span className="text-destructive">*</span>
                 </label>
                 <Input
                   value={endereco}
                   onChange={(e) => setEndereco(e.target.value)}
                   placeholder="Rua, número, bairro"
                   disabled={submitting}
                   className="h-12"
                 />
               </div>
 
               {/* Avaliação com Estrelas */}
               <div className="space-y-4">
                 <label className="text-sm font-medium text-foreground block text-center">
                   Como você avalia nosso atendimento? <span className="text-destructive">*</span>
                 </label>
                 <div className="flex justify-center py-4 bg-muted/30 rounded-xl">
                   <StarRating
                     value={rating}
                     onChange={setRating}
                     size="xl"
                     showLabel
                   />
                 </div>
               </div>
 
               {/* Observações */}
               <div className="space-y-2">
                 <label className="text-sm font-medium text-foreground">
                   Observações (opcional)
                 </label>
                 <Textarea
                   value={observacoes}
                   onChange={(e) => setObservacoes(e.target.value)}
                   placeholder="Conte-nos mais sobre sua experiência..."
                   rows={4}
                   disabled={submitting}
                   className="resize-none"
                 />
               </div>
 
               <Button 
                 type="submit" 
                 size="xl"
                 className="w-full shadow-primary hover-glow-primary"
                 disabled={submitting || rating === 0}
               >
                 {submitting ? (
                   <>
                     <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                     Enviando...
                   </>
                 ) : (
                   "Enviar Avaliação"
                 )}
               </Button>
             </form>
           </CardContent>
         </Card>
 
         <p className="text-center text-sm text-muted-foreground mt-8">
           Obrigado por escolher nossos serviços de energia solar! ☀️
         </p>
       </main>
     </div>
   );
 }