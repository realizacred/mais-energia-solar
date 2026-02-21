import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function NumField({ label, suffix, value, step, subtext, tooltip, highlight, onChange }: {
  label: string; suffix: string; value: number; step?: string; subtext?: string; tooltip?: string;
  highlight?: boolean;
  onChange: (v: number) => void;
}) {
  const isPercent = suffix === "%";
  const isKwh = suffix === "R$/kWh";
  const isReais = suffix === "R$";

  // Animate highlight: green ring that fades after 3s
  const [showHighlight, setShowHighlight] = useState(false);
  useEffect(() => {
    if (highlight) {
      setShowHighlight(true);
      const timer = setTimeout(() => setShowHighlight(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowHighlight(false);
    }
  }, [highlight]);

  const formatValue = () => {
    if (isPercent) return value.toFixed(2);
    if (isKwh) return value.toFixed(5);
    if (isReais) return value.toFixed(2);
    return value;
  };

  return (
    <div className="space-y-1.5">
      <Label className={cn(
        "text-xs font-medium text-muted-foreground transition-colors duration-300",
        showHighlight && "text-success font-semibold"
      )}>
        {label}
        {tooltip && <FieldTooltip text={tooltip} />}
      </Label>
      <div className="relative">
        <Input
          type="number"
          step={step || (isKwh ? "0.00001" : "0.01")}
          value={formatValue()}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "pr-16 transition-all duration-300",
            showHighlight && "ring-2 ring-success/50 border-success/60 bg-success/5"
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">{suffix}</span>
      </div>
      {subtext && <p className="text-[10px] text-muted-foreground">{subtext}</p>}
    </div>
  );
}
