import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scale, Landmark, Settings2 } from "lucide-react";
import { FioBConfig } from "@/components/admin/engenharia/FioBConfig";
import { ICMSConfig } from "@/components/admin/engenharia/ICMSConfig";
import { PaybackGeneralConfig } from "@/components/admin/engenharia/PaybackGeneralConfig";

export function TabTributacao() {
  const [subTab, setSubTab] = useState("fiob");

  return (
    <Tabs value={subTab} onValueChange={setSubTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 h-auto">
        <TabsTrigger value="fiob" className="gap-2 text-xs sm:text-sm py-2">
          <Scale className="w-4 h-4 text-info" />
          <span className="hidden sm:inline">Fio B</span>
          <span className="sm:hidden">Fio B</span>
        </TabsTrigger>
        <TabsTrigger value="icms" className="gap-2 text-xs sm:text-sm py-2">
          <Landmark className="w-4 h-4 text-success" />
          <span className="hidden sm:inline">ICMS / Tributação</span>
          <span className="sm:hidden">ICMS</span>
        </TabsTrigger>
        <TabsTrigger value="geral" className="gap-2 text-xs sm:text-sm py-2">
          <Settings2 className="w-4 h-4 text-secondary" />
          <span className="hidden sm:inline">Config. Geral</span>
          <span className="sm:hidden">Geral</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="fiob" className="mt-4">
        <FioBConfig />
      </TabsContent>
      <TabsContent value="icms" className="mt-4">
        <ICMSConfig />
      </TabsContent>
      <TabsContent value="geral" className="mt-4">
        <PaybackGeneralConfig />
      </TabsContent>
    </Tabs>
  );
}
