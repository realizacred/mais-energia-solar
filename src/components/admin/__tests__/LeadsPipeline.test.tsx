/**
 * LeadsPipeline — smoke test: renders without crash
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
    permissions: { can_manage_leads: true },
    isLoading: false,
  }),
}));

import { render } from "@testing-library/react";
import { TestProviders } from "@/test/mocks/queryClientWrapper";

let LeadsPipeline: any;

beforeEach(async () => {
  const mod = await import("@/components/admin/LeadsPipeline");
  LeadsPipeline = mod.default;
});

describe("LeadsPipeline", () => {
  it("renderiza sem crash", () => {
    const { container } = render(
      <TestProviders>
        <LeadsPipeline />
      </TestProviders>
    );
    expect(container).toBeTruthy();
  });
});
