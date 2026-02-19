import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { formatNumberBR, parseBRNumber, roundCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  prefix?: string;
}

export function CurrencyInput({ value, onChange, className, placeholder = "0,00", prefix = "R$" }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(() => value ? formatNumberBR(value) : "");
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setFocused(true);
    setDisplayValue(value ? formatNumberBR(value) : "");
  }, [value]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const parsed = roundCurrency(parseBRNumber(displayValue));
    onChange(parsed);
    setDisplayValue(parsed ? formatNumberBR(parsed) : "");
  }, [displayValue, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits, dots, commas
    const cleaned = raw.replace(/[^0-9.,]/g, "");
    setDisplayValue(cleaned);
  }, []);

  // When not focused, show formatted value from prop
  const shown = focused ? displayValue : (value ? formatNumberBR(value) : "");

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">
          {prefix}
        </span>
      )}
      <Input
        type="text"
        inputMode="decimal"
        value={shown}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={cn(prefix ? "pl-9" : "", className)}
      />
    </div>
  );
}
