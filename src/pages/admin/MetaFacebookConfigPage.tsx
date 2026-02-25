import { Facebook } from "lucide-react";
import ApiKeyConfigPage from "@/components/admin/integrations/ApiKeyConfigPage";

export default function MetaFacebookConfigPage() {
  return (
    <ApiKeyConfigPage
      serviceKey="meta_facebook"
      title="Meta Facebook Ads"
      description="Configure seu Access Token para capturar leads e métricas de anúncios"
      icon={Facebook}
      helpText="Insira seu Access Token do Meta (Facebook) para habilitar a integração de Lead Ads e métricas"
      helpUrl="https://developers.facebook.com/docs/marketing-api/overview"
    />
  );
}
