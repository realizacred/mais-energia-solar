import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ExternalLink } from "lucide-react";
import type { SmProposal } from "@/hooks/useSolarMarket";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  proposal: SmProposal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium text-foreground min-h-[20px]">{value || "—"}</p>
    </div>
  );
}

function currency(v: number | null | undefined): string | null {
  if (v == null) return null;
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function pct(v: number | null | undefined): string | null {
  if (v == null) return null;
  return `${Number(v).toFixed(2)}%`;
}

function fmtDate(v: string | null | undefined): string | null {
  if (!v) return null;
  try { return format(new Date(v), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return v; }
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

function formatVarValue(v: Variable): string {
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

  // Extract client/project info from raw payload
  const client = raw?.client || raw?.cliente || {};
  const project = raw?.project || raw?.projeto || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col p-0">
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

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* ── Resumo ── */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resumo</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Potência" value={proposal.potencia_kwp ? `${Number(proposal.potencia_kwp).toFixed(2)} kWp` : null} />
              <Field label="Valor Total" value={currency(proposal.valor_total)} />
              <Field label="Status" value={proposal.status} />
              <Field label="Fase" value={proposal.fase} />
              <Field label="Tipo Dimensionamento" value={proposal.tipo_dimensionamento} />
              <Field label="Descrição" value={proposal.description} />
            </div>
          </section>

          {/* ── Cliente ── */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cliente</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Nome" value={client.name || client.nome || null} />
              <Field label="E-mail" value={client.email || null} />
              <Field label="Telefone" value={client.phone || client.telefone || client.cellphone || null} />
              <Field label="CPF/CNPJ" value={client.cpf || client.cnpj || client.document || null} />
              <Field label="Cidade" value={proposal.cidade || client.city || client.cidade || null} />
              <Field label="Estado" value={proposal.estado || client.state || client.estado || null} />
              <Field label="Endereço" value={client.address || client.endereco || null} />
            </div>
          </section>

          {/* ── Kit / Equipamentos ── */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Kit / Equipamentos</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Módulos" value={proposal.modulos} />
              <Field label="Qtd Módulos" value={proposal.panel_quantity?.toString()} />
              <Field label="Modelo Módulo" value={proposal.panel_model} />
              <Field label="Inversores" value={proposal.inversores} />
              <Field label="Qtd Inversores" value={proposal.inverter_quantity?.toString()} />
              <Field label="Modelo Inversor" value={proposal.inverter_model} />
              <Field label="Tipo Telhado" value={proposal.roof_type} />
              <Field label="Tipo Estrutura" value={proposal.structure_type} />
              <Field label="Garantia" value={proposal.warranty} />
            </div>
          </section>

          {/* ── Financeiro ── */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financeiro</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Preço Total" value={currency(proposal.preco_total)} />
              <Field label="Custo Equipamento" value={currency(proposal.equipment_cost)} />
              <Field label="Custo Instalação" value={currency(proposal.installation_cost)} />
              <Field label="Desconto" value={currency(proposal.discount)} />
              <Field label="Economia Mensal" value={currency(proposal.economia_mensal)} />
              <Field label="Economia %" value={pct(proposal.economia_mensal_percent)} />
              <Field label="Payback" value={proposal.payback} />
              <Field label="VPL" value={currency(proposal.vpl)} />
              <Field label="TIR" value={pct(proposal.tir)} />
              <Field label="Cond. Pagamento" value={proposal.payment_conditions} />
            </div>
          </section>

          {/* ── Energia ── */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Energia</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Consumo Mensal" value={proposal.consumo_mensal ? `${proposal.consumo_mensal} kWh` : null} />
              <Field label="Geração Anual" value={proposal.geracao_anual ? `${proposal.geracao_anual} kWh` : null} />
              <Field label="Geração Energia" value={proposal.energy_generation ? `${proposal.energy_generation} kWh` : null} />
              <Field label="Tarifa Distribuidora" value={currency(proposal.tarifa_distribuidora)} />
              <Field label="Distribuidora" value={proposal.dis_energia} />
              <Field label="Custo Disponibilidade" value={currency(proposal.custo_disponibilidade)} />
              <Field label="Inflação Energética" value={pct(proposal.inflacao_energetica)} />
              <Field label="Perda Eficiência/Ano" value={pct(proposal.perda_eficiencia_anual)} />
              <Field label="Sobredimensionamento" value={pct(proposal.sobredimensionamento)} />
            </div>
          </section>

          {/* ── Datas ── */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Datas</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Gerada em" value={fmtDate(proposal.generated_at)} />
              <Field label="Enviada em" value={fmtDate(proposal.send_at)} />
              <Field label="Visualizada em" value={fmtDate(proposal.viewed_at)} />
              <Field label="Aceita em" value={fmtDate(proposal.acceptance_date)} />
              <Field label="Rejeitada em" value={fmtDate(proposal.rejection_date)} />
              <Field label="Válida até" value={fmtDate(proposal.valid_until)} />
              <Field label="Criada (SM)" value={fmtDate(proposal.sm_created_at)} />
              <Field label="Atualizada (SM)" value={fmtDate(proposal.sm_updated_at)} />
            </div>
          </section>

          {/* ── Pricing Table ── */}
          {pricingTable.length > 0 && (
            <section>
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
                        <td className="p-2 text-muted-foreground">{p.item || "—"}</td>
                        <td className="p-2 text-right">{p.qnt ?? "—"}</td>
                        <td className="p-2 text-right font-medium">
                          {p.salesValue != null ? currency(p.salesValue) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Variables (do payload) ── */}
          {sortedTopics.length > 0 && (
            <Accordion type="multiple" defaultValue={sortedTopics.slice(0, 3)} className="w-full">
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
                          const display = formatVarValue(v);
                          return (
                            <div key={`${v.key}-${i}`} className="flex justify-between items-start py-1.5 px-1 border-b border-border/30">
                              <span className="text-muted-foreground truncate mr-3">{v.item || v.key}</span>
                              <span className="text-foreground font-medium text-right truncate max-w-[220px]" title={display}>{display}</span>
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
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma variável extra encontrada no payload.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
