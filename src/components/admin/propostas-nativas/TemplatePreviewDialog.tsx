import { useState, useEffect, useMemo } from "react";
import { Eye, Loader2, Search, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateHtml: string;
  templateNome: string;
}

interface LeadOption {
  id: string;
  nome: string;
  telefone: string;
  cidade: string | null;
  estado: string | null;
  media_consumo: number | null;
  valor_estimado: number | null;
}

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  templateHtml,
  templateNome,
}: TemplatePreviewDialogProps) {
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const [search, setSearch] = useState("");
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);

  // Load leads when dialog opens
  useEffect(() => {
    if (!open) {
      setSelectedLead(null);
      setRenderedHtml(null);
      setSearch("");
      return;
    }
    loadLeads();
  }, [open]);

  const loadLeads = async () => {
    setLoadingLeads(true);
    const { data } = await supabase
      .from("leads")
      .select("id, nome, telefone, cidade, estado, media_consumo, valor_estimado")
      .order("created_at", { ascending: false })
      .limit(50);
    setLeads((data as LeadOption[]) || []);
    setLoadingLeads(false);
  };

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.nome.toLowerCase().includes(q) ||
        l.telefone?.includes(q)
    );
  }, [leads, search]);

  const handleSelectLead = async (lead: LeadOption) => {
    setSelectedLead(lead);

    // Fetch additional data for full variable replacement
    let clienteData: Record<string, any> = {};
    const { data: cliente } = await supabase
      .from("clientes")
      .select("nome, telefone, email, cpf_cnpj, cidade, estado, bairro, rua, numero, cep, potencia_kwp, valor_projeto")
      .eq("lead_id", lead.id)
      .maybeSingle();

    if (cliente) clienteData = cliente;

    // Build variable map from real data
    const now = new Date();
    const vars: Record<string, string> = {
      // Cliente
      "cliente.nome": clienteData.nome || lead.nome || "—",
      "cliente.telefone": clienteData.telefone || lead.telefone || "—",
      "cliente.email": clienteData.email || "—",
      "cliente.cpf_cnpj": clienteData.cpf_cnpj || "—",
      "cliente.cidade": clienteData.cidade || lead.cidade || "—",
      "cliente.estado": clienteData.estado || lead.estado || "—",
      "cliente.bairro": clienteData.bairro || "—",
      "cliente.rua": clienteData.rua || "—",
      "cliente.numero": clienteData.numero || "—",
      "cliente.cep": clienteData.cep || "—",
      // Lead data
      "entrada.consumo_medio": String(lead.media_consumo || 0),
      "entrada.potencia_kwp": String(clienteData.potencia_kwp || 0),
      // Financeiro
      "financeiro.valor_total": formatCurrency(lead.valor_estimado || clienteData.valor_projeto || 0),
      // Data
      "comercial.data_proposta": now.toLocaleDateString("pt-BR"),
      "comercial.validade_proposta": new Date(now.getTime() + 15 * 86400000).toLocaleDateString("pt-BR"),
    };

    // Also support legacy [campo] format
    const legacyMap: Record<string, string> = {
      nome_cliente: vars["cliente.nome"],
      telefone_cliente: vars["cliente.telefone"],
      email_cliente: vars["cliente.email"],
      cpf_cnpj: vars["cliente.cpf_cnpj"],
      cidade: vars["cliente.cidade"],
      estado: vars["cliente.estado"],
      consumo_medio: vars["entrada.consumo_medio"],
      potencia_kwp: vars["entrada.potencia_kwp"],
      valor_total: vars["financeiro.valor_total"],
      data_proposta: vars["comercial.data_proposta"],
      validade_proposta: vars["comercial.validade_proposta"],
    };

    // Replace variables in HTML
    let html = templateHtml;

    // Replace {{grupo.campo}} format
    for (const [key, value] of Object.entries(vars)) {
      html = html.replace(new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, "gi"), value);
    }

    // Replace [campo] format
    for (const [key, value] of Object.entries(legacyMap)) {
      html = html.replace(new RegExp(`\\[${escapeRegex(key)}\\]`, "gi"), value);
    }

    // Mark remaining unresolved variables
    html = html.replace(/\{\{[^}]+\}\}/g, (match) => `<span style="background:#fef3c7;color:#92400e;padding:0 4px;border-radius:3px;font-size:0.8em">${match}</span>`);
    html = html.replace(/\[[a-z_]+\]/gi, (match) => `<span style="background:#fef3c7;color:#92400e;padding:0 4px;border-radius:3px;font-size:0.8em">${match}</span>`);

    setRenderedHtml(html);
    toast({ title: `Preview gerado com dados de ${lead.nome}` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Eye className="h-4 w-4 text-secondary" />
            Preview: {templateNome}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Lead selector sidebar */}
          <div className="w-[260px] border-r border-border flex flex-col">
            <div className="px-3 py-2 border-b border-border/50">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Selecione um lead
              </Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="h-7 text-xs pl-7"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {loadingLeads ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLeads.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum lead encontrado</p>
              ) : (
                <div className="p-1.5 space-y-0.5">
                  {filteredLeads.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => handleSelectLead(lead)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg transition-all text-xs ${
                        selectedLead?.id === lead.id
                          ? "bg-secondary/10 border border-secondary/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{lead.nome}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {lead.cidade ? `${lead.cidade}/${lead.estado}` : lead.telefone}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Preview area */}
          <div className="flex-1 flex flex-col min-h-0">
            {!renderedHtml ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <Eye className="h-8 w-8 mx-auto opacity-20" />
                  <p className="text-sm">Selecione um lead para gerar o preview</p>
                  <p className="text-[10px]">As variáveis serão substituídas por dados reais</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0">
                <div className="px-3 py-1.5 border-b border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[9px]">
                      {selectedLead?.nome}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      Variáveis em amarelo = não resolvidas
                    </span>
                  </div>
                </div>
                <iframe
                  srcDoc={renderedHtml}
                  title="Template Preview"
                  className="w-full border-0"
                  style={{ height: "calc(85vh - 140px)", pointerEvents: "none" }}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
