import { forwardRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatDateBR(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function toISO(formatted: string): string {
  const parts = formatted.split("/");
  if (parts.length !== 3 || parts[2].length !== 4) return "";
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

interface DateInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  /** ISO date string (YYYY-MM-DD) */
  value: string;
  /** Called with ISO date string */
  onChange: (iso: string) => void;
  className?: string;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    // Convert ISO to display
    const display = value
      ? value.split("-").reverse().join("/")
      : "";

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatDateBR(e.target.value);
        const iso = toISO(formatted);
        onChange(iso || formatted);
      },
      [onChange]
    );

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder="DD/MM/AAAA"
        maxLength={10}
        className={cn("font-mono", className)}
        {...props}
      />
    );
  }
);
DateInput.displayName = "DateInput";
