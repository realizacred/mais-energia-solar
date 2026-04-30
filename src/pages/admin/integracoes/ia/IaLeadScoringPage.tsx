/**
 * Wrapper fino — Admin → Integrações → IA → Lead Scoring
 * Reaproveita: IntelligenceConfigPage (tabelas lead_scoring_config / intelligence_config)
 * Não cria novo motor de scoring. (RB-76 / DA-48)
 */
import { IntelligenceConfigPage } from "@/components/admin/intelligence";

export default function IaLeadScoringPage() {
  return <IntelligenceConfigPage />;
}
