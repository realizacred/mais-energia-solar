import { forwardRef, useCallback, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Formats cents (integer) as BRL currency string: "R$ 1.234,56"
 */
function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Strips non-digits from a formatted string and returns cents (integer).
 */
function parseCurrency(formatted: string): number {
  const digits = formatted.replace(/\D/g, "");
  return parseInt(digits || "0", 10);
}

interface CurrencyInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  /** Value in BRL (reais), e.g. 1234.56 */
  value: number;
  /** Called with new value in BRL (reais) */
  onChange: (reais: number) => void;
  /** Prefix label, defaults to "R$". Pass "" to hide. */
  prefix?: string;
  className?: string;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, prefix, className, ...props }, ref) => {
    // Convert reais to cents for internal formatting
    const cents = Math.round((value || 0) * 100);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newCents = parseCurrency(e.target.value);
        onChange(newCents / 100);
      },
      [onChange]
    );

    // Format: if prefix is explicitly "", don't show R$ prefix (use raw number format)
    const showPrefix = prefix !== "";
    const displayed = showPrefix
      ? formatCurrency(cents)
      : cents > 0
        ? (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "";

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        value={displayed}
        onChange={handleChange}
        placeholder={showPrefix ? "R$ 0,00" : "0,00"}
        className={cn("font-mono", className)}
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";
