/**
 * CustomFieldsMappingSummary — Resumo do mapeamento de custom fields.
 *
 * Exibido no Step 4 (Migrar) antes do usuário confirmar a migração, para que
 * ele veja quantos campos do SolarMarket vão: vincular (map), criar novos (create),
 * gravar em campo nativo (map_native), ignorar (ignore) e quantos ainda estão
 * sem decisão (pendentes).
 *
 * Reusa hooks existentes (§16 / RB-04 / RB-69) — não dispara queries próprias.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Layers,
  Link2,
  Loader2,
  Plus,
  XCircle,
} from "lucide-react";
import {
  useCustomFieldMappings,
  useSmCustomFieldsStaging,
  type CfAction,
} from "@/hooks/useSmCustomFieldMapping";

interface Props {
  tenantId: string;
}

const TILE = {
  map:        { label: "Vincular a campo existente", Icon: Link2,        color: "text-info",        bg: "bg-info/10",        border: "border-info/30" },
  create:     { label: "Criar novo campo no CRM",    Icon: Plus,         color: "text-success",     bg: "bg-success/10",     border: "border-success/30" },
  map_native: { label: "Gravar em campo nativo",     Icon: Layers,       color: "text-primary",     bg: "bg-primary/10",     border: "border-primary/30" },
  ignore:     { label: "Ignorar na migração",        Icon: XCircle,      color: "text-muted-foreground", bg: "bg-muted",     border: "border-border" },
} as const;

export function CustomFieldsMappingSummary({ tenantId }: Props) {
  const fieldsQ = useSmCustomFieldsStaging(tenantId);
  const mappingsQ = useCustomFieldMappings(tenantId);

  // Garante leitura fresca ao entrar no Step 4 (evita exibir cache vazio
  // quando o usuário acaba de mapear no Step 3 e voltou para cá).
  useEffect(() => {
    mappingsQ.refetch();
    fieldsQ.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const isLoading = fieldsQ.isLoading || mappingsQ.isLoading;
  const fields = fieldsQ.data ?? [];
  const mappings = mappingsQ.data ?? {};

  const totalFields = fields.length;
  const counts: Record<CfAction, number> = { map: 0, create: 0, map_native: 0, ignore: 0 };
  let pendentes = 0;

  for (const f of fields) {
    const m = mappings[f.key];
    if (!m) {
      pendentes++;
      continue;
    }
    counts[m.action] = (counts[m.action] ?? 0) + 1;
  }

  const decididos = totalFields - pendentes;
  const allDecided = totalFields > 0 && pendentes === 0;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Mapeamento de campos customizados
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Confira como cada campo do SolarMarket será tratado antes de iniciar a migração.
            </p>
          </div>
          {!isLoading && (
            allDecided ? (
              <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1 h-6">
                <CheckCircle2 className="w-3 h-3" /> Tudo mapeado
              </Badge>
            ) : pendentes > 0 ? (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 gap-1 h-6">
                <AlertCircle className="w-3 h-3" /> {pendentes} pendente{pendentes > 1 ? "s" : ""}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-muted text-muted-foreground border-border h-6">
                Sem campos
              </Badge>
            )
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando resumo do mapeamento…
          </div>
        ) : totalFields === 0 ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Nenhum campo customizado encontrado no staging do SolarMarket.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(Object.keys(TILE) as CfAction[]).map((action) => {
                const t = TILE[action];
                const value = counts[action] ?? 0;
                return (
                  <div key={action} className={`rounded-lg border p-3 ${t.border} ${t.bg}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <t.Icon className={`w-4 h-4 ${t.color}`} />
                      <p className="text-[11px] font-medium text-foreground leading-tight">{t.label}</p>
                    </div>
                    <p className={`text-xl font-bold tracking-tight ${t.color}`}>
                      {value.toLocaleString("pt-BR")}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border flex-wrap">
              <p className="text-xs text-muted-foreground">
                {decididos.toLocaleString("pt-BR")} de {totalFields.toLocaleString("pt-BR")} campo
                {totalFields > 1 ? "s" : ""} mapeado{decididos === 1 ? "" : "s"}
                {pendentes > 0 && (
                  <> · <span className="text-warning font-medium">{pendentes} sem decisão (serão ignorados)</span></>
                )}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/migracao-solarmarket/custom-fields">
                  Revisar mapeamento <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
