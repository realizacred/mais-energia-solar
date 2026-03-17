/**
 * ClientesManager — smoke test
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
    hasPermission: () => true,
    isLoading: false,
  }),
}));

import { render } from "@testing-library/react";
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
});
