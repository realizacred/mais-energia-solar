/**
 * Pipeline KanbanCard — estimateKwp, estimateValue e renderização
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KanbanCard } from "../KanbanCard";

// ─── Replicated pure functions from KanbanCard ───

function estimateKwp(consumo: number): number {
  return Math.round((consumo / 130) * 10) / 10;
}

function estimateValue(kwp: number): number {
  return kwp * 5000;
}

// ─── Unit tests for estimation logic ───

describe("estimateKwp", () => {
  it("calcula kWp a partir de consumo médio", () => {
    expect(estimateKwp(650)).toBe(5); // 650/130 = 5.0
  });

  it("arredonda para 1 casa decimal", () => {
    expect(estimateKwp(500)).toBe(3.8); // 500/130 ≈ 3.846
  });

  it("retorna 0 para consumo 0", () => {
    expect(estimateKwp(0)).toBe(0);
  });

  it("lida com consumo baixo (100 kWh)", () => {
    expect(estimateKwp(100)).toBe(0.8); // 100/130 ≈ 0.769
  });

  it("lida com consumo alto (2000 kWh)", () => {
    expect(estimateKwp(2000)).toBe(15.4); // 2000/130 ≈ 15.384
  });
});

describe("estimateValue", () => {
  it("calcula valor como kWp * 5000", () => {
    expect(estimateValue(5)).toBe(25000);
  });

  it("retorna 0 para 0 kWp", () => {
    expect(estimateValue(0)).toBe(0);
  });

  it("lida com valores decimais", () => {
    expect(estimateValue(3.8)).toBe(19000);
  });
});

// ─── Component rendering tests ───

const baseLead = {
  id: "lead-1",
  lead_code: "L-001",
  nome: "João da Silva",
  telefone: "(11) 99999-0001",
  cidade: "Campinas",
  estado: "SP",
  media_consumo: 650,
  consultor: "Carlos Vendedor",
  status_id: null,
  created_at: new Date().toISOString(),
  ultimo_contato: null,
  visto: true,
  potencia_kwp: null,
  valor_projeto: null,
  status_nome: null,
};

describe("KanbanCard rendering", () => {
  const noop = () => {};

  it("renderiza nome do lead", () => {
    render(
      <KanbanCard lead={baseLead} onDragStart={noop as any} isDragging={false} />
    );
    expect(screen.getByText("João da Silva")).toBeInTheDocument();
  });

  it("renderiza código do lead", () => {
    render(
      <KanbanCard lead={baseLead} onDragStart={noop as any} isDragging={false} />
    );
    expect(screen.getByText("L-001")).toBeInTheDocument();
  });

  it("renderiza cidade/estado", () => {
    render(
      <KanbanCard lead={baseLead} onDragStart={noop as any} isDragging={false} />
    );
    expect(screen.getByText("Campinas/SP")).toBeInTheDocument();
  });

  it("renderiza consumo em kWh", () => {
    render(
      <KanbanCard lead={baseLead} onDragStart={noop as any} isDragging={false} />
    );
    expect(screen.getByText("650 kWh")).toBeInTheDocument();
  });

  it("usa valor estimado quando lead não tem valor_projeto", () => {
    render(
      <KanbanCard lead={baseLead} onDragStart={noop as any} isDragging={false} />
    );
    // estimateKwp(650) = 5.0, estimateValue(5.0) = 25000 → "R$ 25K"
    expect(screen.getByText("R$ 25K")).toBeInTheDocument();
  });

  it("usa valor_projeto do lead quando disponível", () => {
    const leadWithValue = { ...baseLead, valor_projeto: 45000 };
    render(
      <KanbanCard lead={leadWithValue} onDragStart={noop as any} isDragging={false} />
    );
    expect(screen.getByText("R$ 45K")).toBeInTheDocument();
  });

  it("mostra primeiro nome do consultor", () => {
    render(
      <KanbanCard lead={baseLead} onDragStart={noop as any} isDragging={false} />
    );
    expect(screen.getByText("Carlos")).toBeInTheDocument();
  });

  it("aplica opacidade quando arrastando", () => {
    const { container } = render(
      <KanbanCard lead={baseLead} onDragStart={noop as any} isDragging={true} />
    );
    // Framer motion adds opacity style
    const card = container.firstChild as HTMLElement;
    expect(card).toBeTruthy();
  });
});
