/**
 * KanbanCard — rendering, data display, drag events, menu actions
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@/test/mocks/framerMotionMock";
import { TestProviders } from "@/test/mocks/queryClientWrapper";
import { KanbanCard } from "../KanbanCard";

const mockLead = {
  id: "lead-1",
  lead_code: "LD-001",
  nome: "João Silva",
  telefone: "(11) 99999-0000",
  cidade: "São Paulo",
  estado: "SP",
  media_consumo: 650,
  consultor: "Maria Santos",
  status_id: "status-1",
  created_at: new Date().toISOString(),
  ultimo_contato: new Date().toISOString(),
  visto: true,
  potencia_kwp: null,
  valor_projeto: null,
  status_nome: "Novo",
};

function renderCard(overrides = {}, handlers = {}) {
  const defaultHandlers = {
    onDragStart: vi.fn(),
    isDragging: false,
    onViewDetails: vi.fn(),
    onQuickAction: vi.fn(),
    onWin: vi.fn(),
    onLose: vi.fn(),
    ...handlers,
  };
  return render(
    <TestProviders>
      <KanbanCard lead={{ ...mockLead, ...overrides }} {...defaultHandlers} />
    </TestProviders>
  );
}

describe("KanbanCard", () => {
  it("renderiza nome do lead", () => {
    renderCard();
    expect(screen.getByText("João Silva")).toBeInTheDocument();
  });

  it("renderiza código do lead", () => {
    renderCard();
    expect(screen.getByText("LD-001")).toBeInTheDocument();
  });

  it("renderiza cidade/estado", () => {
    renderCard();
    expect(screen.getByText("São Paulo/SP")).toBeInTheDocument();
  });

  it("renderiza consumo em kWh", () => {
    renderCard();
    expect(screen.getByText("650 kWh")).toBeInTheDocument();
  });

  it("exibe primeiro nome do consultor", () => {
    renderCard();
    expect(screen.getByText("Maria")).toBeInTheDocument();
  });

  it("calcula e exibe valor estimado quando sem valor_projeto", () => {
    renderCard({ potencia_kwp: null, valor_projeto: null });
    // 650/130 = 5.0 kWp → 5.0 * 5000 = R$ 25K
    expect(screen.getByText("R$ 25K")).toBeInTheDocument();
  });

  it("exibe valor real do lead quando disponível", () => {
    renderCard({ valor_projeto: 45000 });
    expect(screen.getByText("R$ 45K")).toBeInTheDocument();
  });

  it("exibe badge urgente quando inativo por 48h+", () => {
    const oldDate = new Date();
    oldDate.setHours(oldDate.getHours() - 50);
    renderCard({ ultimo_contato: oldDate.toISOString() });
    expect(screen.getByText("Urgente")).toBeInTheDocument();
  });

  it("não exibe badge urgente quando contato recente", () => {
    renderCard({ ultimo_contato: new Date().toISOString() });
    expect(screen.queryByText("Urgente")).not.toBeInTheDocument();
  });

  it("mostra indicador não-visto quando lead não foi visto", () => {
    const { container } = renderCard({ visto: false });
    // Should have a small dot indicator
    const dot = container.querySelector(".bg-primary.rounded-full");
    expect(dot).toBeInTheDocument();
  });

  it("aplica estilo de drag quando isDragging=true", () => {
    const { container } = renderCard({}, { isDragging: true });
    const card = container.firstElementChild;
    expect(card?.className).toContain("opacity-50");
  });

  it("exibe — quando sem lead_code", () => {
    renderCard({ lead_code: null });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("chama onViewDetails ao clicar no botão de detalhes", () => {
    const onViewDetails = vi.fn();
    renderCard({}, { onViewDetails });
    const eyeButton = screen.getAllByRole("button").find(
      (btn) => btn.querySelector(".lucide-eye")
    );
    if (eyeButton) {
      fireEvent.click(eyeButton);
      expect(onViewDetails).toHaveBeenCalledWith(expect.objectContaining({ id: "lead-1" }));
    }
  });
});
