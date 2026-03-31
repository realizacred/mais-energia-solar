import { Trophy } from "lucide-react";
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Metas & Ranking</h1>
            <p className="text-sm text-muted-foreground">Seu desempenho e posição na equipe</p>
          </div>
        </div>
      </div>
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
