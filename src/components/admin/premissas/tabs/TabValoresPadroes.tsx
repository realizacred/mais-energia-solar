import { useState, useCallback } from "react";
import type { TenantPremises } from "@/hooks/useTenantPremises";
import { ConcessionariaSection } from "./valores-padroes/ConcessionariaSection";
import { TarifasSection } from "./valores-padroes/TarifasSection";

interface Props {
  premises: TenantPremises;
  onChange: (fn: (prev: TenantPremises) => TenantPremises) => void;
  onAutoSave?: () => Promise<void>;
}

export function TabValoresPadroes({ premises, onChange, onAutoSave }: Props) {
  const [syncedFields, setSyncedFields] = useState<string[]>([]);

  const handleSyncedFields = useCallback((fields: string[]) => {
    setSyncedFields(fields);
    // Auto-clear after animation duration
    setTimeout(() => setSyncedFields([]), 3500);
  }, []);

  return (
    <div className="space-y-6">
      <ConcessionariaSection premises={premises} onChange={onChange} onSyncedFields={handleSyncedFields} onAutoSave={onAutoSave} />
      <TarifasSection premises={premises} onChange={onChange} syncedFields={syncedFields} />
    </div>
  );
}
