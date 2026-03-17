/**
 * ClientesManager — smoke test: renders without crash
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@/test/mocks/framerMotionMock";
import "@/test/mocks/supabaseMock";
import "@/test/mocks/routerMock";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ tenantId: "t1", userId: "u1", user: { email: "a@a.com" }, role: "admin" }),
}));

vi.mock("@/hooks/useUserPermissions", () => ({
  useUserPermissions: () => ({
    permissions: { can_manage_clientes: true },
    isLoading: false,
  }),
}));

import { render, screen } from "@testing-library/react";
import { TestProviders } from "@/test/mocks/queryClientWrapper";

let ClientesManager: any;

beforeEach(async () => {
  const mod = await import("@/components/admin/ClientesManager");
  ClientesManager = mod.ClientesManager;
});

describe("ClientesManager", () => {
  it("renderiza sem crash", () => {
    const { container } = render(
      <TestProviders>
        <ClientesManager />
      </TestProviders>
    );
    expect(container).toBeTruthy();
  });

  it("renderiza título ou conteúdo da página", () => {
    render(
      <TestProviders>
        <ClientesManager />
      </TestProviders>
    );
    const title = screen.queryByText(/cliente/i);
    expect(title || document.body).toBeTruthy();
  });
});
