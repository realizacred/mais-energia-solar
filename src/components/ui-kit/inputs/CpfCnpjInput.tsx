import { forwardRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCpfCnpj, isValidCpfCnpj, onlyDigits } from "@/lib/cpfCnpjUtils";

interface CpfCnpjInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value: string;
  onChange: (raw: string) => void;
  error?: string;
}

export const CpfCnpjInput = forwardRef<HTMLInputElement, CpfCnpjInputProps>(
  ({ value, onChange, className, error, ...props }, ref) => {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = onlyDigits(e.target.value).slice(0, 14);
        onChange(digits);
      },
      [onChange]
    );

    const isInvalid = value.length > 0 && !isValidCpfCnpj(value);

    return (
      <div className="space-y-1">
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={formatCpfCnpj(value || "")}
          onChange={handleChange}
          placeholder="000.000.000-00"
          className={cn("font-mono", isInvalid && "border-destructive", className)}
          {...props}
        />
        {(error || isInvalid) && (
          <p className="text-xs text-destructive">
            {error || (value.length <= 11 ? "CPF inválido" : "CNPJ inválido")}
          </p>
        )}
      </div>
    );
  }
);
CpfCnpjInput.displayName = "CpfCnpjInput";
