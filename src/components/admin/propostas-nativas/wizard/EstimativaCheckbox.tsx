/**
 * Componente de confirmação obrigatória quando proposta tem precisão ESTIMADA.
 * Exibe card de alerta destacado + checkbox de aceite antes de permitir gerar PDF.
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
    <div
      className={`rounded-lg border-2 p-4 transition-colors ${
        checked
          ? "bg-success/5 border-success/40"
          : "bg-warning/10 border-warning/40"
      } ${className ?? ""}`}
    >
      {/* Header com ícone */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-warning/20 shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 text-warning" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-warning">
            Economia estimada — atenção necessária
          </p>
          <p className="text-sm text-foreground">
            Esta simulação utiliza estimativa de Fio B baseada no TUSD total da ANEEL.
            O valor real pode variar conforme estrutura tarifária da distribuidora.
          </p>
        </div>
      </div>

      {/* Checkbox de aceite */}
      <div className="flex items-start gap-2.5 px-1 pt-2 border-t border-warning/20">
        <Checkbox
          id="aceite-estimativa"
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor="aceite-estimativa"
          className="text-sm text-foreground cursor-pointer leading-relaxed font-medium"
        >
          Entendi que os valores são estimados e que a economia real pode variar
          conforme a estrutura tarifária da distribuidora.
        </Label>
      </div>
    </div>
  );
}
