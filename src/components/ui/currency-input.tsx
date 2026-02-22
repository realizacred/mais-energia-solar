import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  prefix?: string;
}

/**
 * Formats a number as BRL currency string (e.g., 10000 → "10.000,00").
 * Always shows 2 decimal places.
 */
function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const intPart = Math.floor(abs / 100);
  const decPart = abs % 100;
  const intStr = intPart.toLocaleString("pt-BR");
  return `${intStr},${String(decPart).padStart(2, "0")}`;
}

export function CurrencyInput({ value, onChange, className, placeholder = "0,00", prefix = "R$" }: CurrencyInputProps) {
  // Internal state in cents (integer)
  const [cents, setCents] = useState(() => Math.round(value * 100));

  // Sync from external value prop changes
  useEffect(() => {
    const ext = Math.round(value * 100);
    if (ext !== cents) {
      setCents(ext);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip everything except digits
    const digits = e.target.value.replace(/\D/g, "");
    const newCents = parseInt(digits || "0", 10);
    setCents(newCents);
    onChange(newCents / 100);
  }, [onChange]);

  const displayed = cents > 0 ? formatCents(cents) : "";

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">
          {prefix}
        </span>
      )}
      <Input
        type="text"
        inputMode="numeric"
        value={displayed}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(prefix ? "pl-9" : "", className)}
      />
    </div>
  );
}
