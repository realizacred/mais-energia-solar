/**
 * SystemHealthPage — smoke test
 */
import { describe, it, expect, vi } from "vitest";
import "@/test/mocks/framerMotionMock";
import "@/test/mocks/routerMock";

vi.mock("@/hooks/useSystemHealth", () => ({
  useSystemHealth: () => ({
    integrations: [],
    outboxStats: { pending: 0, failed: 0, recentFailures: [] },
    healthy: 0,
    degraded: 0,
    down: 0,
    notConfigured: 0,
    avgLatency: 0,
    errorRate: 0,
    overallStatus: "healthy",
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ tenantId: "t1", userId: "u1", user: { email: "a@a.com" } }),
}));

import { render } from "@testing-library/react";
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
});
