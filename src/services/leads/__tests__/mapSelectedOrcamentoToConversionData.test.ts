import { describe, it, expect } from "vitest";
import { mapSelectedOrcamentoToConversionData } from "../mapSelectedOrcamentoToConversionData";

describe("mapSelectedOrcamentoToConversionData — ORC-0102", () => {
  const orcamento: any = {
    id: "orc-0102-uuid",
    lead_id: "lead-uuid-marco",
    codigo: "ORC-0102",
    nome: "Marco Aurélio Bento Dos Santos",
    telefone: "(11) 99999-0102",
    email: "marco@example.com",
    cep: "01310-100",
    estado: "SP",
    cidade: "São Paulo",
    bairro: "Bela Vista",
    rua: "Av. Paulista",
    numero: "1000",
    complemento: "Ap 12",
    media_consumo: 400,
    consumo_previsto: 500,
    observacoes: "Orçamento ORC-0102",
  };

  it("mapeia todos os campos críticos a partir do orçamento selecionado", () => {
    const out = mapSelectedOrcamentoToConversionData(orcamento, null);

    expect(out.nome).toBe("Marco Aurélio Bento Dos Santos");
    expect(out.telefone).toBe("(11) 99999-0102");
    expect(out.cidade).toBe("São Paulo");
    expect(out.estado).toBe("SP");
    expect(out.media_consumo).toBe(400);
    expect(out.consumo_previsto).toBe(500);
    expect(out._orcamento_id).toBe("orc-0102-uuid");
    expect(out._lead_id).toBe("lead-uuid-marco");
  });

  it("prioriza os campos do orçamento sobre os do lead", () => {
    const lead: any = {
      id: "lead-uuid-marco",
      nome: "Nome Antigo do Lead",
      telefone: "(11) 0000-0000",
      cidade: "Outra Cidade",
      estado: "RJ",
      media_consumo: 999,
      consumo_previsto: 999,
    };
    const out = mapSelectedOrcamentoToConversionData(orcamento, lead);

    expect(out.nome).toBe("Marco Aurélio Bento Dos Santos");
    expect(out.cidade).toBe("São Paulo");
    expect(out.estado).toBe("SP");
    expect(out.media_consumo).toBe(400);
    expect(out.consumo_previsto).toBe(500);
  });

  it("retorna estrutura segura com strings vazias e zeros quando nada é fornecido", () => {
    const out = mapSelectedOrcamentoToConversionData(null, null);
    expect(out.nome).toBe("");
    expect(out.telefone).toBe("");
    expect(out.cidade).toBe("");
    expect(out.estado).toBe("");
    expect(out.media_consumo).toBe(0);
    expect(out.consumo_previsto).toBe(0);
    expect(out._orcamento_id).toBeNull();
    expect(out._lead_id).toBeNull();
  });
});
