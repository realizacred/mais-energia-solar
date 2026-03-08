/**
 * AddressFields — Bloco completo de endereço com CEP auto-preenchimento
 *
 * Substitui o código duplicado de endereço em todos os formulários.
 * Usa useCepLookup internamente.
 *
 * USO:
 *   import { AddressFields } from "@/components/shared/AddressFields";
 *
 *   const [address, setAddress] = useState({
 *     cep: "", rua: "", numero: "", complemento: "",
 *     bairro: "", cidade: "", estado: ""
 *   });
 *
 *   <AddressFields
 *     value={address}
 *     onChange={setAddress}
 *   />
 */

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCepLookup, formatCep } from "@/hooks/useCepLookup";
import { ESTADOS_BRASIL } from "@/lib/validations";

export interface AddressData {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

interface AddressFieldsProps {
  value: AddressData;
  onChange: (address: AddressData) => void;
  disabled?: boolean;
  className?: string;
  /** Se true, mostra todos os campos. Se false, só CEP e número */
  compact?: boolean;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function AddressFields({
  value,
  onChange,
  disabled = false,
  className,
  compact = false,
}: AddressFieldsProps) {
  const { fetchCep, loading: cepLoading, error: cepError } = useCepLookup();

  const update = useCallback(
    (field: keyof AddressData, val: string) => {
      onChange({ ...value, [field]: val });
    },
    [value, onChange]
  );

  const handleCepChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCep(e.target.value);
      update("cep", formatted);

      const digits = formatted.replace(/\D/g, "");
      if (digits.length === 8) {
        const address = await fetchCep(formatted);
        if (address) {
          onChange({
            ...value,
            cep: formatted,
            rua: address.logradouro || "",
            bairro: address.bairro || "",
            cidade: address.localidade || "",
            estado: address.uf || "",
          });
        }
      }
    },
    [fetchCep, onChange, update, value]
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Linha 1: CEP + Número */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="CEP" required>
          <div className="relative">
            <Input
              type="text"
              inputMode="numeric"
              value={value.cep}
              onChange={handleCepChange}
              placeholder="00000-000"
              maxLength={9}
              disabled={disabled}
              className={cn(
                "font-mono pr-8",
                cepError && "border-destructive"
              )}
            />
            {cepLoading && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {!cepLoading && value.rua && (
              <MapPin className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
            )}
          </div>
          {cepError && (
            <p className="text-xs text-destructive">⚠ {cepError}</p>
          )}
        </Field>

        <Field label="Número">
          <Input
            value={value.numero}
            onChange={(e) => update("numero", e.target.value)}
            placeholder="123"
            disabled={disabled}
          />
        </Field>

        <Field label="Complemento">
          <Input
            value={value.complemento}
            onChange={(e) => update("complemento", e.target.value)}
            placeholder="Apto, Bloco..."
            disabled={disabled}
          />
        </Field>
      </div>

      {!compact && (
        <>
          {/* Linha 2: Rua */}
          <Field label="Logradouro">
            <Input
              value={value.rua}
              onChange={(e) => update("rua", e.target.value)}
              placeholder="Preenchido automaticamente pelo CEP"
              disabled={disabled || cepLoading}
              className={cepLoading ? "opacity-60" : ""}
            />
          </Field>

          {/* Linha 3: Bairro + Cidade + Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Bairro">
              <Input
                value={value.bairro}
                onChange={(e) => update("bairro", e.target.value)}
                placeholder="Preenchido pelo CEP"
                disabled={disabled || cepLoading}
                className={cepLoading ? "opacity-60" : ""}
              />
            </Field>

            <Field label="Cidade">
              <Input
                value={value.cidade}
                onChange={(e) => update("cidade", e.target.value)}
                placeholder="Preenchido pelo CEP"
                disabled={disabled || cepLoading}
                className={cepLoading ? "opacity-60" : ""}
              />
            </Field>

            <Field label="Estado">
              <Select
                value={value.estado}
                onValueChange={(v) => update("estado", v)}
                disabled={disabled || cepLoading}
              >
                <SelectTrigger className={cepLoading ? "opacity-60" : ""}>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_BRASIL.map((uf) => (
                    <SelectItem key={uf.sigla} value={uf.sigla}>
                      {uf.sigla}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </>
      )}
    </div>
  );
}
