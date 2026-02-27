import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  if (v.formattedValue != null && v.formattedValue !== "" && v.formattedValue !== "null") {
    return String(v.formattedValue);
  }
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

export function SmProposalDetailDialog({ proposal, open, onOpenChange }: Props) {
  if (!proposal) return null;

  const raw = proposal.raw_payload as any;
  const variables: Variable[] = Array.isArray(raw?.variables) ? raw.variables : [];
  const pricingTable: PricingItem[] = Array.isArray(raw?.pricingTable) ? raw.pricingTable : [];
  const grouped = groupByTopic(variables);
  const topicOrder = [
    "Entrada de Dados",
    "Sistema Solar",
    "Financeiro",
    "Conta de Energia",
    "Comercial",
    "Cliente",
    "Séries",
    "Premissas",
    "Outros",
  ];
  const sortedTopics = Object.keys(grouped).sort((a, b) => {
    const ia = topicOrder.indexOf(a);
    const ib = topicOrder.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  // Top-level raw fields (excluding variables and pricingTable)
  const topFields: Record<string, any> = {};
  if (raw) {
    for (const [k, v] of Object.entries(raw)) {
      if (k === "variables" || k === "pricingTable" || k === "raw_payload") continue;
      topFields[k] = v;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            Proposta: {proposal.titulo || `#${proposal.sm_proposal_id}`}
            <Badge variant="outline" className="text-xs font-mono ml-2">ID {proposal.sm_proposal_id}</Badge>
            {proposal.link_pdf && (
              <a href={proposal.link_pdf} target="_blank" rel="noopener noreferrer" className="ml-auto">
                <Badge className="text-xs cursor-pointer bg-primary/10 text-primary hover:bg-primary/20">
                  <ExternalLink className="h-3 w-3 mr-1" /> PDF
                </Badge>
              </a>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          {/* Pricing Table */}
          {pricingTable.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Tabela de Preços ({pricingTable.length} itens)</h3>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-2 font-medium text-muted-foreground">Categoria</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Item</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Qtd</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Custo Unit.</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Preço Unit.</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Custo Total</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Venda Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingTable.map((p, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/10">
                        <td className="p-2 font-medium text-foreground">{p.category || "—"}</td>
                        <td className="p-2 text-muted-foreground max-w-[200px] truncate">{p.item || "—"}</td>
                        <td className="p-2 text-right">{p.qnt ?? "—"}</td>
                        <td className="p-2 text-right text-muted-foreground">
                          {p.unitCost != null ? `R$ ${Number(p.unitCost).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="p-2 text-right text-muted-foreground">
                          {p.unitPrice != null ? `R$ ${Number(p.unitPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="p-2 text-right text-muted-foreground">
                          {p.costValue != null ? `R$ ${Number(p.costValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="p-2 text-right font-medium text-foreground">
                          {p.salesValue != null ? `R$ ${Number(p.salesValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top-level fields */}
          {Object.keys(topFields).length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Dados Gerais</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {Object.entries(topFields).map(([k, v]) => {
                  if (v == null || v === "") return null;
                  const display = typeof v === "object" ? JSON.stringify(v) : String(v);
                  if (display.length > 200) return null; // skip huge objects
                  return (
                    <div key={k} className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-mono truncate mr-2">{k}</span>
                      <span className="text-foreground text-right truncate max-w-[200px]">{display}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Variables grouped by topic */}
          {sortedTopics.length > 0 && (
            <Accordion type="multiple" defaultValue={sortedTopics.slice(0, 3)} className="w-full">
              {sortedTopics.map((topic) => {
                const vars = grouped[topic];
                return (
                  <AccordionItem key={topic} value={topic}>
                    <AccordionTrigger className="text-sm font-semibold py-2">
                      {topic} <Badge variant="secondary" className="ml-2 text-[10px]">{vars.length}</Badge>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 gap-0 text-xs">
                        {vars.map((v, i) => {
                          const display = formatValue(v);
                          const isLongArray = display.startsWith("[") && display.length > 80;
                          return (
                            <div
                              key={`${v.key}-${i}`}
                              className="flex justify-between items-start py-1.5 px-1 border-b border-border/30 hover:bg-muted/20"
                            >
                              <div className="flex-1 min-w-0 mr-3">
                                <span className="text-muted-foreground">{v.item || v.key}</span>
                                <span className="text-muted-foreground/50 ml-1 font-mono text-[10px]">({v.key})</span>
                              </div>
                              <span
                                className={`text-foreground font-medium text-right shrink-0 ${isLongArray ? "max-w-[250px] break-all text-[10px] leading-tight" : "max-w-[200px] truncate"}`}
                                title={display}
                              >
                                {display}
                              </span>
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
