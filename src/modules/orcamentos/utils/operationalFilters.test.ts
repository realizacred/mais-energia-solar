import { describe, it, expect } from "vitest";
import { 
  shouldShowOrcamento, 
  getTerminalStatusIds, 
  OperationalFilterOptions 
} from "./operationalFilters";
import { LeadStatus } from "@/types/lead";

describe("operationalFilters", () => {
  const mockStatuses: LeadStatus[] = [
    { id: "s1", nome: "Novo", cor: "blue", ordem: 1 },
    { id: "s2", nome: "Em Atendimento", cor: "green", ordem: 2 },
    { id: "s3", nome: "Convertido", cor: "gold", ordem: 3 },
    { id: "s4", nome: "Perdido", cor: "red", ordem: 4 },
  ];

  const terminalIds = getTerminalStatusIds(mockStatuses); // ["s3", "s4"]

  const baseOrcamento = {
    status_id: null,
    visto: false,
    estado: "SP",
    created_at: new Date().toISOString()
  };

  it("should show new budget (status null) by default even with excludeTerminal", () => {
    const options: OperationalFilterOptions = {
      excludeTerminal: true
    };
    expect(shouldShowOrcamento(baseOrcamento, options, terminalIds)).toBe(true);
  });

  it("should hide terminal budgets when excludeTerminal is true", () => {
    const options: OperationalFilterOptions = {
      excludeTerminal: true
    };
    const terminalOrcamento = { ...baseOrcamento, status_id: "s3" };
    expect(shouldShowOrcamento(terminalOrcamento, options, terminalIds)).toBe(false);
  });

  it("should show terminal budgets when excludeTerminal is false", () => {
    const options: OperationalFilterOptions = {
      excludeTerminal: false
    };
    const terminalOrcamento = { ...baseOrcamento, status_id: "s3" };
    expect(shouldShowOrcamento(terminalOrcamento, options, terminalIds)).toBe(true);
  });

  it("should filter by age", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);
    
    const oldOrcamento = { ...baseOrcamento, created_at: oldDate.toISOString() };
    
    const options: OperationalFilterOptions = {
      maxAgeDays: 30
    };
    
    expect(shouldShowOrcamento(oldOrcamento, options, terminalIds)).toBe(false);
    expect(shouldShowOrcamento(baseOrcamento, options, terminalIds)).toBe(true);
  });

  it("should filter by status 'novo'", () => {
    const options: OperationalFilterOptions = {
      filterStatus: "novo"
    };
    
    const inProgressOrcamento = { ...baseOrcamento, status_id: "s2" };
    
    expect(shouldShowOrcamento(baseOrcamento, options, terminalIds)).toBe(true);
    expect(shouldShowOrcamento(inProgressOrcamento, options, terminalIds)).toBe(false);
  });

  it("should filter by specific status", () => {
    const options: OperationalFilterOptions = {
      filterStatus: "s2"
    };
    
    const inProgressOrcamento = { ...baseOrcamento, status_id: "s2" };
    
    expect(shouldShowOrcamento(baseOrcamento, options, terminalIds)).toBe(false);
    expect(shouldShowOrcamento(inProgressOrcamento, options, terminalIds)).toBe(true);
  });
});
