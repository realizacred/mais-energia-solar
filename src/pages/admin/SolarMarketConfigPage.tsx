import { Sun } from "lucide-react";
import ApiKeyConfigPage from "@/components/admin/integrations/ApiKeyConfigPage";

export default function SolarMarketConfigPage() {
  return (
    <ApiKeyConfigPage
      serviceKey="solarmarket"
      title="SolarMarket"
      description="Configure sua chave de API para consultar preços e equipamentos"
      icon={Sun}
      helpText="Insira sua API key do SolarMarket para importar cotações de equipamentos"
      helpUrl="https://solarmarket.com.br"
    />
  );
}
