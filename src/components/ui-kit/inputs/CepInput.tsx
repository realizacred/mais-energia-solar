import { forwardRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCEP } from "@/lib/validations";
import { toast } from "@/hooks/use-toast";

interface CepInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value: string;
  onChange: (raw: string) => void;
  onAddressFound?: (address: {
    logradouro: string;
    bairro: string;
    localidade: string;
    uf: string;
    complemento?: string;
  }) => void;
}

export const CepInput = forwardRef<HTMLInputElement, CepInputProps>(
  ({ value, onChange, onAddressFound, className, ...props }, ref) => {
    const handleBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
      props.onBlur?.(e);
      const digits = value.replace(/\D/g, "");
      if (digits.length === 8 && onAddressFound) {
        try {
          const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
          const data = await res.json();
          if (!data.erro) {
            onAddressFound(data);
          } else {
            toast({ title: "CEP não encontrado", variant: "destructive" });
          }
        } catch (err) {
          console.error("ViaCEP error", err);
        }
      }
    };

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
        onChange(digits);
      },
      [onChange]
    );

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={formatCEP(value || "")}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="00000-000"
        maxLength={9}
        className={cn("font-mono", className)}
        {...props}
      />
    );
  }
);
CepInput.displayName = "CepInput";
