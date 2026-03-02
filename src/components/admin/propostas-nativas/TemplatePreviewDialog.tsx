import { useState, useEffect, useMemo, useCallback } from "react";
import { Eye, Loader2, Search, Shuffle, FileDown, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VARIABLES_CATALOG, replaceVariables } from "@/lib/variablesCatalog";

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateHtml?: string | null;
  templateNome: string;
  templateId?: string;
  templateTipo?: "html" | "docx";
  fileUrl?: string | null;
}

interface PropostaOption {
  id: string;
  titulo: string;
  codigo: string | null;
  status: string;
  lead_id: string | null;
  cliente_id: string | null;
  consultor_id: string | null;
  projeto_id: string | null;
}

/**
 * Busca dados completos de uma proposta (lead + cliente + projeto + consultor + versão/snapshot)
 * e monta o contexto de variáveis usando o SSOT.
 */
async function buildPropostaContext(proposta: PropostaOption): Promise<Record<string, any>> {
  const ctx: Record<string, any> = {};
  const set = (canonical: string, legacy: string, value: any) => {
    if (value !== undefined && value !== null && value !== "") {
      ctx[canonical] = String(value);
      ctx[legacy] = String(value);
    }
  };

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const now = new Date();

  // Fetch all related data in parallel
  const [leadRes, clienteRes, projetoRes, consultorRes, versaoRes] = await Promise.all([
    proposta.lead_id
      ? supabase.from("leads").select("nome, telefone, cidade, estado, media_consumo, valor_estimado, tipo_telhado, rede_atendimento, area").eq("id", proposta.lead_id).maybeSingle()
      : Promise.resolve({ data: null }),
    proposta.cliente_id
      ? supabase.from("clientes").select("nome, telefone, email, cpf_cnpj, cidade, estado, bairro, rua, numero, cep, complemento, empresa, potencia_kwp, valor_projeto, numero_placas, modelo_inversor, data_nascimento").eq("id", proposta.cliente_id).maybeSingle()
      : Promise.resolve({ data: null }),
    proposta.projeto_id
      ? supabase.from("projetos").select("codigo, status, potencia_kwp, valor_total, numero_modulos, modelo_inversor, modelo_modulos, data_instalacao, geracao_mensal_media_kwh, tipo_instalacao, forma_pagamento").eq("id", proposta.projeto_id).maybeSingle()
      : Promise.resolve({ data: null }),
    proposta.consultor_id
      ? supabase.from("consultores").select("nome, telefone, email, codigo").eq("id", proposta.consultor_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Buscar versão mais recente com snapshot
    supabase.from("proposta_versoes")
      .select("snapshot, valor_total, potencia_kwp, economia_mensal, payback_meses, validade_dias, versao_numero")
      .eq("proposta_id", proposta.id)
      .order("versao_numero", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lead = leadRes.data as any;
  const cliente = clienteRes.data as any;
  const projeto = projetoRes.data as any;
  const consultor = consultorRes.data as any;
  const versao = versaoRes.data as any;

  // Se tiver snapshot, ele é a fonte primária (contém todos os cálculos)
  const snapshot = versao?.snapshot as Record<string, any> | null;
  if (snapshot && typeof snapshot === "object") {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value !== null && value !== undefined && value !== "") {
        ctx[key] = String(value);
      }
    }
  }

  // ── Cliente ──
  set("cliente.nome", "cliente_nome", cliente?.nome || lead?.nome);
  set("cliente.celular", "cliente_celular", cliente?.telefone || lead?.telefone);
  set("cliente.email", "cliente_email", cliente?.email);
  set("cliente.cnpj_cpf", "cliente_cnpj_cpf", cliente?.cpf_cnpj);
  set("cliente.empresa", "cliente_empresa", cliente?.empresa);
  set("cliente.cep", "cliente_cep", cliente?.cep);
  set("cliente.endereco", "cliente_endereco", cliente?.rua);
  set("cliente.numero", "cliente_numero", cliente?.numero);
  set("cliente.complemento", "cliente_complemento", cliente?.complemento);
  set("cliente.bairro", "cliente_bairro", cliente?.bairro);
  set("cliente.cidade", "cliente_cidade", cliente?.cidade || lead?.cidade);
  set("cliente.estado", "cliente_estado", cliente?.estado || lead?.estado);

  // ── Entrada ──
  set("entrada.consumo_mensal", "consumo_mensal", lead?.media_consumo);
  set("entrada.cidade", "cidade", cliente?.cidade || lead?.cidade);
  set("entrada.estado", "estado", cliente?.estado || lead?.estado);
  set("entrada.tipo_telhado", "tipo_telhado", lead?.tipo_telhado);
  set("entrada.fase", "fase", lead?.rede_atendimento);

  // ── Sistema Solar ──
  const potencia = versao?.potencia_kwp || projeto?.potencia_kwp || cliente?.potencia_kwp;
  set("sistema_solar.potencia_sistema", "potencia_sistema", potencia);
  set("sistema_solar.modulo_quantidade", "modulo_quantidade", projeto?.numero_modulos || cliente?.numero_placas);
  set("sistema_solar.inversor_modelo", "inversor_modelo", projeto?.modelo_inversor || cliente?.modelo_inversor);
  set("sistema_solar.modulo_modelo", "modulo_modelo", projeto?.modelo_modulos);
  set("sistema_solar.geracao_mensal", "geracao_mensal", projeto?.geracao_mensal_media_kwh);

  // ── Financeiro ──
  const valorTotal = versao?.valor_total || projeto?.valor_total || lead?.valor_estimado || cliente?.valor_projeto;
  if (valorTotal) {
    set("financeiro.valor_total", "valor_total", fmtCurrency(valorTotal));
    set("financeiro.preco_final", "preco_final", fmtCurrency(valorTotal));
    set("financeiro.preco_total", "preco_total", fmtCurrency(valorTotal));
  }
  if (versao?.economia_mensal) {
    set("financeiro.economia_mensal", "economia_mensal", fmtCurrency(versao.economia_mensal));
  }
  if (versao?.payback_meses) {
    set("financeiro.payback_meses", "payback_meses", String(versao.payback_meses));
  }

  // ── Comercial ──
  set("comercial.proposta_data", "proposta_data", now.toLocaleDateString("pt-BR"));
  set("comercial.proposta_codigo", "proposta_codigo", proposta.codigo);
  const validadeDias = versao?.validade_dias || 15;
  set("comercial.proposta_validade", "proposta_validade",
    new Date(now.getTime() + validadeDias * 86400000).toLocaleDateString("pt-BR"));
  if (consultor) {
    set("comercial.consultor_nome", "consultor_nome", consultor.nome);
    set("comercial.consultor_telefone", "consultor_telefone", consultor.telefone);
    set("comercial.consultor_email", "consultor_email", consultor.email);
  }

  // ── Preencher variáveis do catálogo não preenchidas com examples ──
  for (const v of VARIABLES_CATALOG) {
    if (v.isSeries || v.notImplemented) continue;
    const canonicalBare = v.canonicalKey.replace(/^\{\{|\}\}$/g, "");
    const legacyBare = v.legacyKey.replace(/^\[|\]$/g, "");
    if (!(canonicalBare in ctx)) ctx[canonicalBare] = v.example;
    if (!(legacyBare in ctx)) ctx[legacyBare] = v.example;
  }

  return ctx;
}

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  templateHtml,
  templateNome,
  templateId,
  templateTipo = "html",
  fileUrl,
}: TemplatePreviewDialogProps) {
  const [propostas, setPropostas] = useState<PropostaOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedProposta, setSelectedProposta] = useState<PropostaOption | null>(null);
  const [search, setSearch] = useState("");
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  const isDocx = templateTipo === "docx";

  useEffect(() => {
    if (!open) {
      setSelectedProposta(null);
      setRenderedHtml(null);
      setSearch("");
      setPropostas([]);
      return;
    }
    loadPropostas();
  }, [open]);

  const loadPropostas = async () => {
    setLoadingList(true);
    const { data } = await supabase
      .from("propostas_nativas")
      .select("id, titulo, codigo, status, lead_id, cliente_id, consultor_id, projeto_id")
      .order("created_at", { ascending: false })
      .limit(100);
    setPropostas((data as PropostaOption[]) || []);
    setLoadingList(false);
  };

  const filteredPropostas = useMemo(() => {
    if (!search.trim()) return propostas;
    const q = search.toLowerCase();
    return propostas.filter(
      (p) =>
        p.titulo.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q)
    );
  }, [propostas, search]);

  const handleSelectProposta = async (proposta: PropostaOption) => {
    setSelectedProposta(proposta);
    setLoading(true);
    try {
      const context = await buildPropostaContext(proposta);
      if (isDocx) {
        await handleDocxPreview(proposta, context);
      } else {
        handleHtmlPreview(context);
      }
    } catch (err: any) {
      console.error("[Preview]", err);
      toast({ title: "Erro ao gerar preview", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleShuffle = () => {
    if (propostas.length <= 1) return;
    const filtered = propostas.filter((p) => p.id !== selectedProposta?.id);
    const random = filtered[Math.floor(Math.random() * filtered.length)];
    handleSelectProposta(random);
  };

  const handleHtmlPreview = (context: Record<string, any>) => {
    if (!templateHtml) return;
    let html = replaceVariables(templateHtml, context);
    html = html.replace(/\{\{[^}]+\}\}/g, (match) =>
      `<span style="background:#fef3c7;color:#92400e;padding:0 4px;border-radius:3px;font-size:0.8em">${match}</span>`
    );
    html = html.replace(/\[[a-z_0-9]+\]/gi, (match) =>
      `<span style="background:#fef3c7;color:#92400e;padding:0 4px;border-radius:3px;font-size:0.8em">${match}</span>`
    );
    setRenderedHtml(html);
    toast({ title: `Preview gerado` });
  };

  const handleDocxPreview = async (proposta: PropostaOption, _context: Record<string, any>) => {
    if (!templateId) return;
    setGenerating(true);
    try {
      const response = await supabase.functions.invoke("template-preview", {
        body: { template_id: templateId, proposta_id: proposta.id },
      });
      if (response.error) {
        // Try to extract detailed error from the response body
        let detail = response.error.message || "Erro ao gerar DOCX";
        try {
          if (response.data && typeof response.data === "object" && response.data.error) {
            detail = response.data.error;
          }
        } catch { /* ignore */ }
        throw new Error(detail);
      }

      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `preview_${templateNome.replace(/[^a-zA-Z0-9]/g, "_")}_${proposta.codigo || proposta.titulo}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: `DOCX gerado`, description: `Proposta: ${proposta.titulo}` });
    } catch (err: any) {
      console.error("[DOCX Preview]", err);
      toast({ title: "Erro ao gerar preview DOCX", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "aceita": return "bg-success/10 text-success";
      case "enviada": return "bg-info/10 text-info";
      case "rascunho": return "bg-muted text-muted-foreground";
      case "recusada": return "bg-destructive/10 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[950px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {isDocx ? <FileDown className="h-4 w-4 text-secondary" /> : <Eye className="h-4 w-4 text-secondary" />}
              Preview: {templateNome}
              {isDocx && <Badge variant="secondary" className="text-[9px]">DOCX</Badge>}
            </DialogTitle>
            {propostas.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleShuffle}
                disabled={loading || generating}
                className="gap-1.5 text-xs"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Sortear outra
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Proposal selector sidebar */}
          <div className="w-[280px] border-r border-border flex flex-col">
            <div className="px-3 py-2 border-b border-border/50">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Selecione uma Proposta
              </Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar proposta..."
                  className="h-7 text-xs pl-7"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {loadingList ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPropostas.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma proposta encontrada</p>
              ) : (
                <div className="p-1.5 space-y-0.5">
                  {filteredPropostas.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProposta(p)}
                      disabled={loading || generating}
                      className={`w-full text-left px-2.5 py-2 rounded-lg transition-all text-xs ${
                        selectedProposta?.id === p.id
                          ? "bg-secondary/10 border border-secondary/30"
                          : "hover:bg-muted/50"
                      } ${loading || generating ? "opacity-50 cursor-wait" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{p.titulo}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {p.codigo && (
                              <span className="text-[10px] text-muted-foreground font-mono">{p.codigo}</span>
                            )}
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${statusColor(p.status)}`}>
                              {p.status}
                            </span>
                          </div>
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
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-secondary" />
                  <p className="text-sm text-muted-foreground">Carregando dados da proposta...</p>
                </div>
              </div>
            ) : isDocx ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3 px-8">
                  {generating ? (
                    <>
                      <Loader2 className="h-10 w-10 mx-auto animate-spin text-secondary" />
                      <p className="text-sm font-medium text-foreground">Gerando DOCX com dados reais...</p>
                    </>
                  ) : selectedProposta ? (
                    <>
                      <Download className="h-10 w-10 mx-auto text-success opacity-70" />
                      <p className="text-sm font-medium text-foreground">Download iniciado!</p>
                      <p className="text-[11px] text-muted-foreground">
                        Proposta: <strong>{selectedProposta.titulo}</strong>
                      </p>
                    </>
                  ) : (
                    <>
                      <FileDown className="h-10 w-10 mx-auto opacity-20" />
                      <p className="text-sm text-muted-foreground">Selecione uma proposta para gerar o preview</p>
                    </>
                  )}
                </div>
              </div>
            ) : renderedHtml ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-3 py-1.5 border-b border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">
                      {selectedProposta?.titulo}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      Variáveis em amarelo = não resolvidas
                    </span>
                  </div>
                </div>
                <iframe
                  srcDoc={renderedHtml}
                  title="Template Preview"
                  className="w-full flex-1 border-0"
                  style={{ height: "calc(85vh - 140px)", pointerEvents: "none" }}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Eye className="h-8 w-8 mx-auto opacity-20" />
                  <p className="text-sm text-muted-foreground">Selecione uma proposta para visualizar o preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
