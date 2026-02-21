import type { TenantPremises } from "@/hooks/useTenantPremises";
import { ConcessionariaSection } from "./valores-padroes/ConcessionariaSection";
import { TarifasSection } from "./valores-padroes/TarifasSection";
import { KitsSection } from "./valores-padroes/KitsSection";

interface Props {
  premises: TenantPremises;
  onChange: (fn: (prev: TenantPremises) => TenantPremises) => void;
}

export function TabValoresPadroes({ premises, onChange }: Props) {
  return (
    <div className="space-y-6">
      <ConcessionariaSection premises={premises} onChange={onChange} />
      <TarifasSection premises={premises} onChange={onChange} />
      <KitsSection premises={premises} onChange={onChange} />
    </div>
  );
}
