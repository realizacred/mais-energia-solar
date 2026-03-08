/**
 * CpfCnpjInput — Input CPF/CNPJ com máscara automática e validação visual
 *
 * Usa os utilitários já existentes em src/lib/cpfCnpjUtils.ts
 *
 * USO:
 *   import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
 *
 *   <CpfCnpjInput
 *     value={formData.cpf_cnpj}
 *     onChange={(val) => setFormData({ ...formData, cpf_cnpj: val })}
 *   />
 */

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatCpfCnpj, isValidCpfCnpj, onlyDigits } from "@/lib/cpfCnpjUtils";

interface CpfCnpjInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  showValidation?: boolean;
  disabled?: boolean;
  id?: string;
}

export function CpfCnpjInput({
  value,
  onChange,
  label = "CPF/CNPJ",
  required = false,
  placeholder = "000.000.000-00 ou 00.000.000/0000-00",
  className,
  showValidation = true,
  disabled = false,
  id = "cpf_cnpj",
}: CpfCnpjInputProps) {
  const [touched, setTouched] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = onlyDigits(e.target.value);
      const formatted = formatCpfCnpj(digits);
      onChange(formatted);
    },
    [onChange]
  );

  const handleBlur = useCallback(() => setTouched(true), []);

  const digits = onlyDigits(value);
  const isComplete = digits.length === 11 || digits.length === 14;
  const isValid = isComplete && isValidCpfCnpj(value);
  const hasError = touched && isComplete && !isValid;
  const hasSuccess = touched && isValid && showValidation;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}

      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={18} // ##.###.###/####-##
          className={cn(
            "font-mono pr-8 transition-colors",
            hasError && "border-destructive focus-visible:ring-destructive/30 bg-destructive/5",
            hasSuccess && "border-success focus-visible:ring-success/30"
          )}
        />

        {/* Ícone de status */}
        {showValidation && isComplete && (
          <span
            className={cn(
              "absolute right-2.5 top-1/2 -translate-y-1/2 text-sm",
              isValid ? "text-success" : "text-destructive"
            )}
          >
            {isValid ? "✓" : "✗"}
          </span>
        )}
      </div>

      {/* Mensagem de erro */}
      {hasError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <span>⚠</span>
          {digits.length === 11 ? "CPF inválido" : "CNPJ inválido"}
        </p>
      )}

      {/* Hint do tipo */}
      {!hasError && digits.length > 0 && digits.length <= 11 && (
        <p className="text-xs text-muted-foreground">
          {digits.length < 11
            ? `CPF — ${11 - digits.length} dígitos restantes`
            : isValid
            ? "CPF válido"
            : ""}
        </p>
      )}
    </div>
  );
}
