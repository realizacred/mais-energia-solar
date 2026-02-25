import { z } from "zod";

// ─── Shared email validation (SSOT) ────────────────────────
// Strict regex: local@domain.tld
// - No consecutive dots in local or domain
// - Domain must have at least one dot with 2+ char TLD
// - No leading/trailing dots in local or domain parts
const EMAIL_REGEX =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+\-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export const EMAIL_ERROR_MESSAGE = "E-mail inválido. Verifique e tente novamente.";
export const EMAIL_DISPOSABLE_MESSAGE = "Não aceitamos e-mails temporários para cadastro.";
export const EMAIL_PLACEHOLDER = "email@exemplo.com";

// ─── Disposable-email domain blocklist ─────────────────────
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "tempmail.com",
  "throwaway.email", "10minutemail.com", "trashmail.com", "yopmail.com",
  "sharklasers.com", "guerrillamailblock.com", "grr.la", "dispostable.com",
  "maildrop.cc", "mailnesia.com", "tempail.com", "tempr.email", "temp-mail.org",
  "fakeinbox.com", "emailondeck.com", "getnada.com", "mohmal.com",
  "minutemail.com", "burnermail.io", "discard.email", "mailcatch.com",
  "mytemp.email", "tmpmail.net", "tmpmail.org", "jetable.org",
]);

/** Returns true if the domain is in the disposable blocklist */
export function isDisposableEmail(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  const atIdx = trimmed.lastIndexOf("@");
  if (atIdx < 0) return false;
  return DISPOSABLE_DOMAINS.has(trimmed.slice(atIdx + 1));
}

/** Pure validation – returns error string or null. Empty is not invalid (use required separately). */
export function validateEmail(value: string, options?: { blockDisposable?: boolean }): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("..")) return EMAIL_ERROR_MESSAGE;
  if (!EMAIL_REGEX.test(trimmed)) return EMAIL_ERROR_MESSAGE;
  if (options?.blockDisposable && isDisposableEmail(trimmed)) return EMAIL_DISPOSABLE_MESSAGE;
  return null;
}

/** Normalises email for storage: trim + lowercase */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Zod schema for optional email (empty string allowed, outputs string) */
export const emailFieldSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || validateEmail(v) === null, { message: EMAIL_ERROR_MESSAGE });

/** Zod schema for required email (outputs string) */
export const emailRequiredSchema = z
  .string()
  .trim()
  .min(1, "E-mail é obrigatório")
  .refine((v) => validateEmail(v) === null, { message: EMAIL_ERROR_MESSAGE });

/** Zod schema for required email that also blocks disposable domains */
export const emailRequiredNoDisposableSchema = z
  .string()
  .trim()
  .min(1, "E-mail é obrigatório")
  .refine((v) => validateEmail(v, { blockDisposable: true }) === null, {
    message: EMAIL_ERROR_MESSAGE,
    path: [],
  })
  .refine((v) => !isDisposableEmail(v), { message: EMAIL_DISPOSABLE_MESSAGE });

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

const passwordSchema = z
  .string()
  .min(8, "Senha deve ter pelo menos 8 caracteres")
  .regex(/[A-Z]/, "Senha deve conter pelo menos 1 letra maiúscula")
  .regex(/[0-9]/, "Senha deve conter pelo menos 1 número");

export const loginSchema = z.object({
  email: z.string().min(1, "Email ou telefone é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export type LoginData = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  nome: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100, "Nome muito longo"),
  email: emailRequiredNoDisposableSchema,
  password: passwordSchema,
  cargo: z.enum(["consultor", "instalador"], { required_error: "Selecione um cargo" }),
});

export type SignupData = z.infer<typeof signupSchema>;

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
  // Preserve trailing space so the user can type multi-word names
  const hasTrailingSpace = name.endsWith(" ");
  const formatted = name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 2) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
  return hasTrailingSpace ? formatted + " " : formatted;
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
  "Fibrocimento",
  "Metálico",
  "Laje",
  "Cerâmico",
  "Solo",
  "Outro",
];

/** @deprecated Valores legados — mantidos apenas para mapeamento de dados antigos */
export const TIPOS_TELHADO_LEGACY = [
  "Zinco (Metal)",
  "Colonial (Madeira)",
  "Colonial (Metal)",
  "Fibro (Madeira)",
  "Fibro (Metal)",
  "Solo com Zinco",
  "Solo com Eucalipto",
];

export const REDES_ATENDIMENTO = [
  "Monofásico 127V",
  "Monofásico 220V",
  "Bifásico 127/220V",
  "Bifásico 220/380V",
  "Bifásico 277/480V",
  "Trifásico 127/220V",
  "Trifásico 220/380V",
  "Trifásico 277/480V",
];

/** @deprecated kept for backward-compatibility parsing of legacy values */
export const REDES_ATENDIMENTO_LEGACY = ["Monofásico", "Bifásico", "Trifásico"];
