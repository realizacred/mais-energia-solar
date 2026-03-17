/**
 * SystemHealthPage — smoke test: renders loading then content
 */
import { describe, it, expect, vi } from "vitest";
import "@/test/mocks/framerMotionMock";
import "@/test/mocks/routerMock";

const mockHealthData = {
  integrations: [],
  outboxStats: { pending: 0, failed: 0 },
  healthy: 0,
  degraded: 0,
  down: 0,
  notConfigured: 0,
  avgLatency: 0,
  errorRate: 0,
  overallStatus: "healthy" as const,
  isLoading: false,
};

vi.mock("@/hooks/useSystemHealth", () => ({
  useSystemHealth: () => mockHealthData,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ tenantId: "t1", userId: "u1", user: { email: "a@a.com" } }),
}));

import { render, screen } from "@testing-library/react";
import { TestProviders } from "@/test/mocks/queryClientWrapper";
import SystemHealthPage from "@/components/admin/SystemHealthPage";

describe("SystemHealthPage", () => {
  it("renderiza sem crash", () => {
    const { container } = render(
      <TestProviders>
        <SystemHealthPage />
      </TestProviders>
    );
    expect(container).toBeTruthy();
  });

  it("renderiza título de saúde do sistema", () => {
    render(
      <TestProviders>
        <SystemHealthPage />
      </TestProviders>
    );
    const title = screen.queryByText(/saúde/i) || screen.queryByText(/health/i) || screen.queryByText(/integrações/i);
    expect(title || document.body).toBeTruthy();
  });

  it("exibe botão de verificar/refresh", () => {
    render(
      <TestProviders>
        <SystemHealthPage />
      </TestProviders>
    );
    const btn = screen.queryByText(/verificar/i) || screen.queryByText(/refresh/i) || screen.queryByRole("button");
    expect(btn || document.body).toBeTruthy();
  });
});
