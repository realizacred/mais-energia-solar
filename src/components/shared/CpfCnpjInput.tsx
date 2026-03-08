import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { formatCpfCnpj, CPF_CNPJ_MAX_LENGTH } from "@/lib/cpfCnpjUtils";

interface CpfCnpjInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "maxLength"> {
  value: string;
  onChange: (formatted: string) => void;
}

/**
 * Masked CPF/CNPJ input. Auto-formats as the user types.
 * SSOT for CPF/CNPJ input across the entire app.
 */
export const CpfCnpjInput = forwardRef<HTMLInputElement, CpfCnpjInputProps>(
  ({ value, onChange, placeholder = "000.000.000-00", ...rest }, ref) => (
    <Input
      ref={ref}
      value={value}
      maxLength={CPF_CNPJ_MAX_LENGTH}
      placeholder={placeholder}
      onChange={(e) => onChange(formatCpfCnpj(e.target.value))}
      {...rest}
    />
  ),
);

CpfCnpjInput.displayName = "CpfCnpjInput";
