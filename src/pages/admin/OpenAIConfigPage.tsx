import { Bot } from "lucide-react";
import ApiKeyConfigPage from "@/components/admin/integrations/ApiKeyConfigPage";

export default function OpenAIConfigPage() {
  return (
    <ApiKeyConfigPage
      serviceKey="openai"
      title="OpenAI"
      description="Configure sua chave de API para usar modelos GPT"
      icon={Bot}
      helpText="Insira sua API key do OpenAI para habilitar funcionalidades de IA no sistema"
      helpUrl="https://platform.openai.com/api-keys"
      testEndpoint={{
        url: () => "https://api.openai.com/v1/models",
        headers: (key) => ({ Authorization: `Bearer ${key}` }),
      }}
    />
  );
}
