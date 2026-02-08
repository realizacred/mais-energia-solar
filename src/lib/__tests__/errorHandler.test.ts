import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleError, handleSupabaseError, mapToUserMessage } from "@/lib/errorHandler";

// Mock Sentry functions
vi.mock("@/lib/sentry", () => ({
  captureError: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

describe("handleError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract message from Error instance", () => {
    const result = handleError(new Error("Something failed"), {
      source: "supabase",
      action: "fetch_leads",
    });
    expect(result.message).toBe("Something failed");
    expect(result.userMessage).toBe("Ocorreu um erro. Tente novamente.");
  });

  it("should extract message from string error", () => {
    const result = handleError("plain string error", {
      source: "unknown",
      action: "test_action",
    });
    expect(result.message).toBe("plain string error");
  });

  it("should extract message from object with message property", () => {
    const result = handleError({ message: "object error", code: "E001" }, {
      source: "supabase",
      action: "update_lead",
    });
    expect(result.message).toBe("object error");
    expect(result.code).toBe("E001");
  });

  it("should include context in returned error", () => {
    const result = handleError(new Error("test"), {
      source: "edge_function",
      action: "send_whatsapp",
      entityId: "lead-123",
      userId: "user-456",
      role: "admin",
      route: "/admin",
    });
    expect(result.context?.source).toBe("edge_function");
    expect(result.context?.action).toBe("send_whatsapp");
    expect(result.context?.entityId).toBe("lead-123");
    expect(result.context?.userId).toBe("user-456");
    expect(result.context?.role).toBe("admin");
    expect(result.context?.route).toBe("/admin");
  });
});

describe("handleSupabaseError", () => {
  it("should set source to supabase", () => {
    const result = handleSupabaseError(new Error("test"), "fetch_clientes");
    expect(result.context?.source).toBe("supabase");
    expect(result.context?.action).toBe("fetch_clientes");
  });

  it("should handle RLS policy errors", () => {
    const result = handleSupabaseError(
      { message: "new row violates row-level security policy", code: "42501" },
      "insert_lead"
    );
    expect(result.userMessage).toBe("Você não tem permissão para esta ação.");
  });
});

describe("mapToUserMessage", () => {
  it("should map login error", () => {
    expect(mapToUserMessage("Invalid login credentials")).toBe("Email ou senha incorretos.");
  });

  it("should map network error", () => {
    expect(mapToUserMessage("Failed to fetch")).toBe("Erro de conexão. Verifique sua internet.");
  });

  it("should map JWT expired", () => {
    expect(mapToUserMessage("JWT expired")).toBe("Sessão expirada. Faça login novamente.");
  });

  it("should map rate limit by code", () => {
    expect(mapToUserMessage("some error", "P0429")).toBe("Muitas tentativas. Aguarde antes de tentar novamente.");
  });

  it("should map by status code 401", () => {
    expect(mapToUserMessage("unauthorized", undefined, 401)).toBe("Sessão expirada ou sem permissão. Faça login novamente.");
  });

  it("should map by status code 429", () => {
    expect(mapToUserMessage("rate limited", undefined, 429)).toBe("Muitas tentativas. Aguarde alguns minutos.");
  });

  it("should map by status code 500+", () => {
    expect(mapToUserMessage("internal server error", undefined, 500)).toBe("Erro no servidor. Tente novamente em instantes.");
  });

  it("should return generic fallback for unknown errors", () => {
    expect(mapToUserMessage("xyzzy completely unknown")).toBe("Ocorreu um erro. Tente novamente.");
  });

  it("should be case-insensitive for pattern matching", () => {
    expect(mapToUserMessage("FAILED TO FETCH something")).toBe("Erro de conexão. Verifique sua internet.");
  });
});
