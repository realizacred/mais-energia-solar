import { forwardRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface UnitInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value: number | string;
  onChange: (value: number) => void;
  unit: string;
  precision?: number;
  className?: string;
}

export const UnitInput = forwardRef<HTMLInputElement, UnitInputProps>(
  ({ value, onChange, unit, precision = 2, className, ...props }, ref) => {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
        const num = parseFloat(raw);
        onChange(isNaN(num) ? 0 : num);
      },
      [onChange]
    );

    const display = typeof value === "number" && !isNaN(value)
      ? value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: precision })
      : "";

    return (
      <div className="relative">
        <Input
          ref={ref}
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          className={cn("pr-14 font-mono", className)}
          {...props}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
          {unit}
        </span>
      </div>
    );
  }
);
UnitInput.displayName = "UnitInput";

/** Pre-configured for kWp */
export const PowerInput = forwardRef<HTMLInputElement, Omit<UnitInputProps, "unit">>(
  (props, ref) => <UnitInput ref={ref} unit="kWp" precision={2} placeholder="Ex: 10,5" {...props} />
);
PowerInput.displayName = "PowerInput";

/** Pre-configured for kWh */
export const EnergyInput = forwardRef<HTMLInputElement, Omit<UnitInputProps, "unit">>(
  (props, ref) => <UnitInput ref={ref} unit="kWh" precision={1} placeholder="Ex: 1.250" {...props} />
);
EnergyInput.displayName = "EnergyInput";
