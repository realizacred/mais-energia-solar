import { describe, it, expect } from "vitest";
import {
  formatCPF,
  formatCNPJ,
  formatDocument,
  formatPhoneBR,
  formatPhoneE164,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatPercent,
  formatKwh,
  formatKwp,
  formatPowerKw,
  formatEnergyAutoScale,
  formatCO2,
  formatNumber,
  formatInteger,
  sanitizeText,
  slugify,
  formatUF,
  formatBRL,
  formatBRLCompact,
} from "../formatters/index";

describe("Document formatters", () => {
  it("formatCPF", () => {
    expect(formatCPF("12345678901")).toBe("123.456.789-01");
    expect(formatCPF(null)).toBe("—");
    expect(formatCPF("123")).toBe("123"); // incomplete
  });

  it("formatCNPJ", () => {
    expect(formatCNPJ("12345678000195")).toBe("12.345.678/0001-95");
    expect(formatCNPJ(null)).toBe("—");
  });

  it("formatDocument auto-detects CPF vs CNPJ", () => {
    expect(formatDocument("12345678901")).toBe("123.456.789-01");
    expect(formatDocument("12345678000195")).toBe("12.345.678/0001-95");
  });
});

describe("Phone formatters", () => {
  it("formatPhoneBR with 11 digits", () => {
    expect(formatPhoneBR("11999887766")).toBe("(11) 99988-7766");
  });

  it("formatPhoneBR strips +55", () => {
    expect(formatPhoneBR("+5511999887766")).toBe("(11) 99988-7766");
  });

  it("formatPhoneBR with 10 digits (landline)", () => {
    expect(formatPhoneBR("1133445566")).toBe("(11) 3344-5566");
  });

  it("formatPhoneE164", () => {
    expect(formatPhoneE164("11999887766")).toBe("+5511999887766");
    expect(formatPhoneE164("+5511999887766")).toBe("+5511999887766");
  });
});

describe("Date formatters", () => {
  it("formatDate", () => {
    const result = formatDate("2024-03-15T10:30:00Z");
    expect(result).toMatch(/15\/03\/2024/);
  });

  it("formatDate null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("formatDateTime", () => {
    const result = formatDateTime("2024-03-15T13:30:00Z");
    expect(result).toMatch(/15\/03\/2024/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("formatRelativeTime", () => {
    expect(formatRelativeTime(new Date())).toBe("agora");
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo)).toBe("há 5min");
  });
});

describe("Currency formatters", () => {
  it("formatBRL", () => {
    const result = formatBRL(1234.56);
    expect(result).toContain("1.234,56");
    expect(result).toContain("R$");
  });

  it("formatBRL null", () => {
    expect(formatBRL(null)).toBe("—");
  });

  it("formatBRLCompact", () => {
    expect(formatBRLCompact(1500000)).toMatch(/1,5M/);
    expect(formatBRLCompact(50000)).toMatch(/50K/);
  });
});

describe("Percent formatter", () => {
  it("formatPercent", () => {
    expect(formatPercent(12.345)).toBe("12,3%");
    expect(formatPercent(12.345, 2)).toBe("12,35%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("Energy formatters", () => {
  it("formatKwh", () => {
    expect(formatKwh(1234.5)).toMatch(/1\.234,5 kWh/);
  });

  it("formatKwp", () => {
    expect(formatKwp(12.34)).toMatch(/12,34 kWp/);
  });

  it("formatPowerKw", () => {
    expect(formatPowerKw(5.67)).toMatch(/5,67 kW/);
  });

  it("formatEnergyAutoScale", () => {
    expect(formatEnergyAutoScale(500)).toMatch(/kWh/);
    expect(formatEnergyAutoScale(5000)).toMatch(/MWh/);
    expect(formatEnergyAutoScale(5000000)).toMatch(/GWh/);
    expect(formatEnergyAutoScale(null)).toBe("—");
  });

  it("formatCO2", () => {
    expect(formatCO2(500)).toMatch(/kg CO₂/);
    expect(formatCO2(1500)).toMatch(/t CO₂/);
  });
});

describe("Number formatters", () => {
  it("formatNumber", () => {
    expect(formatNumber(1234.567, 2)).toMatch(/1\.234,57/);
  });

  it("formatInteger", () => {
    expect(formatInteger(1234.7)).toMatch(/1\.235/);
  });
});

describe("Text formatters", () => {
  it("sanitizeText", () => {
    expect(sanitizeText("  hello   world  ")).toBe("hello world");
    expect(sanitizeText(null)).toBe("");
  });

  it("slugify", () => {
    expect(slugify("São Paulo Energia")).toBe("sao-paulo-energia");
    expect(slugify("Hello World!")).toBe("hello-world");
  });

  it("formatUF", () => {
    expect(formatUF("sp")).toBe("SP");
    expect(formatUF(null)).toBe("—");
  });
});
