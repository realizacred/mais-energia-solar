import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, PenTool } from "lucide-react";
import { TemplatesTab } from "./TemplatesTab";
import { SignatureTab } from "./SignatureTab";

export function DocumentosPage() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="modelos">
        <TabsList className="h-9">
          <TabsTrigger value="modelos" className="text-xs gap-1.5 h-8">
            <FileText className="h-3.5 w-3.5" />
            Modelos de documentos
          </TabsTrigger>
          <TabsTrigger value="assinatura" className="text-xs gap-1.5 h-8">
            <PenTool className="h-3.5 w-3.5" />
            Assinatura eletrônica
          </TabsTrigger>
        </TabsList>
        <TabsContent value="modelos" className="mt-4">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="assinatura" className="mt-4">
          <SignatureTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
