import { describe, it, expect } from "vitest";
import {
  leadFormSchema,
  loginSchema,
  signupSchema,
  step1Schema,
  step2Schema,
  step3Schema,
  formatPhone,
  formatCEP,
  formatName,
} from "@/lib/validations";

// ─── Lead Form Schema ───────────────────────────────────────────
describe("leadFormSchema", () => {
  const validLead = {
    nome: "João Silva",
    telefone: "(32) 99843-7675",
    cep: "36000-000",
    estado: "MG",
    cidade: "Juiz de Fora",
    bairro: "Centro",
    rua: "Rua Halfeld",
    numero: "100",
    area: "Urbana" as const,
    tipo_telhado: "Laje",
    rede_atendimento: "Trifásico",
    media_consumo: 500,
    consumo_previsto: 450,
  };

  it("should validate a complete lead form", () => {
    const result = leadFormSchema.safeParse(validLead);
    expect(result.success).toBe(true);
  });

  it("should reject nome with less than 3 chars", () => {
    const result = leadFormSchema.safeParse({ ...validLead, nome: "AB" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid phone format", () => {
    const result = leadFormSchema.safeParse({ ...validLead, telefone: "12345" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid CEP format", () => {
    const result = leadFormSchema.safeParse({ ...validLead, cep: "12345" });
    expect(result.success).toBe(false);
  });

  it("should accept empty CEP (optional)", () => {
    const result = leadFormSchema.safeParse({ ...validLead, cep: "" });
    expect(result.success).toBe(true);
  });

  it("should reject media_consumo = 0", () => {
    const result = leadFormSchema.safeParse({ ...validLead, media_consumo: 0 });
    expect(result.success).toBe(false);
  });

  it("should reject consumo_previsto > 100000", () => {
    const result = leadFormSchema.safeParse({ ...validLead, consumo_previsto: 200000 });
    expect(result.success).toBe(false);
  });

  it("should reject invalid area value", () => {
    const result = leadFormSchema.safeParse({ ...validLead, area: "Suburbana" });
    expect(result.success).toBe(false);
  });
});

// ─── Step Schemas ───────────────────────────────────────────────
describe("step1Schema (Dados Pessoais)", () => {
  it("should validate valid name and phone", () => {
    const result = step1Schema.safeParse({
      nome: "Maria Santos",
      telefone: "(11) 98765-4321",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty nome", () => {
    const result = step1Schema.safeParse({
      nome: "",
      telefone: "(11) 98765-4321",
    });
    expect(result.success).toBe(false);
  });
});

describe("step2Schema (Endereço)", () => {
  it("should validate valid address", () => {
    const result = step2Schema.safeParse({
      estado: "SP",
      cidade: "São Paulo",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing estado", () => {
    const result = step2Schema.safeParse({
      estado: "",
      cidade: "São Paulo",
    });
    expect(result.success).toBe(false);
  });
});

describe("step3Schema (Imóvel e Consumo)", () => {
  it("should validate valid consumption data", () => {
    const result = step3Schema.safeParse({
      area: "Urbana",
      tipo_telhado: "Laje",
      rede_atendimento: "Trifásico",
      media_consumo: 500,
      consumo_previsto: 450,
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative media_consumo", () => {
    const result = step3Schema.safeParse({
      area: "Rural",
      tipo_telhado: "Laje",
      rede_atendimento: "Monofásico",
      media_consumo: -10,
      consumo_previsto: 100,
    });
    expect(result.success).toBe(false);
  });
});

// ─── Login Schema ───────────────────────────────────────────────
describe("loginSchema", () => {
  it("should validate valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "admin@empresa.com",
      password: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "123456",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short password", () => {
    const result = loginSchema.safeParse({
      email: "admin@empresa.com",
      password: "123",
    });
    expect(result.success).toBe(false);
  });
});

// ─── Signup Schema ──────────────────────────────────────────────
describe("signupSchema", () => {
  it("should validate valid signup data", () => {
    const result = signupSchema.safeParse({
      nome: "João Vendedor",
      email: "joao@empresa.com",
      password: "senha123",
      cargo: "vendedor",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid cargo", () => {
    const result = signupSchema.safeParse({
      nome: "João",
      email: "joao@empresa.com",
      password: "senha123",
      cargo: "admin",
    });
    expect(result.success).toBe(false);
  });

  it("should accept instalador cargo", () => {
    const result = signupSchema.safeParse({
      nome: "Carlos Instalador",
      email: "carlos@empresa.com",
      password: "senha123",
      cargo: "instalador",
    });
    expect(result.success).toBe(true);
  });
});

// ─── Format Functions ───────────────────────────────────────────
describe("formatPhone", () => {
  it("should format 11-digit phone", () => {
    expect(formatPhone("32998437675")).toBe("(32) 99843-7675");
  });

  it("should format 10-digit phone", () => {
    expect(formatPhone("3299437675")).toBe("(32) 9943-7675");
  });

  it("should strip non-digits", () => {
    expect(formatPhone("(32) 99843-7675")).toBe("(32) 99843-7675");
  });
});

describe("formatCEP", () => {
  it("should format 8-digit CEP", () => {
    expect(formatCEP("36000000")).toBe("36000-000");
  });

  it("should handle already-formatted CEP", () => {
    expect(formatCEP("36000-000")).toBe("36000-000");
  });
});

describe("formatName", () => {
  it("should capitalize first letters", () => {
    expect(formatName("JOÃO SILVA")).toBe("João Silva");
  });

  it("should keep short prepositions lowercase", () => {
    expect(formatName("MARIA DA SILVA")).toBe("Maria da Silva");
  });
});
