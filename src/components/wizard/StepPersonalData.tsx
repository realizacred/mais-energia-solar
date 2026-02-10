import { ReactNode } from "react";
import { motion } from "framer-motion";
import { User, Phone } from "lucide-react";
import { FloatingInput } from "@/components/ui/floating-input";
import { formatPhone, formatName } from "@/lib/validations";
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

interface StepPersonalDataProps {
  form: UseFormReturn<LeadFormData>;
  touchedFields: Set<string>;
  markFieldTouched: (field: string) => void;
  isFieldValid: (field: string) => boolean;
}

export function StepPersonalData({
  form,
  touchedFields,
  markFieldTouched,
  isFieldValid,
}: StepPersonalDataProps) {
  const { watch, setValue, trigger, formState: { errors } } = form;
  const values = watch();

  return (
    <div className="space-y-5">
      <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
        <div data-field-error={!!errors.nome && touchedFields.has("nome")}>
        <FloatingInput
          label="Nome Completo *"
          icon={<User className="w-4 h-4" />}
          value={values.nome}
          autoComplete="off"
          onChange={(e) => setValue("nome", formatName(e.target.value), { shouldValidate: touchedFields.has("nome") })}
          error={touchedFields.has("nome") ? errors.nome?.message : undefined}
          success={isFieldValid("nome")}
        />
        </div>
      </motion.div>

      <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
        <div data-field-error={!!errors.telefone && touchedFields.has("telefone")}>
        <FloatingInput
          label="Telefone *"
          icon={<Phone className="w-4 h-4" />}
          value={values.telefone}
          maxLength={15}
          autoComplete="off"
          onChange={(e) => setValue("telefone", formatPhone(e.target.value), { shouldValidate: touchedFields.has("telefone") })}
          error={touchedFields.has("telefone") ? errors.telefone?.message : undefined}
          success={isFieldValid("telefone")}
        />
        </div>
      </motion.div>
    </div>
  );
}
