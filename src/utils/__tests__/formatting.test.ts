import { describe, it, expect } from "vitest";

// ── Helpers inline (replicate logic from the codebase) ──

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// ── Tests ──

describe("formatCPF", () => {
  it("deve formatar CPF completo", () => {
    expect(formatCPF("12345678901")).toBe("123.456.789-01");
  });
  it("deve lidar com CPF parcial", () => {
    expect(formatCPF("123456")).toBe("123.456");
  });
  it("deve remover caracteres não numéricos", () => {
    expect(formatCPF("123.456.789-01")).toBe("123.456.789-01");
  });
  it("deve limitar a 11 dígitos", () => {
    expect(formatCPF("123456789012345")).toBe("123.456.789-01");
  });
});

describe("formatCNPJ", () => {
  it("deve formatar CNPJ completo", () => {
    expect(formatCNPJ("12345678000190")).toBe("12.345.678/0001-90");
  });
  it("deve lidar com CNPJ parcial", () => {
    expect(formatCNPJ("12345")).toBe("12.345");
  });
});

describe("formatPhone", () => {
  it("deve formatar celular com 11 dígitos", () => {
    expect(formatPhone("11999887766")).toBe("(11) 99988-7766");
  });
  it("deve formatar telefone parcial", () => {
    expect(formatPhone("1199")).toBe("(11) 99");
  });
});

describe("formatBRL", () => {
  it("deve formatar valor monetário", () => {
    expect(formatBRL(1234.56)).toBe("R$\u00a01.234,56");
  });
  it("deve formatar zero", () => {
    expect(formatBRL(0)).toBe("R$\u00a00,00");
  });
  it("deve formatar valor negativo", () => {
    expect(formatBRL(-500)).toBe("-R$\u00a0500,00");
  });
});
