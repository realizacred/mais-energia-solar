import { useState, useEffect, useCallback } from "react";
import { Eye, Loader2, Shuffle, FileDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

interface RandomData {
  leadId: string;
  label: string; // Nome para exibir
  context: Record<string, any>;
}

/**
 * Busca um registro aleatório real do sistema (lead + cliente + projeto)
 * e monta o contexto completo de variáveis usando o SSOT.
 * Nunca retorna o mesmo registro se houver mais de 1 disponível.
 */
async function fetchRandomPreviewData(excludeLeadId?: string): Promise<RandomData | null> {
  // 1. Buscar contagem total de leads para offset aleatório
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true });

  if (!count || count === 0) return null;

  // 2. Offset aleatório — evita repetir o último
  let attempts = 0;
  let lead: any = null;

  while (attempts < 5) {
    const offset = Math.floor(Math.random() * count);
    const { data } = await supabase
      .from("leads")
      .select("id, nome, telefone, cidade, estado, media_consumo, valor_estimado, consultor_id, created_at")
      .range(offset, offset)
      .limit(1)
      .maybeSingle();

    if (data && data.id !== excludeLeadId) {
      lead = data;
      break;
    }
    attempts++;
  }

  if (!lead) {
    // Fallback: pegar qualquer um
    const { data } = await supabase
      .from("leads")
      .select("id, nome, telefone, cidade, estado, media_consumo, valor_estimado, consultor_id, created_at")
      .limit(1)
      .maybeSingle();
    lead = data;
  }

  if (!lead) return null;

  // 3. Buscar cliente vinculado (se existir)
  const { data: cliente } = await supabase
    .from("clientes")
    .select("nome, telefone, email, cpf_cnpj, cidade, estado, bairro, rua, numero, cep, complemento, empresa, potencia_kwp, valor_projeto, numero_placas, modelo_inversor, data_nascimento")
    .eq("lead_id", lead.id)
    .maybeSingle();

  // 4. Buscar projeto vinculado (se existir)
  const { data: projeto } = await supabase
    .from("projetos")
    .select("id, codigo, status, potencia_kwp, valor_total, numero_modulos, modelo_inversor, modelo_modulos, data_instalacao")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 5. Buscar consultor (se existir)
  let consultor: any = null;
  if (lead.consultor_id) {
    const { data } = await supabase
      .from("consultores")
      .select("nome, telefone, email, codigo")
      .eq("id", lead.consultor_id)
      .maybeSingle();
    consultor = data;
  }

  // 6. Montar contexto completo
  const now = new Date();
  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const ctx: Record<string, any> = {};
  const set = (canonical: string, legacy: string, value: any) => {
    if (value !== undefined && value !== null && value !== "") {
      ctx[canonical] = String(value);
      ctx[legacy] = String(value);
    }
  };

  // ── Cliente ──
  set("cliente.nome", "cliente_nome", cliente?.nome || lead.nome);
  set("cliente.celular", "cliente_celular", cliente?.telefone || lead.telefone);
  set("cliente.email", "cliente_email", cliente?.email);
  set("cliente.cnpj_cpf", "cliente_cnpj_cpf", cliente?.cpf_cnpj);
  set("cliente.empresa", "cliente_empresa", cliente?.empresa);
  set("cliente.cep", "cliente_cep", cliente?.cep);
  set("cliente.endereco", "cliente_endereco", cliente?.rua);
  set("cliente.numero", "cliente_numero", cliente?.numero);
  set("cliente.complemento", "cliente_complemento", cliente?.complemento);
  set("cliente.bairro", "cliente_bairro", cliente?.bairro);
  set("cliente.cidade", "cliente_cidade", cliente?.cidade || lead.cidade);
  set("cliente.estado", "cliente_estado", cliente?.estado || lead.estado);

  // ── Entrada ──
  set("entrada.consumo_mensal", "consumo_mensal", lead.media_consumo);
  set("entrada.cidade", "cidade", cliente?.cidade || lead.cidade);
  set("entrada.estado", "estado", cliente?.estado || lead.estado);

  // ── Sistema Solar ──
  const potencia = projeto?.potencia_kwp || cliente?.potencia_kwp;
  set("sistema_solar.potencia_sistema", "potencia_sistema", potencia);
  set("sistema_solar.modulo_quantidade", "modulo_quantidade", projeto?.numero_modulos || cliente?.numero_placas);
  set("sistema_solar.inversor_modelo", "inversor_modelo", projeto?.modelo_inversor || cliente?.modelo_inversor);
  set("sistema_solar.modulo_modelo", "modulo_modelo", projeto?.modelo_modulos);

  // ── Financeiro ──
  const valorTotal = projeto?.valor_total || lead.valor_estimado || cliente?.valor_projeto;
  if (valorTotal) {
    set("financeiro.valor_total", "valor_total", fmtCurrency(valorTotal));
    set("financeiro.preco_final", "preco_final", fmtCurrency(valorTotal));
    set("financeiro.preco_total", "preco_total", fmtCurrency(valorTotal));
  }

  // ── Comercial ──
  set("comercial.proposta_data", "proposta_data", now.toLocaleDateString("pt-BR"));
  set("comercial.proposta_validade", "proposta_validade",
    new Date(now.getTime() + 15 * 86400000).toLocaleDateString("pt-BR"));
  if (consultor) {
    set("comercial.consultor_nome", "consultor_nome", consultor.nome);
    set("comercial.consultor_telefone", "consultor_telefone", consultor.telefone);
    set("comercial.consultor_email", "consultor_email", consultor.email);
  }

  // ── Preencher variáveis do catálogo que não têm dados reais com os examples ──
  for (const v of VARIABLES_CATALOG) {
    if (v.isSeries || v.notImplemented) continue;
    const canonicalBare = v.canonicalKey.replace(/^\{\{|\}\}$/g, "");
    const legacyBare = v.legacyKey.replace(/^\[|\]$/g, "");
    if (!(canonicalBare in ctx)) ctx[canonicalBare] = v.example;
    if (!(legacyBare in ctx)) ctx[legacyBare] = v.example;
  }

  return {
    leadId: lead.id,
    label: cliente?.nome || lead.nome || "Lead sem nome",
    context: ctx,
  };
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
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [randomData, setRandomData] = useState<RandomData | null>(null);
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);

  const isDocx = templateTipo === "docx";

  // Auto-load random data when dialog opens
  useEffect(() => {
    if (!open) {
      setRandomData(null);
      setRenderedHtml(null);
      return;
    }
    loadRandomAndPreview();
  }, [open]);

  const loadRandomAndPreview = useCallback(async (excludeId?: string) => {
    setLoading(true);
    try {
      const data = await fetchRandomPreviewData(excludeId);
      if (!data) {
        toast({ title: "Nenhum lead encontrado no sistema", variant: "destructive" });
        setLoading(false);
        return;
      }
      setRandomData(data);

      if (isDocx) {
        await handleDocxPreview(data);
      } else {
        handleHtmlPreview(data);
      }
    } catch (err: any) {
      console.error("[Preview]", err);
      toast({ title: "Erro ao carregar preview", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [isDocx, templateHtml, templateId]);

  const handleShuffle = () => {
    loadRandomAndPreview(randomData?.leadId);
  };

  const handleHtmlPreview = (data: RandomData) => {
    if (!templateHtml) return;

    let html = replaceVariables(templateHtml, data.context);

    // Highlight unresolved variables
    html = html.replace(/\{\{[^}]+\}\}/g, (match) =>
      `<span style="background:#fef3c7;color:#92400e;padding:0 4px;border-radius:3px;font-size:0.8em">${match}</span>`
    );
    html = html.replace(/\[[a-z_0-9]+\]/gi, (match) =>
      `<span style="background:#fef3c7;color:#92400e;padding:0 4px;border-radius:3px;font-size:0.8em">${match}</span>`
    );

    setRenderedHtml(html);
  };

  const handleDocxPreview = async (data: RandomData) => {
    if (!templateId) return;
    setGenerating(true);
    try {
      const response = await supabase.functions.invoke("template-preview", {
        body: { template_id: templateId, lead_id: data.leadId },
      });

      if (response.error) throw new Error(response.error.message || "Erro ao gerar DOCX");

      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `preview_${templateNome.replace(/[^a-zA-Z0-9]/g, "_")}_${data.label.replace(/[^a-zA-Z0-9]/g, "_")}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: `DOCX gerado com dados de ${data.label}`, description: "Download iniciado!" });
    } catch (err: any) {
      console.error("[DOCX Preview]", err);
      toast({ title: "Erro ao gerar preview DOCX", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {isDocx ? <FileDown className="h-4 w-4 text-secondary" /> : <Eye className="h-4 w-4 text-secondary" />}
              Preview: {templateNome}
              {isDocx && <Badge variant="secondary" className="text-[9px]">DOCX</Badge>}
            </DialogTitle>

            <div className="flex items-center gap-2">
              {randomData && (
                <Badge variant="outline" className="text-[10px] font-normal">
                  Dados de: {randomData.label}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleShuffle}
                disabled={loading || generating}
                className="gap-1.5 text-xs"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Sortear outro
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-secondary" />
                <p className="text-sm text-muted-foreground">Buscando dados aleatórios reais...</p>
              </div>
            </div>
          ) : isDocx ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="text-center space-y-3 px-8">
                {generating ? (
                  <>
                    <Loader2 className="h-10 w-10 mx-auto animate-spin text-secondary" />
                    <p className="text-sm font-medium text-foreground">Gerando DOCX com dados reais...</p>
                  </>
                ) : randomData ? (
                  <>
                    <Download className="h-10 w-10 mx-auto text-success opacity-70" />
                    <p className="text-sm font-medium text-foreground">Download iniciado!</p>
                    <p className="text-[11px] text-muted-foreground">
                      DOCX gerado com dados de <strong>{randomData.label}</strong>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Clique em "Sortear outro" para gerar com dados diferentes
                    </p>
                  </>
                ) : (
                  <>
                    <FileDown className="h-10 w-10 mx-auto opacity-20" />
                    <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
                  </>
                )}
              </div>
            </div>
          ) : renderedHtml ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="px-3 py-1.5 border-b border-border/50 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  Variáveis em amarelo = não resolvidas
                </span>
              </div>
              <iframe
                srcDoc={renderedHtml}
                title="Template Preview"
                className="w-full flex-1 border-0"
                style={{ height: "calc(85vh - 140px)", pointerEvents: "none" }}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="text-center space-y-2">
                <Eye className="h-8 w-8 mx-auto opacity-20" />
                <p className="text-sm text-muted-foreground">Nenhum dado disponível para preview</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
