/**
 * UCGdInfoCard — resumo contextual de GD na UC.
 * Mostra rapidamente como a UC participa de GD e para onde o usuário pode navegar.
 */
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, ExternalLink, GitBranch, MoveRight, Sun, Users } from "lucide-react";
import { useGdBeneficiariesByUC, useGdGroupByGenerator } from "@/hooks/useGdBeneficiaries";
import { buildUcDetailPath, readUcNavigationContext } from "./ucNavigation";

interface Props {
  ucId: string;
  ucName: string;
  ucCode: string;
}

export function UCGdInfoCard({ ucId, ucName, ucCode }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const navigationContext = readUcNavigationContext(searchParams);
  const { data: asGenerator = [] } = useGdGroupByGenerator(ucId);
  const { data: asBeneficiary = [] } = useGdBeneficiariesByUC(ucId);

  if (asGenerator.length === 0 && asBeneficiary.length === 0) return null;

  return (
    <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
      <CardContent className="p-4 md:p-5 space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-primary" />
              Relações de Geração Distribuída
            </p>
            <p className="text-sm text-muted-foreground">
              Entenda em segundos se esta UC gera créditos, recebe créditos ou participa dos dois lados do fluxo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {asGenerator.length > 0 && (
              <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                <Sun className="w-3 h-3 mr-1" /> Geradora
              </Badge>
            )}
            {asBeneficiary.length > 0 && (
              <Badge variant="outline" className="text-xs border-info/20 text-info bg-info/10">
                <Users className="w-3 h-3 mr-1" /> Beneficiária
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {asGenerator.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">UC Geradora</p>
                  <p className="text-xs text-muted-foreground">
                    Esta unidade é a origem do grupo GD e distribui créditos para as beneficiárias.
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sun className="w-4 h-4 text-primary" />
                </div>
              </div>

              <div className="space-y-2">
                {asGenerator.map((group: any) => (
                  <div key={group.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-medium text-foreground">{group.nome}</p>
                        <p className="text-xs text-muted-foreground">Grupo onde esta UC atua como origem da GD.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() =>
                          navigate(
                            buildUcDetailPath(ucId, {
                              ...navigationContext,
                              tab: "gd",
                              subtab: null,
                              gdGroupId: group.id,
                              gdGroupName: group.nome,
                            }),
                          )
                        }
                      >
                        Ver distribuição <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {asBeneficiary.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">UC Beneficiária</p>
                  <p className="text-xs text-muted-foreground">
                    Esta unidade recebe créditos de outro grupo GD.
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-info" />
                </div>
              </div>

              <div className="space-y-2">
                {asBeneficiary.map((item: any) => (
                  <div key={item.id} className="rounded-lg border border-border bg-card p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.gd_groups?.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Recebe <span className="font-mono text-foreground">{Number(item.allocation_percent).toFixed(2)}%</span> deste grupo.
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        <Building2 className="w-3 h-3 mr-1" /> {ucCode}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground truncate">{ucName}</span>
                      <MoveRight className="w-3 h-3 shrink-0" />
                      <span className="truncate">{item.gd_groups?.nome}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.gd_groups?.uc_geradora_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          onClick={() =>
                            navigate(
                              buildUcDetailPath(item.gd_groups.uc_geradora_id, {
                                tab: "overview",
                                origin: "gd-beneficiary",
                                fromUcId: ucId,
                                fromUcName: ucName,
                                fromUcCode: ucCode,
                                gdGroupId: item.gd_groups.id,
                                gdGroupName: item.gd_groups.nome,
                                relatedUcId: ucId,
                                relatedUcName: ucName,
                                relatedUcCode: ucCode,
                                returnTab: "gd",
                              }),
                            )
                          }
                        >
                          Ir para UC geradora <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}

                      {item.gd_groups?.uc_geradora_id && (
                        <Button
                          variant="soft"
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          onClick={() =>
                            navigate(
                              buildUcDetailPath(item.gd_groups.uc_geradora_id, {
                                tab: "gd",
                                origin: "gd-beneficiary",
                                fromUcId: ucId,
                                fromUcName: ucName,
                                fromUcCode: ucCode,
                                gdGroupId: item.gd_groups.id,
                                gdGroupName: item.gd_groups.nome,
                                relatedUcId: ucId,
                                relatedUcName: ucName,
                                relatedUcCode: ucCode,
                                returnTab: "gd",
                              }),
                            )
                          }
                        >
                          Ver grupo e distribuição <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
