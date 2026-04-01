import { useMemo } from "react";
import { AlertCircle, CheckCircle2, FileText, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/utils/valorPorExtenso";
import { formatPhoneBR } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useVariableMapperData } from "@/hooks/useVariableMapper";

// ── Types ────────────────────────────────────────
interface VariableMapping {
  key: string;
  label: string;
  group: string;
  value: string | number | null;
  source: "cliente" | "projeto" | "proposta" | "empresa" | "calculado";
}

interface Props {
  dealId: string;
  customerId: string | null;
  projetoId?: string | null;
  onGenerateContract?: () => void;
}

// ── Variable definitions mapped to template DOCX ──
const VARIABLE_DEFS: Array<{
  key: string;
  label: string;
  group: string;
  source: VariableMapping["source"];
  path: string;
}> = [
  { key: "cliente_nome", label: "Nome completo", group: "Cliente", source: "cliente", path: "cliente.nome" },
  { key: "cliente_cpf_cnpj", label: "CPF / CNPJ", group: "Cliente", source: "cliente", path: "cliente.cpf_cnpj" },
  { key: "cliente_telefone", label: "Telefone", group: "Cliente", source: "cliente", path: "cliente.telefone" },
  { key: "cliente_email", label: "E-mail", group: "Cliente", source: "cliente", path: "cliente.email" },
  { key: "cliente_endereco", label: "Endereço completo", group: "Cliente", source: "cliente", path: "cliente.endereco" },
  { key: "potencia_sistema", label: "Potência (kWp)", group: "Engenharia", source: "projeto", path: "projeto.potencia_kwp" },
  { key: "modulo_quantidade", label: "Qtd. Módulos", group: "Engenharia", source: "projeto", path: "projeto.numero_modulos" },
  { key: "modulo_marca", label: "Modelo dos Módulos", group: "Engenharia", source: "projeto", path: "projeto.modelo_modulos" },
  { key: "inversor_modelo", label: "Modelo do Inversor", group: "Engenharia", source: "projeto", path: "projeto.modelo_inversor" },
  { key: "inversores_utilizados", label: "Qtd. Inversores", group: "Engenharia", source: "projeto", path: "projeto.numero_inversores" },
  { key: "area_util", label: "Área útil (m²)", group: "Engenharia", source: "projeto", path: "projeto.area_util_m2" },
  { key: "geracao_mensal_media", label: "Geração mensal (kWh)", group: "Engenharia", source: "projeto", path: "projeto.geracao_mensal_media_kwh" },
  { key: "valor_venda_total", label: "Valor total", group: "Financeiro", source: "projeto", path: "projeto.valor_total" },
  { key: "preco_por_extenso", label: "Valor por extenso", group: "Financeiro", source: "calculado", path: "_calc.preco_por_extenso" },
  { key: "forma_pagamento", label: "Forma de pagamento", group: "Financeiro", source: "projeto", path: "projeto.forma_pagamento" },
  { key: "valor_entrada", label: "Entrada", group: "Financeiro", source: "projeto", path: "projeto.valor_entrada" },
  { key: "valor_financiado", label: "Valor financiado", group: "Financeiro", source: "projeto", path: "projeto.valor_financiado" },
  { key: "numero_parcelas", label: "Nº parcelas", group: "Financeiro", source: "projeto", path: "projeto.numero_parcelas" },
  { key: "valor_parcela", label: "Valor da parcela", group: "Financeiro", source: "projeto", path: "projeto.valor_parcela" },
  { key: "prazo_estimado_dias", label: "Prazo instalação (dias)", group: "Instalação", source: "projeto", path: "projeto.prazo_estimado_dias" },
  { key: "prazo_vistoria", label: "Prazo vistoria (dias)", group: "Instalação", source: "projeto", path: "projeto.prazo_vistoria_dias" },
  { key: "empresa_nome", label: "Razão social", group: "Empresa", source: "empresa", path: "tenant.nome" },
  { key: "empresa_cnpj", label: "CNPJ", group: "Empresa", source: "empresa", path: "tenant.documento" },
];

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split(".").reduce((curr, key) => curr?.[key], obj);
}

function formatDisplayValue(value: any, key: string): string {
  if (value === null || value === undefined || value === "") return "";
  if (key.includes("telefone")) return formatPhoneBR(String(value));
  if (key.includes("valor") || key === "preco_por_extenso") {
    if (key === "preco_por_extenso") return String(value);
    if (typeof value === "number") return formatCurrency(value);
  }
  return String(value);
}

// ── Component ────────────────────────────────────
export function VariableMapperPanel({ dealId, customerId, projetoId, onGenerateContract }: Props) {
  const { data: dataMap = {}, isLoading: loading, refetch } = useVariableMapperData(dealId, customerId);

  const mappings: VariableMapping[] = useMemo(() => {
    return VARIABLE_DEFS.map(def => ({
      key: def.key,
      label: def.label,
      group: def.group,
      source: def.source,
      value: getNestedValue(dataMap, def.path) ?? null,
    }));
  }, [dataMap]);

  const groups = useMemo(() => {
    const map = new Map<string, VariableMapping[]>();
    mappings.forEach(m => {
      const list = map.get(m.group) || [];
      list.push(m);
      map.set(m.group, list);
    });
    return Array.from(map.entries());
  }, [mappings]);

  const missingCount = mappings.filter(m => m.value === null || m.value === "").length;
  const totalCount = mappings.length;
  const readyPercent = Math.round(((totalCount - missingCount) / totalCount) * 100);

  if (loading) {
    return (
      <div className="space-y-3 py-6">
        <Skeleton className="h-5 w-48" />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-foreground">Vínculo de Contrato</h3>
          <Badge variant="outline" className={cn("text-[10px]", missingCount === 0 ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20")}>
            {missingCount === 0 ? (
              <><CheckCircle2 className="h-3 w-3 mr-1" /> Completo</>
            ) : (
              <><AlertCircle className="h-3 w-3 mr-1" /> {missingCount} campo{missingCount !== 1 ? "s" : ""} faltando</>
            )}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" /> Atualizar
          </Button>
          {onGenerateContract && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1"
                  disabled={missingCount > 0}
                  onClick={onGenerateContract}
                >
                  <FileText className="h-3.5 w-3.5" /> Gerar Contrato
                </Button>
              </TooltipTrigger>
              {missingCount > 0 && (
                <TooltipContent className="text-xs">
                  Preencha todos os campos obrigatórios antes de gerar o contrato
                </TooltipContent>
              )}
            </Tooltip>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            readyPercent >= 80 ? "bg-success" : readyPercent >= 50 ? "bg-warning" : "bg-destructive"
          )}
          style={{ width: `${readyPercent}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">{readyPercent}% dos campos preenchidos ({totalCount - missingCount}/{totalCount})</p>

      {/* Variable groups */}
      <div className="space-y-3">
        {groups.map(([groupName, items]) => {
          const groupMissing = items.filter(m => m.value === null || m.value === "").length;
          return (
            <Card key={groupName}>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{groupName}</CardTitle>
                  {groupMissing > 0 && (
                    <Badge variant="outline" className="text-[9px] text-destructive border-destructive/30">
                      {groupMissing} faltando
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-1.5 font-medium text-muted-foreground w-[180px]">Variável</th>
                        <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Valor Atual</th>
                        <th className="text-center px-3 py-1.5 font-medium text-muted-foreground w-[60px]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(m => {
                        const filled = m.value !== null && m.value !== "";
                        const displayValue = formatDisplayValue(m.value, m.key);
                        return (
                          <tr key={m.key} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-3 py-2">
                              <code className="font-mono text-primary/80 text-[10px]">[{m.key}]</code>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
                            </td>
                            <td className="px-3 py-2 font-medium">
                              {filled ? (
                                <span className="text-foreground">{displayValue}</span>
                              ) : (
                                <span className="text-destructive/60 italic">— não preenchido</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {filled ? (
                                <CheckCircle2 className="h-4 w-4 text-success mx-auto" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-destructive mx-auto" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
