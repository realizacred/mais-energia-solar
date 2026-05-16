/**
 * @deprecated — substituído por CreditConfigPage
 * Reutiliza: credit_bank_configs
 */
import { Navigate } from "react-router-dom";

export default function FinanciamentoConfig() {
  return <Navigate to="/admin/configuracoes/credito" replace />;
}
