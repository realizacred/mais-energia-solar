/**
 * ProjetoKanban — column rendering, drag-and-drop, empty state
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProjetoKanban } from "@/components/admin/projetos/ProjetoKanban";
import type { ProjetoEtapa, ProjetoItem } from "@/hooks/useProjetoPipeline";

const mockEtapas: ProjetoEtapa[] = [
  { id: "etapa-1", nome: "Proposta", ordem: 1, cor: "#3b82f6", funil_id: "f1", categoria: "aberto", tenant_id: "t1" },
  { id: "etapa-2", nome: "Instalação", ordem: 2, cor: "#22c55e", funil_id: "f1", categoria: "aberto", tenant_id: "t1" },
];

const mockProjeto = {
  id: "proj-1",
  codigo: "PJ-001",
  etapa_id: "etapa-1",
  valor_total: 25000,
  potencia_kwp: 5.0,
  consultor: { nome: "Carlos" },
  cliente: { nome: "Maria Oliveira", telefone: "(11) 99999-0000" },
  created_at: new Date().toISOString(),
} as ProjetoItem;

function buildMap(projetos: ProjetoItem[]): Map<string | null, ProjetoItem[]> {
  const map = new Map<string | null, ProjetoItem[]>();
  for (const p of projetos) {
    const list = map.get(p.etapa_id) || [];
    list.push(p);
    map.set(p.etapa_id, list);
  }
  return map;
}

describe("ProjetoKanban", () => {
  it("renderiza colunas com nomes das etapas", () => {
    render(
      <ProjetoKanban
        etapas={mockEtapas}
        projetosByEtapa={buildMap([mockProjeto])}
        onMoveProjeto={vi.fn()}
      />
    );
    expect(screen.getByText("Proposta")).toBeInTheDocument();
    expect(screen.getByText("Instalação")).toBeInTheDocument();
  });

  it("renderiza card do projeto na coluna correta", () => {
    render(
      <ProjetoKanban
        etapas={mockEtapas}
        projetosByEtapa={buildMap([mockProjeto])}
        onMoveProjeto={vi.fn()}
      />
    );
    expect(screen.getByText("Maria Oliveira")).toBeInTheDocument();
    expect(screen.getByText("PJ-001")).toBeInTheDocument();
  });

  it("exibe badge com contagem de projetos na coluna", () => {
    render(
      <ProjetoKanban
        etapas={mockEtapas}
        projetosByEtapa={buildMap([mockProjeto])}
        onMoveProjeto={vi.fn()}
      />
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("exibe mensagem quando sem etapas", () => {
    render(
      <ProjetoKanban
        etapas={[]}
        projetosByEtapa={new Map()}
        onMoveProjeto={vi.fn()}
      />
    );
    expect(screen.getByText("Nenhuma etapa configurada")).toBeInTheDocument();
  });

  it("exibe 'Arraste projetos aqui' em coluna vazia", () => {
    render(
      <ProjetoKanban
        etapas={mockEtapas}
        projetosByEtapa={buildMap([mockProjeto])}
        onMoveProjeto={vi.fn()}
      />
    );
    expect(screen.getByText("Arraste projetos aqui")).toBeInTheDocument();
  });

  it("chama onMoveProjeto no drop", () => {
    const onMove = vi.fn();
    const { container } = render(
      <ProjetoKanban
        etapas={mockEtapas}
        projetosByEtapa={buildMap([mockProjeto])}
        onMoveProjeto={onMove}
      />
    );
    const card = screen.getByText("Maria Oliveira").closest("[draggable]");
    const columns = container.querySelectorAll(".rounded-xl");
    
    if (card && columns[1]) {
      // jsdom doesn't support dataTransfer — use createEvent with mock
      const dragStartEvent = new Event("dragstart", { bubbles: true });
      Object.defineProperty(dragStartEvent, "dataTransfer", {
        value: { effectAllowed: "move" },
      });
      card.dispatchEvent(dragStartEvent);

      const dragOverEvent = new Event("dragover", { bubbles: true });
      Object.defineProperty(dragOverEvent, "dataTransfer", {
        value: { dropEffect: "move" },
      });
      dragOverEvent.preventDefault = vi.fn();
      columns[1].dispatchEvent(dragOverEvent);

      const dropEvent = new Event("drop", { bubbles: true });
      dropEvent.preventDefault = vi.fn();
      columns[1].dispatchEvent(dropEvent);
      
      expect(onMove).toHaveBeenCalledWith("proj-1", "etapa-2");
    }
  });

  it("chama onViewProjeto ao clicar em card", () => {
    const onView = vi.fn();
    render(
      <ProjetoKanban
        etapas={mockEtapas}
        projetosByEtapa={buildMap([mockProjeto])}
        onMoveProjeto={vi.fn()}
        onViewProjeto={onView}
      />
    );
    fireEvent.click(screen.getByText("Maria Oliveira"));
    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ id: "proj-1" }));
  });

  it("exibe valor formatado do projeto", () => {
    render(
      <ProjetoKanban
        etapas={mockEtapas}
        projetosByEtapa={buildMap([mockProjeto])}
        onMoveProjeto={vi.fn()}
      />
    );
    expect(screen.getByText("R$ 25.000")).toBeInTheDocument();
  });

  it("exibe potência kWp", () => {
    render(
      <ProjetoKanban
        etapas={mockEtapas}
        projetosByEtapa={buildMap([mockProjeto])}
        onMoveProjeto={vi.fn()}
      />
    );
    expect(screen.getByText("5 kWp")).toBeInTheDocument();
  });
});
