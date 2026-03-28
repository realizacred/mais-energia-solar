/**
 * ProposalKpis.tsx
 * 
 * KPI strip for ProposalDetail — potência, geração, valor, R$/Wp.
 * Pure UI — no business logic.
 */

import { Zap, SunMedium, DollarSign, TrendingUp } from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import { formatKwp, formatKwhValue } from "@/lib/formatters/index";
import { InfoPill } from "../InfoPill";
import type { ProposalViewModel } from "@/domain/proposal/ProposalViewModel";

interface ProposalKpisProps {
  vm: ProposalViewModel;
}

export function ProposalKpis({ vm }: ProposalKpisProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <InfoPill icon={Zap} label="Potência" value={formatKwp(vm.potenciaKwp)} />
      <InfoPill icon={SunMedium} label="Geração Mensal" value={vm.geracaoMensal > 0 ? `${formatKwhValue(vm.geracaoMensal)} kWh` : "—"} />
      <InfoPill icon={DollarSign} label="Valor Total" value={formatBRL(vm.valorTotal)} />
      <InfoPill icon={TrendingUp} label="R$/Wp" value={vm.wpPrice > 0 ? `${formatBRL(vm.wpPrice)}/Wp` : "—"} />
    </div>
  );
}
