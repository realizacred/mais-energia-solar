import { motion } from "framer-motion";
import { Home, Zap, BarChart3, FileText, MessageSquare } from "lucide-react";
import { FloatingInput } from "@/components/ui/floating-input";
import { FloatingSelect } from "@/components/ui/floating-select";
import { Textarea } from "@/components/ui/textarea";
import ConsumptionChart from "@/components/ConsumptionChart";
import FileUploadOffline, { type OfflineFile } from "@/components/FileUploadOffline";
import { REDES_ATENDIMENTO } from "@/lib/validations";
import { useTiposTelhado } from "@/hooks/useTiposTelhado";
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

interface StepConsumptionProps {
  form: UseFormReturn<LeadFormData>;
  touchedFields: Set<string>;
  markFieldTouched: (field: string) => void;
  isFieldValid: (field: string) => boolean;
  onFilesChange: (files: OfflineFile[]) => void;
}

export function StepConsumption({
  form,
  touchedFields,
  markFieldTouched,
  isFieldValid,
  onFilesChange,
}: StepConsumptionProps) {
  const { watch, setValue, trigger, formState: { errors } } = form;
  const values = watch();
  const { tiposTelhado: TIPOS_TELHADO } = useTiposTelhado();

  return (
    <div className="space-y-5">
      <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
        <div data-field-error={!!errors.area && touchedFields.has("area")}>
        <FloatingSelect
          label="Área *"
          icon={<Home className="w-4 h-4" />}
          value={values.area}
          onValueChange={(value) => {
            setValue("area", value as "Urbana" | "Rural");
          }}
          options={[
            { value: "Urbana", label: "Urbana" },
            { value: "Rural", label: "Rural" },
          ]}
          error={touchedFields.has("area") ? errors.area?.message : undefined}
          success={isFieldValid("area")}
        />
        </div>
      </motion.div>

      <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
        <div data-field-error={!!errors.tipo_telhado && touchedFields.has("tipo_telhado")}>
        <FloatingSelect
          label="Tipo de Telhado *"
          icon={<Home className="w-4 h-4" />}
          value={values.tipo_telhado}
          onValueChange={(value) => {
            setValue("tipo_telhado", value);
          }}
          options={TIPOS_TELHADO.map(t => ({ value: t, label: t }))}
          error={touchedFields.has("tipo_telhado") ? errors.tipo_telhado?.message : undefined}
          success={isFieldValid("tipo_telhado")}
        />
        </div>
      </motion.div>

      <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
        <div data-field-error={!!errors.rede_atendimento && touchedFields.has("rede_atendimento")}>
        <FloatingSelect
          label="Rede de Atendimento *"
          icon={<Zap className="w-4 h-4" />}
          value={values.rede_atendimento}
          onValueChange={(value) => {
            setValue("rede_atendimento", value);
          }}
          options={REDES_ATENDIMENTO.map(r => ({ value: r, label: r }))}
          error={touchedFields.has("rede_atendimento") ? errors.rede_atendimento?.message : undefined}
          success={isFieldValid("rede_atendimento")}
        />
        </div>
      </motion.div>

      <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div data-field-error={!!errors.media_consumo && touchedFields.has("media_consumo")}>
        <FloatingInput
          label="Média de Consumo (kWh) *"
          icon={<BarChart3 className="w-4 h-4" />}
          type="number"
          autoComplete="off"
          value={values.media_consumo || ""}
          onChange={(e) => setValue("media_consumo", e.target.value ? Number(e.target.value) : undefined)}
          error={touchedFields.has("media_consumo") ? errors.media_consumo?.message : undefined}
          success={isFieldValid("media_consumo")}
        />
        </div>
        <div data-field-error={!!errors.consumo_previsto && touchedFields.has("consumo_previsto")}>
        <FloatingInput
          label="Consumo Previsto (kWh) *"
          icon={<BarChart3 className="w-4 h-4" />}
          type="number"
          autoComplete="off"
          value={values.consumo_previsto || ""}
          onChange={(e) => setValue("consumo_previsto", e.target.value ? Number(e.target.value) : undefined)}
          error={touchedFields.has("consumo_previsto") ? errors.consumo_previsto?.message : undefined}
          success={isFieldValid("consumo_previsto")}
        />
        </div>
      </motion.div>

      {values.media_consumo && values.consumo_previsto && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <ConsumptionChart
            mediaConsumo={values.media_consumo}
            consumoPrevisto={values.consumo_previsto}
          />
        </motion.div>
      )}

      {/* Upload de Arquivos */}
      <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="flex items-center gap-2 text-sm font-medium mb-2">
          <FileText className="w-4 h-4 text-secondary" /> Contas de Luz (opcional)
        </label>
        <FileUploadOffline
          onFilesChange={onFilesChange}
          maxFiles={10}
          maxSizeMB={10}
        />
      </motion.div>

      {/* Observações */}
      <motion.div custom={5} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="flex items-center gap-2 text-sm font-medium mb-2">
          <MessageSquare className="w-4 h-4 text-secondary" /> Observações (opcional)
        </label>
        <Textarea
          placeholder="Informações adicionais..."
          autoComplete="off"
          className="min-h-[80px] rounded-xl border-2 border-muted-foreground/25 focus:border-primary transition-colors"
          value={values.observacoes}
          onChange={(e) => setValue("observacoes", e.target.value)}
        />
      </motion.div>
    </div>
  );
}
