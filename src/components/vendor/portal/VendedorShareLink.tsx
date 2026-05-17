import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, MessageCircle } from "lucide-react";
import { getPublicUrl } from "@/lib/getPublicUrl";

interface VendedorShareLinkProps {
  slug: string;
  onCopy: () => void;
}

export function VendedorShareLink({ slug, onCopy }: VendedorShareLinkProps) {
  const link = `${getPublicUrl()}/v/${slug}`;
 
   return (
     <Card className="border-primary/20">
       <CardHeader className="pb-2">
         <CardTitle className="text-base flex items-center gap-2">
           <ExternalLink className="h-4 w-4" />
           Seu Link de Consultor
         </CardTitle>
         <CardDescription>
           Compartilhe este link com seus clientes para captar orçamentos
         </CardDescription>
       </CardHeader>
       <CardContent>
         <div className="flex flex-col sm:flex-row gap-2">
           <Input readOnly value={link} className="bg-background flex-1" />
           <div className="flex gap-2 shrink-0">
            <Button onClick={onCopy} variant="secondary" className="flex-1 sm:flex-none">
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </Button>
            <Button 
              onClick={() => window.open(`https://wa.me/?text=Solicite seu orçamento agora mesmo através deste link: ${link}`, '_blank')} 
              variant="outline"
              className="border-success text-success hover:bg-success/10 flex-1 sm:flex-none"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
           </div>
         </div>
       </CardContent>
     </Card>
   );
 }