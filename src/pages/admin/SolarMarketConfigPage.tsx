import { Sun } from "lucide-react";
import { lazy, Suspense } from "react";
import ApiKeyConfigPage from "@/components/admin/integrations/ApiKeyConfigPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

const SmCustomFieldsManager = lazy(() => import("@/components/admin/solarmarket/SmCustomFieldsManager"));

export default function SolarMarketConfigPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="api-key" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="api-key">API Key</TabsTrigger>
          <TabsTrigger value="custom-fields">Campos Personalizados</TabsTrigger>
        </TabsList>

        <TabsContent value="api-key">
          <ApiKeyConfigPage
            serviceKey="solarmarket"
            title="SolarMarket"
            description="Configure sua chave de API para consultar preços e equipamentos"
            icon={Sun}
            helpText="Insira sua API key do SolarMarket para importar cotações de equipamentos"
            helpUrl="https://solarmarket.com.br"
          />
        </TabsContent>

        <TabsContent value="custom-fields">
          <Suspense fallback={<div className="flex items-center justify-center py-8 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>}>
            <SmCustomFieldsManager />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
