/**
 * Componente de confirmação obrigatória quando proposta tem precisão ESTIMADA.
 * Exibe banner de alerta + checkbox de aceite antes de permitir gerar PDF.
 */

import { AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface EstimativaCheckboxProps {
  precisao: "exato" | "estimado" | "desconhecido";
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

export function EstimativaCheckbox({
  precisao,
  checked,
  onCheckedChange,
  className,
}: EstimativaCheckboxProps) {
  if (precisao !== "estimado") return null;

  return (
    <div className={className}>
      {/* Banner de alerta */}
      <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 mb-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-warning">
              Economia estimada
            </p>
            <p className="text-xs text-muted-foreground">
              ATENÇÃO: Esta simulação utiliza estimativa de Fio B baseada no TUSD total da ANEEL. 
              O valor real pode variar conforme estrutura tarifária da distribuidora.
            </p>
          </div>
        </div>
      </div>

      {/* Checkbox de aceite */}
      <div className="flex items-start gap-2 px-1">
        <Checkbox
          id="aceite-estimativa"
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor="aceite-estimativa"
          className="text-xs text-muted-foreground cursor-pointer leading-relaxed"
        >
          Entendi que os valores são estimados e que a economia real pode variar 
          conforme a estrutura tarifária da distribuidora.
        </Label>
      </div>
    </div>
  );
}
