import { MapPin } from "lucide-react";
import ApiKeyConfigPage from "@/components/admin/integrations/ApiKeyConfigPage";

export default function GoogleMapsConfigPage() {
  return (
    <ApiKeyConfigPage
      serviceKey="google_maps"
      title="Google Maps"
      description="Configure sua API Key do Google Maps para exibir mapas no sistema"
      icon={MapPin}
      helpText="Insira sua API Key do Google Maps (restrita por domínio) para habilitar mapas nas propostas"
      helpUrl="https://console.cloud.google.com/apis/credentials"
      testEndpoint={{
        url: (key) =>
          `https://maps.googleapis.com/maps/api/geocode/json?address=Brasilia&key=${key}`,
      }}
    />
  );
}
