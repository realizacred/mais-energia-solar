import { z } from "zod";

// Brazilian phone validation
const phoneRegex = /^\(\d{2}\) \d{4,5}-\d{4}$/;

export const leadFormSchema = z.object({
  // Step 1: Dados Pessoais
  nome: z
    .string()
    .trim()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  telefone: z
    .string()
    .trim()
    .regex(phoneRegex, "Telefone inválido. Use o formato (11) 99999-9999"),
  
  // Step 2: Endereço
  cep: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^\d{5}-\d{3}$/.test(val),
      "CEP inválido. Use o formato 00000-000"
    ),
  estado: z.string().min(2, "Selecione um estado"),
  cidade: z
    .string()
    .trim()
    .min(2, "Cidade deve ter pelo menos 2 caracteres")
    .max(100, "Cidade deve ter no máximo 100 caracteres"),
  bairro: z.string().max(100, "Bairro muito longo").optional(),
  rua: z.string().max(200, "Endereço muito longo").optional(),
  numero: z.string().max(20, "Número muito longo").optional(),
  complemento: z.string().max(100, "Complemento muito longo").optional(),
  
  // Step 3: Imóvel e Consumo
  area: z.enum(["Urbana", "Rural"], { required_error: "Selecione uma área" }),
  tipo_telhado: z.string().min(1, "Selecione o tipo de telhado"),
  rede_atendimento: z.string().min(1, "Selecione a rede de atendimento"),
  media_consumo: z
    .number({ invalid_type_error: "Informe um valor numérico" })
    .min(1, "Média de consumo deve ser maior que 0")
    .max(100000, "Média de consumo muito alta"),
  consumo_previsto: z
    .number({ invalid_type_error: "Informe um valor numérico" })
    .min(1, "Consumo previsto deve ser maior que 0")
    .max(100000, "Consumo previsto muito alto"),
  
  // Step 4: Arquivos e Observações
  observacoes: z.string().max(1000, "Observações muito longas").optional(),
});

export type LeadFormData = z.infer<typeof leadFormSchema>;

// Step-specific schemas for validation
export const step1Schema = leadFormSchema.pick({
  nome: true,
  telefone: true,
});

export const step2Schema = leadFormSchema.pick({
  cep: true,
  estado: true,
  cidade: true,
  bairro: true,
  rua: true,
  numero: true,
  complemento: true,
});

export const step3Schema = leadFormSchema.pick({
  area: true,
  tipo_telhado: true,
  rede_atendimento: true,
  media_consumo: true,
  consumo_previsto: true,
});

export const step4Schema = leadFormSchema.pick({
  observacoes: true,
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export type LoginData = z.infer<typeof loginSchema>;

// Format functions
export function formatPhone(value: string): string {
  const v = value.replace(/\D/g, "");
  if (v.length <= 10) {
    return v.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }
  return v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
}

export function formatCEP(value: string): string {
  const v = value.replace(/\D/g, "");
  return v.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

export function formatName(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (word.length <= 2) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export const ESTADOS_BRASIL = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

export const TIPOS_TELHADO = [
  "Zinco (Metal)",
  "Colonial (Madeira)",
  "Colonial (Metal)",
  "Fibro (Madeira)",
  "Fibro (Metal)",
  "Laje",
  "Solo com Zinco",
  "Solo com Eucalipto",
];

export const REDES_ATENDIMENTO = ["Monofásico", "Bifásico", "Trifásico"];
