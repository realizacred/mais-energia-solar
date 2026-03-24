/**
 * UCGdInfoCard — Shows GD participation info on UC detail page.
 * Links directly to the specific GD group or generator UC.
 */
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sun, Users, ExternalLink } from "lucide-react";
import { useGdBeneficiariesByUC, useGdGroupByGenerator } from "@/hooks/useGdBeneficiaries";

interface Props {
  ucId: string;
}

export function UCGdInfoCard({ ucId }: Props) {
  const navigate = useNavigate();
  const { data: asGenerator = [] } = useGdGroupByGenerator(ucId);
  const { data: asBeneficiary = [] } = useGdBeneficiariesByUC(ucId);

  if (asGenerator.length === 0 && asBeneficiary.length === 0) return null;

  return (
    <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
      <CardContent className="p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Sun className="w-3.5 h-3.5 text-primary" />
          Geração Distribuída
        </p>

        {asGenerator.length > 0 && (
          <div className="space-y-1">
            {asGenerator.map((g: any) => (
              <div key={g.id} className="flex items-center gap-2 flex-wrap">
                <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                  <Sun className="w-3 h-3 mr-1" /> Geradora
                </Badge>
                <span className="text-sm text-foreground">{g.nome}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-primary gap-1 px-2"
                  onClick={() => navigate(`/admin/ucs/${ucId}?tab=gd`)}
                >
                  Ver grupo <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {asBeneficiary.length > 0 && (
          <div className="space-y-1">
            {asBeneficiary.map((b: any) => (
              <div key={b.id} className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 mr-1" /> Beneficiária
                </Badge>
                <span className="text-sm text-foreground">{b.gd_groups?.nome}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {Number(b.allocation_percent).toFixed(2)}%
                </span>
                {b.gd_groups?.uc_geradora_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-primary gap-1 px-2"
                    onClick={() => navigate(`/admin/ucs/${b.gd_groups.uc_geradora_id}?tab=gd`)}
                  >
                    Ver geradora <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
