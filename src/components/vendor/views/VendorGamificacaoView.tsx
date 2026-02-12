import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trophy, ChevronDown } from "lucide-react";
import { VendorAchievements, VendorGoals, VendorLeaderboard, AdvancedMetricsCard } from "@/components/vendor/gamification";

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

export default function VendorGamificacaoView({ portal }: Props) {
  const {
    vendedor,
    achievements,
    goals,
    totalPoints,
    ranking,
    myRankPosition,
    advancedMetrics,
    metricsLoading,
  } = portal;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VendorGoals goals={goals} />
        <VendorAchievements achievements={achievements} totalPoints={totalPoints} />
      </div>

      <VendorLeaderboard
        ranking={ranking}
        currentVendedorId={vendedor?.id || null}
        myRankPosition={myRankPosition}
      />

      <AdvancedMetricsCard metrics={advancedMetrics} loading={metricsLoading} />
    </div>
  );
}
