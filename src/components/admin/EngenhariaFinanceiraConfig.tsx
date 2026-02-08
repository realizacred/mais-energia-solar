import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scale, Landmark, Settings2, Building } from "lucide-react";
import { FioBConfig } from "./engenharia/FioBConfig";
import { ICMSConfig } from "./engenharia/ICMSConfig";
import { PaybackGeneralConfig } from "./engenharia/PaybackGeneralConfig";

export function EngenhariaFinanceiraConfig() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="fiob" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="fiob" className="gap-2 text-xs sm:text-sm py-2">
            <Scale className="w-4 h-4" />
            <span className="hidden sm:inline">Fio B</span>
            <span className="sm:hidden">Fio B</span>
          </TabsTrigger>
          <TabsTrigger value="icms" className="gap-2 text-xs sm:text-sm py-2">
            <Landmark className="w-4 h-4" />
            <span className="hidden sm:inline">ICMS / Tributação</span>
            <span className="sm:hidden">ICMS</span>
          </TabsTrigger>
          <TabsTrigger value="geral" className="gap-2 text-xs sm:text-sm py-2">
            <Settings2 className="w-4 h-4" />
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
    </div>
  );
}
