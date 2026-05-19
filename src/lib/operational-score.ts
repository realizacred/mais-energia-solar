import { differenceInDays, differenceInHours } from "date-fns";

export type OperationalScoreConfig = {
  slaOverdue: number;
  slaNear: number; // 80%+
  criticalPendency: number;
  highPendency: number;
  blockingPendency: number;
  stagnation3d: number;
  stagnation7d: number;
  awaitingClient: number;
  awaitingUtility: number;
  acceptedProposal: number;
  pendingFinance: number;
  installationSoon: number; // within 3 days
};

export const DEFAULT_SCORE_CONFIG: OperationalScoreConfig = {
  slaOverdue: 50,
  slaNear: 20,
  criticalPendency: 100,
  highPendency: 50,
  blockingPendency: 80,
  stagnation3d: 15,
  stagnation7d: 30,
  awaitingClient: 10,
  awaitingUtility: 15,
  acceptedProposal: 25,
  pendingFinance: 20,
  installationSoon: 40,
};

export function calculateOperationalScore(p: any, config: OperationalScoreConfig = DEFAULT_SCORE_CONFIG): number {
  let score = 0;
  const now = new Date();

  // 1. SLA Logic
  const slaDays = p.sla_days || 0;
  const daysInStage = differenceInDays(now, new Date(p.last_stage_change || p.updated_at || now));
  
  if (slaDays > 0) {
    if (daysInStage >= slaDays) score += config.slaOverdue;
    else if (daysInStage >= slaDays * 0.8) score += config.slaNear;
  }

  // 2. Pendencies Logic
  const pendencias = p.pendencias || [];
  pendencias.forEach((pend: any) => {
    if (pend.status !== 'resolvido') {
      if (pend.criticidade === 'critica') score += config.criticalPendency;
      if (pend.criticidade === 'alta') score += config.highPendency;
      if (pend.bloqueia_fluxo) score += config.blockingPendency;
    }
  });

  // 3. Stagnation Logic
  const hoursStopped = differenceInHours(now, new Date(p.ultima_mudanca_operacional_at || p.last_stage_change || p.updated_at || now));
  if (hoursStopped >= 168) score += config.stagnation7d;
  else if (hoursStopped >= 72) score += config.stagnation3d;

  // 4. Contextual Logic
  const stageName = (p.stage_name || "").toLowerCase();
  if (stageName.includes("cliente") || stageName.includes("documento")) score += config.awaitingClient;
  if (stageName.includes("concessionária") || stageName.includes("vistoria")) score += config.awaitingUtility;

  // 5. Proposal Logic
  const propostaStatus = (p.proposta_status || "").toLowerCase();
  if (["aceita", "accepted"].includes(propostaStatus)) score += config.acceptedProposal;

  // 6. Installation Soon
  if (p.data_previsao_instalacao) {
    const daysToInstallation = differenceInDays(new Date(p.data_previsao_instalacao), now);
    if (daysToInstallation >= 0 && daysToInstallation <= 3) {
      score += config.installationSoon;
    }
  }

  return score;
}
