import { motion } from "framer-motion";
import { MapPin, Building, Hash } from "lucide-react";
import { FloatingInput } from "@/components/ui/floating-input";
import { FloatingSelect } from "@/components/ui/floating-select";
import { formatCEP, ESTADOS_BRASIL } from "@/lib/validations";
import { useCidadesPorEstado } from "@/hooks/useCidadesPorEstado";
import type { UseFormReturn } from "react-hook-form";
import type { LeadFormData } from "@/lib/validations";

const fieldVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

interface StepAddressProps {
  form: UseFormReturn<LeadFormData>;
  touchedFields: Set<string>;
  markFieldTouched: (field: string) => void;
  isFieldValid: (field: string) => boolean;
  onCEPBlur: (cep: string) => void;
}

export function StepAddress({
  form,
  touchedFields,
  markFieldTouched,
  isFieldValid,
  onCEPBlur,
}: StepAddressProps) {
  const { watch, setValue, trigger, formState: { errors } } = form;
  const values = watch();
  const { cidades, isLoading: cidadesLoading } = useCidadesPorEstado(values.estado);

  return (
    <div className="space-y-5">
      <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
        <FloatingInput
          label="CEP (opcional)"
          icon={<MapPin className="w-4 h-4" />}
          value={values.cep}
          maxLength={9}
          autoComplete="off"
          onChange={(e) => setValue("cep", formatCEP(e.target.value))}
          onBlur={(e) => {
            onCEPBlur(e.target.value);
          }}
          error={touchedFields.has("cep") ? errors.cep?.message : undefined}
          success={isFieldValid("cep")}
        />
      </motion.div>

      <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div data-field-error={!!errors.estado && touchedFields.has("estado")}>
        <FloatingSelect
          label="Estado *"
          icon={<Building className="w-4 h-4" />}
          value={values.estado}
          onValueChange={(value) => {
            if (value !== values.estado) {
              setValue("cidade", "", { shouldValidate: false });
            }
            setValue("estado", value, { shouldValidate: touchedFields.has("estado") });
          }}
          options={ESTADOS_BRASIL.map(e => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))}
          error={touchedFields.has("estado") ? errors.estado?.message : undefined}
          success={isFieldValid("estado")}
        />
        </div>
        <div data-field-error={!!errors.cidade && touchedFields.has("cidade")}>
        {cidades.length > 0 ? (
          <FloatingSelect
            label={cidadesLoading ? "Carregando cidades..." : "Cidade *"}
            value={values.cidade}
            onValueChange={(value) => {
              setValue("cidade", value, { shouldValidate: touchedFields.has("cidade") });
            }}
            options={cidades.map(c => ({ value: c, label: c }))}
            error={touchedFields.has("cidade") ? errors.cidade?.message : undefined}
            success={isFieldValid("cidade")}
          />
        ) : (
          <FloatingInput
            label={cidadesLoading ? "Carregando cidades..." : "Cidade *"}
            value={values.cidade}
            onChange={(e) => setValue("cidade", e.target.value, { shouldValidate: touchedFields.has("cidade") })}
            error={touchedFields.has("cidade") ? errors.cidade?.message : undefined}
            success={isFieldValid("cidade")}
          />
        )}
        </div>
      </motion.div>

      <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
        <FloatingInput
          label="Bairro (opcional)"
          value={values.bairro}
          onChange={(e) => setValue("bairro", e.target.value)}
        />
      </motion.div>

      <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible" className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <FloatingInput
            label="Rua (opcional)"
            value={values.rua}
            onChange={(e) => setValue("rua", e.target.value)}
          />
        </div>
        <FloatingInput
          label="Nº"
          icon={<Hash className="w-4 h-4" />}
          value={values.numero}
          onChange={(e) => setValue("numero", e.target.value)}
        />
      </motion.div>

      <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible">
        <FloatingInput
          label="Complemento (opcional)"
          value={values.complemento}
          onChange={(e) => setValue("complemento", e.target.value)}
        />
      </motion.div>
    </div>
  );
}
