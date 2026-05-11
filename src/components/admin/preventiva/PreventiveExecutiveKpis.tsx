import {
  AlertTriangle,
  Snowflake,
  Wrench,
  CircleDollarSign,
  UserMinus,
  Bot,
  ClipboardCheck,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/ui-kit/StatCard";
import type { PreventiveDashboardKpis } from "@/hooks/usePreventiveDashboard";

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const formatNum = (v: number) => v.toLocaleString("pt-BR");

interface Props {
  kpis: PreventiveDashboardKpis;
}

export function PreventiveExecutiveKpis({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 tabular-nums">
      <StatCard
        icon={AlertTriangle}
        label="Clientes em risco"
        value={formatNum(kpis.clientes_em_risco)}
        color="destructive"
        subtitle="Sem resposta há > 7 dias"
      />
      <StatCard
        icon={Snowflake}
        label="Propostas esfriando"
        value={formatNum(kpis.propostas_esfriando)}
        color="info"
        subtitle="Visualizadas sem retorno"
      />
      <StatCard
        icon={Wrench}
        label="Engenharia parada"
        value={formatNum(kpis.engenharia_parada)}
        color="warning"
        subtitle="Sem update há > 7 dias"
      />
      <StatCard
        icon={CircleDollarSign}
        label="Cobranças preventivas"
        value={formatNum(kpis.cobrancas_preventivas)}
        color="warning"
        subtitle="Vencem em até 3 dias"
      />
      <StatCard
        icon={UserMinus}
        label="Sem interação"
        value={formatNum(kpis.clientes_sem_interacao)}
        color="muted"
        subtitle="14+ dias silenciosos"
      />
      <StatCard
        icon={Bot}
        label="Ações automáticas hoje"
        value={formatNum(kpis.acoes_automaticas_hoje)}
        color="primary"
        subtitle="Disparos preventivos"
      />
      <StatCard
        icon={ClipboardCheck}
        label="Aguardando revisão"
        value={formatNum(kpis.aguardando_revisao)}
        color="secondary"
        subtitle="Aprovação humana pendente"
      />
      <StatCard
        icon={TrendingUp}
        label="Recuperação potencial"
        value={formatBRL(kpis.recuperacao_potencial)}
        color="success"
        subtitle="Valor em jogo"
      />
    </div>
  );
}
