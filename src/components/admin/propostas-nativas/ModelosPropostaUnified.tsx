/**
 * Modelos de Proposta — Sub-abas "Modelo WEB" (editor visual HTML)
 * e "Modelo DOC" (upload DOCX).
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, FileText } from "lucide-react";
import { TemplatesTab as ModeloWebTab } from "@/components/admin/conf-solar/tabs/TemplatesTab";
import { TemplatesManager as ModeloDocTab } from "./TemplatesManager";

export function ModelosPropostaUnified() {
  const [subTab, setSubTab] = useState("web");

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="h-auto bg-transparent border-b border-border rounded-none p-0 gap-0">
          <TabsTrigger
            value="web"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm gap-1.5"
          >
            <Globe className="h-3.5 w-3.5" />
            Modelo WEB
          </TabsTrigger>
          <TabsTrigger
            value="doc"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            Modelo DOC
          </TabsTrigger>
        </TabsList>

        <TabsContent value="web" className="mt-4">
          <ModeloWebTab />
        </TabsContent>
        <TabsContent value="doc" className="mt-4">
          <ModeloDocTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
