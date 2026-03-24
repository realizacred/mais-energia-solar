/**
 * UCGdInfoCard — resumo de GD na Visão Geral da UC.
 * Linguagem natural, sem jargão técnico. Cards simples com ação direta.
 */
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sun, Users } from "lucide-react";
import { useGdBeneficiariesByUC, useGdGroupByGenerator } from "@/hooks/useGdBeneficiaries";
import { buildUcDetailPath } from "./ucNavigation";

interface Props {
  ucId: string;
  ucName: string;
  ucCode: string;
}

export function UCGdInfoCard({ ucId, ucName, ucCode }: Props) {
  const navigate = useNavigate();
  const { data: asGenerator = [] } = useGdGroupByGenerator(ucId);
  const { data: asBeneficiary = [] } = useGdBeneficiariesByUC(ucId);

  if (asGenerator.length === 0 && asBeneficiary.length === 0) return null;

  return (
    <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
      <CardContent className="p-4 md:p-5 space-y-3">
        {/* Generator summary */}
        {asGenerator.map((group: any) => (
          <div key={group.id} className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sun className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Esta unidade gera energia para o grupo "{group.nome}"
                </p>
                <p className="text-xs text-muted-foreground">
                  Os créditos são distribuídos para as unidades beneficiárias deste grupo.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 shrink-0"
              onClick={() =>
                navigate(buildUcDetailPath(ucId, { tab: "gd", gdGroupId: group.id, gdGroupName: group.nome }))
              }
            >
              Ver distribuição <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        ))}

        {/* Beneficiary summary */}
        {asBeneficiary.map((item: any) => (
          <div key={item.id} className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-info" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Recebe <span className="font-mono">{Number(item.allocation_percent).toFixed(1)}%</span> do grupo "{item.gd_groups?.nome}"
                </p>
                <p className="text-xs text-muted-foreground">
                  Créditos de energia distribuídos pela UC geradora deste grupo.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 shrink-0"
              onClick={() =>
                navigate(buildUcDetailPath(ucId, { tab: "gd" }))
              }
            >
              Ver detalhes <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
