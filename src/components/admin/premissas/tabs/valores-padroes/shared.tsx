import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

export function FieldTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-primary cursor-help inline-block ml-1" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] text-xs">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function NumField({ label, suffix, value, step, subtext, tooltip, onChange }: {
  label: string; suffix: string; value: number; step?: string; subtext?: string; tooltip?: string;
  onChange: (v: number) => void;
}) {
  const isPercent = suffix === "%";
  const isKwh = suffix === "R$/kWh";
  const isReais = suffix === "R$";

  const formatValue = () => {
    if (isPercent) return value.toFixed(2);
    if (isKwh) return value.toFixed(5);
    if (isReais) return value.toFixed(2);
    return value;
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {tooltip && <FieldTooltip text={tooltip} />}
      </Label>
      <div className="relative">
        <Input
          type="number"
          step={step || (isKwh ? "0.00001" : "0.01")}
          value={formatValue()}
          onChange={(e) => onChange(Number(e.target.value))}
          className="pr-16"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">{suffix}</span>
      </div>
      {subtext && <p className="text-[10px] text-muted-foreground">{subtext}</p>}
    </div>
  );
}
