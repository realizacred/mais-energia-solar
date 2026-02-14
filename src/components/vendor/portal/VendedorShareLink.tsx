import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
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
         <div className="flex gap-2">
           <Input readOnly value={link} className="bg-background" />
           <Button onClick={onCopy} variant="secondary">
             <Copy className="h-4 w-4 mr-2" />
             Copiar
           </Button>
         </div>
       </CardContent>
     </Card>
   );
 }