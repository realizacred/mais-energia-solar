import { forwardRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseCurrency(formatted: string): number {
  const digits = formatted.replace(/\D/g, "");
  return parseInt(digits || "0", 10);
}

interface CurrencyInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  /** Value in cents (integer) */
  value: number;
  /** Called with new value in cents */
  onChange: (cents: number) => void;
  className?: string;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(parseCurrency(e.target.value));
      },
      [onChange]
    );

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        value={formatCurrency(value || 0)}
        onChange={handleChange}
        placeholder="R$ 0,00"
        className={cn("font-mono", className)}
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";
