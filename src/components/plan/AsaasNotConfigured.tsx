/**
 * AsaasNotConfigured — Friendly empty state when Asaas integration is missing.
 * Guides the user to /admin/integracao-asaas with contextual messaging.
 */
import { useNavigate } from "react-router-dom";
import { CreditCard, Settings } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { useAsaasNotConfiguredTracking } from "@/hooks/useAsaasTracking";

interface AsaasNotConfiguredProps {
  /** Contextual hint about what the user tried to do */
  context?: "upgrade" | "cobranca" | "fatura" | "generic";
  className?: string;
}

const CONTEXT_MESSAGES: Record<string, string> = {
  upgrade:
    "Você tentou fazer um upgrade de plano, mas a integração de pagamento ainda não está configurada.",
  cobranca:
    "Para gerar cobranças automáticas, configure a integração com o Asaas primeiro.",
  fatura:
    "Para emitir notas fiscais vinculadas a cobranças, configure a integração com o Asaas.",
  generic:
    "Para gerar cobranças e ativar o faturamento automático, configure a integração com o Asaas.",
};

export function AsaasNotConfigured({ context = "generic", className }: AsaasNotConfiguredProps) {
  const navigate = useNavigate();
  const { trackClick } = useAsaasNotConfiguredTracking(context);

  return (
    <EmptyState
      icon={CreditCard}
      title="Configuração de pagamento necessária"
      description={CONTEXT_MESSAGES[context]}
      action={{
        label: "Configurar integração",
        onClick: () => {
          trackClick();
          navigate("/admin/integracao-asaas");
        },
        icon: Settings,
      }}
      className={className}
    />
  );
}
