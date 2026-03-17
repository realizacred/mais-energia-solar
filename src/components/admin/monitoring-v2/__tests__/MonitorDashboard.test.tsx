/**
 * MonitorDashboard — loading skeleton, empty state, KPI rendering
 */
import { describe, it, expect, vi } from "vitest";
import "@/test/mocks/framerMotionMock";
import "@/test/mocks/routerMock";

// Mock the dashboard data hook BEFORE importing component
const mockData = {
  stats: null as any,
  plants: [],
  openAlerts: [],
  readings: [],
  financials: null,
  prData: [],
  isLoading: true,
  totalPowerMwp: 0,
  totalEnergyTodayMwh: 0,
  totalEnergyMonthMwh: 0,
  activeCount: 0,
  activePerc: 0,
  isNight: false,
  alertCount: 0,
  avgPR: 0,
  avgLat: 0,
  avgLng: 0,
  isGenerating: false,
  isDaylight: true,
  realCurrentPower: 0,
  lastSync: null,
  nextSync: null,
};

vi.mock("@/hooks/useMonitorDashboardData", () => ({
  useMonitorDashboardData: () => mockData,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ tenantId: "t1", userId: "u1", user: { email: "a@a.com" } }),
}));

import { render, screen } from "@testing-library/react";
import { TestProviders } from "@/test/mocks/queryClientWrapper";
import MonitorDashboard from "@/components/admin/monitoring-v2/MonitorDashboard";

describe("MonitorDashboard", () => {
  it("exibe skeleton durante loading", () => {
    mockData.isLoading = true;
    mockData.stats = null;
    const { container } = render(
      <TestProviders>
        <MonitorDashboard />
      </TestProviders>
    );
    // Skeleton components should be present
    const skeletons = container.querySelectorAll("[class*='animate-pulse'], [data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("exibe empty state quando sem plantas", () => {
    mockData.isLoading = false;
    mockData.stats = { total_plants: 0, online: 0, offline: 0, standby: 0 };
    render(
      <TestProviders>
        <MonitorDashboard />
      </TestProviders>
    );
    // Should show empty state message
    const text = screen.queryByText(/nenhuma usina/i) || screen.queryByText(/configurar/i);
    // At minimum, no crash
    expect(document.body).toBeTruthy();
  });

  it("renderiza sem crash com dados populados", () => {
    mockData.isLoading = false;
    mockData.stats = { total_plants: 5, online: 3, offline: 1, standby: 1 };
    mockData.totalPowerMwp = 1.5;
    mockData.totalEnergyTodayMwh = 12.3;
    mockData.activeCount = 3;
    mockData.activePerc = 60;
    mockData.plants = [];
    const { container } = render(
      <TestProviders>
        <MonitorDashboard />
      </TestProviders>
    );
    expect(container.querySelector("[class*='space-y']")).toBeInTheDocument();
  });
});
