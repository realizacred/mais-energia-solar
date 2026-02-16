import { Sparkles } from "lucide-react";
import ApiKeyConfigPage from "@/components/admin/integrations/ApiKeyConfigPage";

export default function GeminiConfigPage() {
  return (
    <ApiKeyConfigPage
      serviceKey="google_gemini"
      title="Google Gemini"
      description="Configure sua chave de API para usar modelos Gemini"
      icon={Sparkles}
      helpText="Insira sua API key do Google AI Studio para habilitar o Gemini"
      helpUrl="https://aistudio.google.com/apikey"
      testEndpoint={{
        url: (key) => `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      }}
    />
  );
}
