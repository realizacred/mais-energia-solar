import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ExternalLink } from "lucide-react";
import type { SmProposal } from "@/hooks/useSolarMarket";

interface Props {
  proposal: SmProposal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Variable {
  key: string;
  item?: string;
  topic?: string;
  value: any;
  formattedValue?: string;
}

interface PricingItem {
  category?: string;
  item?: string;
  qnt?: number;
  unitCost?: number;
  unitPrice?: number;
  salesValue?: number;
  costValue?: number;
}

function formatValue(v: Variable): string {
  if (v.formattedValue != null && v.formattedValue !== "" && v.formattedValue !== "null") return String(v.formattedValue);
  if (v.value == null || v.value === "undefined" || v.value === "") return "—";
  return String(v.value);
}

function groupByTopic(variables: Variable[]): Record<string, Variable[]> {
  const groups: Record<string, Variable[]> = {};
  for (const v of variables) {
    const topic = v.topic || "Outros";
    if (!groups[topic]) groups[topic] = [];
    groups[topic].push(v);
  }
  return groups;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium text-foreground min-h-[20px]">{value || "—"}</p>
    </div>
  );
}

export function SmProposalDetailDialog({ proposal, open, onOpenChange }: Props) {
  if (!proposal) return null;

  const raw = proposal.raw_payload as any;
  const variables: Variable[] = Array.isArray(raw?.variables) ? raw.variables : [];
  const pricingTable: PricingItem[] = Array.isArray(raw?.pricingTable) ? raw.pricingTable : [];
  const grouped = groupByTopic(variables);
  const topicOrder = ["Entrada de Dados", "Sistema Solar", "Financeiro", "Conta de Energia", "Comercial", "Cliente", "Séries", "Premissas", "Outros"];
  const sortedTopics = Object.keys(grouped).sort((a, b) => {
    const ia = topicOrder.indexOf(a);
    const ib = topicOrder.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">
              {proposal.titulo || `Proposta #${proposal.sm_proposal_id}`}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono">ID {proposal.sm_proposal_id}</Badge>
              {proposal.link_pdf && (
                <a href={proposal.link_pdf} target="_blank" rel="noopener noreferrer">
                  <Badge className="text-[10px] cursor-pointer bg-primary/10 text-primary hover:bg-primary/20">
                    <ExternalLink className="h-3 w-3 mr-1" /> PDF
                  </Badge>
                </a>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Resumo */}
          <div className="space-y-3 mb-5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Potência" value={proposal.potencia_kwp ? `${Number(proposal.potencia_kwp).toFixed(2)} kWp` : null} />
              <Field label="Valor Total" value={proposal.valor_total ? `R$ ${Number(proposal.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null} />
              <Field label="Status" value={proposal.status} />
              <Field label="Módulos" value={proposal.modulos} />
              <Field label="Inversores" value={proposal.inversores} />
              <Field label="Economia Mensal" value={proposal.economia_mensal ? `R$ ${Number(proposal.economia_mensal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null} />
            </div>
          </div>

          {/* Pricing Table */}
          {pricingTable.length > 0 && (
            <div className="mb-5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tabela de Preços</h4>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-2 font-medium text-muted-foreground">Categoria</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Item</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Qtd</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Venda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingTable.map((p, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-2 font-medium">{p.category || "—"}</td>
                        <td className="p-2 text-muted-foreground truncate max-w-[150px]">{p.item || "—"}</td>
                        <td className="p-2 text-right">{p.qnt ?? "—"}</td>
                        <td className="p-2 text-right font-medium">
                          {p.salesValue != null ? `R$ ${Number(p.salesValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Variables grouped by topic */}
          {sortedTopics.length > 0 && (
            <Accordion type="multiple" defaultValue={sortedTopics.slice(0, 2)} className="w-full">
              {sortedTopics.map((topic) => {
                const vars = grouped[topic];
                return (
                  <AccordionItem key={topic} value={topic}>
                    <AccordionTrigger className="text-xs font-semibold py-2">
                      {topic} <Badge variant="secondary" className="ml-2 text-[10px]">{vars.length}</Badge>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 gap-0 text-xs">
                        {vars.map((v, i) => {
                          const display = formatValue(v);
                          return (
                            <div key={`${v.key}-${i}`} className="flex justify-between items-start py-1.5 px-1 border-b border-border/30">
                              <span className="text-muted-foreground truncate mr-3">{v.item || v.key}</span>
                              <span className="text-foreground font-medium text-right truncate max-w-[180px]" title={display}>{display}</span>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}

          {variables.length === 0 && pricingTable.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma variável encontrada no payload desta proposta.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
