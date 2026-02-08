import { describe, it, expect } from "vitest";
import { parseInvokeError, isEmailAlreadyRegisteredError } from "@/lib/supabaseFunctionError";

describe("parseInvokeError", () => {
  it("should parse simple error message", async () => {
    const result = await parseInvokeError({ message: "Something broke" });
    expect(result.message).toBe("Something broke");
  });

  it("should handle null error", async () => {
    const result = await parseInvokeError(null);
    expect(result.message).toBe("Erro ao executar a função");
  });

  it("should handle undefined error", async () => {
    const result = await parseInvokeError(undefined);
    expect(result.message).toBe("Erro ao executar a função");
  });

  it("should extract status from context", async () => {
    const result = await parseInvokeError({
      message: "Error",
      context: { status: 403 },
    });
    expect(result.status).toBe(403);
  });

  it("should parse context with plain object body", async () => {
    const result = await parseInvokeError({
      message: "Edge Function returned a non-2xx status",
      context: { error: "Staging mode: blocked" },
    });
    expect(result.message).toBe("Staging mode: blocked");
  });

  it("should parse context with Response-like object (JSON)", async () => {
    const mockResponse = {
      clone: () => ({
        headers: {
          get: (name: string) => name === "content-type" ? "application/json" : null,
        },
        json: async () => ({ error: "Rate limit exceeded" }),
      }),
    };
    const result = await parseInvokeError({
      message: "Generic error",
      context: mockResponse,
    });
    expect(result.message).toBe("Rate limit exceeded");
  });

  it("should parse context with Response-like object (text)", async () => {
    const mockResponse = {
      clone: () => ({
        headers: {
          get: () => "text/plain",
        },
        text: async () => "Plain text error message",
      }),
    };
    const result = await parseInvokeError({
      message: "Generic error",
      context: mockResponse,
    });
    expect(result.message).toBe("Plain text error message");
  });
});

describe("isEmailAlreadyRegisteredError", () => {
  it("should detect 'already been registered'", () => {
    expect(isEmailAlreadyRegisteredError("User has already been registered")).toBe(true);
  });

  it("should detect 'email_exists'", () => {
    expect(isEmailAlreadyRegisteredError("email_exists")).toBe(true);
  });

  it("should detect Portuguese variant", () => {
    expect(isEmailAlreadyRegisteredError("Este e-mail já está cadastrado")).toBe(true);
  });

  it("should return false for unrelated error", () => {
    expect(isEmailAlreadyRegisteredError("Something else happened")).toBe(false);
  });

  it("should handle empty string", () => {
    expect(isEmailAlreadyRegisteredError("")).toBe(false);
  });
});
