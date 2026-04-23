/**
 * EtapasToConsultores — tabela de mapeamento etapa do SolarMarket → consultor do CRM.
 * Renderiza a lista de etapas de um funil "vendedor_source" e permite vincular
 * cada etapa a um consultor ativo. Salva no banco ao selecionar.
 *
 * Governança:
 *  - RB-04: queries vivem em hooks
 *  - RB-06: skeleton durante loading
 *  - RB-58: mutation já confirma com .select()
 */
import { useEffect, useMemo, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, CheckCircle2, Clock } from "lucide-react";
import { useSmEtapasFunil } from "@/hooks/useSmEtapasFunil";
import {
  useSmConsultorMappings,
  useSaveConsultorMapping,
} from "@/hooks/useSmConsultorMapping";
import { useConsultoresAtivos } from "@/hooks/useConsultoresAtivos";
import { toast } from "sonner";

interface Props {
  tenantId: string;
  smFunilName: string;
}

/**
 * Tenta achar 1 único consultor cujo nome contenha o nome da etapa
 * (case-insensitive, sem acentos básicos). Se houver ambiguidade, retorna null.
 */
function autoMatch(
  etapaName: string,
  consultores: { id: string; nome: string }[],
): string | null {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const e = norm(etapaName);
  if (!e) return null;
  const matches = consultores.filter((c) => norm(c.nome).includes(e));
  if (matches.length === 1) return matches[0].id;
  return null;
}

export function EtapasToConsultores({ tenantId, smFunilName }: Props) {
  const { data: etapas, isLoading: loadingEtapas } = useSmEtapasFunil(
    tenantId,
    smFunilName,
  );
  const { data: consultores, isLoading: loadingCons } = useConsultoresAtivos();
  const { data: mappings, isLoading: loadingMaps } = useSmConsultorMappings(tenantId);
  const saveMutation = useSaveConsultorMapping();

  const mapByEtapa = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const row of mappings ?? []) m.set(row.sm_name, row.consultor_id);
    return m;
  }, [mappings]);

  // Auto-match no primeiro carregamento (apenas se ainda não há mapeamentos salvos)
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current) return;
    if (loadingEtapas || loadingCons || loadingMaps) return;
    if (!etapas || !consultores) return;
    if ((mappings ?? []).length > 0) {
      autoRanRef.current = true;
      return;
    }
    autoRanRef.current = true;
    (async () => {
      for (const e of etapas) {
        const guess = autoMatch(e.smEtapaName, consultores);
        if (!guess) continue;
        try {
          await saveMutation.mutateAsync({
            tenantId,
            smEtapaName: e.smEtapaName,
            consultorId: guess,
          });
        } catch {
          // silencioso — o usuário pode ajustar manualmente
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingEtapas, loadingCons, loadingMaps, etapas, consultores, mappings]);

  const total = etapas?.length ?? 0;
  const mapeadas = (etapas ?? []).filter(
    (e) => mapByEtapa.get(e.smEtapaName),
  ).length;
  const pendentes = total - mapeadas;

  const handleChange = async (etapaName: string, consultorId: string) => {
    if (!consultorId) return;
    try {
      await saveMutation.mutateAsync({
        tenantId,
        smEtapaName: etapaName,
        consultorId,
      });
      toast.success("Mapeamento salvo");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(msg);
    }
  };

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Mapear etapas → Consultores
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Cada etapa do funil <strong>{smFunilName}</strong> indica qual consultor atendeu.
              </p>
            </div>
          </div>
          {!loadingEtapas && total > 0 && (
            <Badge
              variant="outline"
              className={
                pendentes === 0
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-warning/10 text-warning border-warning/20"
              }
            >
              {mapeadas} de {total} mapeadas
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {(loadingEtapas || loadingCons || loadingMaps) && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        )}

        {!loadingEtapas && etapas && etapas.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Este funil não tem etapas no staging.
          </p>
        )}

        {!loadingEtapas && etapas && etapas.length > 0 && (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">
                    Etapa no SolarMarket
                  </th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">
                    Consultor no CRM
                  </th>
                  <th className="px-3 py-2 font-medium text-muted-foreground w-12">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {etapas.map((e) => {
                  const current = mapByEtapa.get(e.smEtapaName) ?? "";
                  const ok = !!current;
                  return (
                    <tr
                      key={e.smEtapaId || e.smEtapaName}
                      className="border-t border-border"
                    >
                      <td className="px-3 py-2 text-foreground">{e.smEtapaName}</td>
                      <td className="px-3 py-2">
                        <Select
                          value={current}
                          onValueChange={(v) => handleChange(e.smEtapaName, v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecione um consultor..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(consultores ?? []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        {ok ? (
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        ) : (
                          <Clock className="w-4 h-4 text-warning" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
