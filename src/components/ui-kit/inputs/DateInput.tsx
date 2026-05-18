import { forwardRef, useCallback, useEffect, useState } from "react";
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

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  // already DD/MM/YYYY?
  if (iso.includes("/")) return iso;
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

interface DateInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  /** ISO date string (YYYY-MM-DD) */
  value: string;
  /** Called with ISO date string only (or empty string) */
  onChange: (iso: string) => void;
  className?: string;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    // Internal draft state — keeps partial typing without bubbling invalid values up
    const [draft, setDraft] = useState<string>(isoToDisplay(value));

    // Sync from external ISO value when it changes (and user is not in the middle of editing partials)
    useEffect(() => {
      const next = isoToDisplay(value);
      setDraft((prev) => (prev.length === 10 || prev.length === 0 ? next : prev));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatDateBR(e.target.value);
        setDraft(formatted);

        if (formatted.length === 10) {
          const iso = toISO(formatted);
          if (iso) {
            const d = new Date(iso + "T12:00:00");
            if (!isNaN(d.getTime())) {
              onChange(iso);
              return;
            }
          }
          // invalid complete date — do not bubble up
          return;
        }

        if (formatted.length === 0) {
          onChange("");
        }
        // partial values: do NOT call onChange
      },
      [onChange]
    );

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        value={draft}
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
