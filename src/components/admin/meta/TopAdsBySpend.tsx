import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { formatBRL } from "@/lib/formatters/index";

interface AdRow {
  ad_id: string;
  ad_name: string;
  spend: number;
  ctr: number;
  leads_count: number;
}

interface Props {
  ads: AdRow[];
  isLoading?: boolean;
}

const MEDAL_COLORS = [
  "bg-primary text-primary-foreground",
  "bg-muted-foreground/60 text-background",
  "bg-primary/80 text-primary-foreground",
  "bg-muted text-muted-foreground",
  "bg-muted text-muted-foreground",
];

export function TopAdsBySpend({ ads, isLoading }: Props) {
  const top5 = ads.slice(0, 5);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Top Anúncios por Investimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : top5.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Trophy className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum anúncio encontrado</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Configure a integração com a Meta para visualizar métricas
            </p>
          </div>
        ) : (
          top5.map((ad, i) => (
            <div
              key={ad.ad_id}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${MEDAL_COLORS[i]}`}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ad.ad_name || "Sem nome"}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>CTR {ad.ctr.toFixed(2)}%</span>
                  <span>● {ad.leads_count} leads</span>
                </div>
              </div>
              <span className="text-sm font-semibold text-primary whitespace-nowrap">
                {formatBRL(ad.spend)}
              </span>
            </div>
          ))
        )}
        {top5.length > 0 && (
          <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
            <span>↗ CTR</span>
            <span>● Leads</span>
            <span>$ Investimento</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
