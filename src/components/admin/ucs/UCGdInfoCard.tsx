/**
 * UCGdInfoCard — Shows GD participation info on UC detail page.
 * Links directly to the specific GD group.
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sun, Users, ExternalLink } from "lucide-react";
import { useGdBeneficiariesByUC, useGdGroupByGenerator } from "@/hooks/useGdBeneficiaries";
import { Link } from "react-router-dom";

interface Props {
  ucId: string;
}

export function UCGdInfoCard({ ucId }: Props) {
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
                <span className="text-xs text-muted-foreground">Grupo GD</span>
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
                <Link to={`/admin/gd-rateio?group=${b.gd_groups?.id}`} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  Ver grupo <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
