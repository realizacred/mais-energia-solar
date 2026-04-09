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
import { replaceVariables } from "@/lib/variablesCatalog";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";
import { usePropostasParaPreview, buildPropostaContext } from "@/hooks/useTemplatePreview";

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

// buildPropostaContext moved to src/hooks/useTemplatePreview.ts

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  templateHtml,
  templateNome,
  templateId,
  templateTipo = "html",
  fileUrl,
}: TemplatePreviewDialogProps) {
  const [selectedProposta, setSelectedProposta] = useState<PropostaOption | null>(null);
  const [search, setSearch] = useState("");
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  const isDocx = templateTipo === "docx";

  const { data: propostas = [], isLoading: loadingList } = usePropostasParaPreview(open);

  useEffect(() => {
    if (!open) {
      setSelectedProposta(null);
      setRenderedHtml(null);
      setSearch("");
    }
  }, [open]);

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
      // Use raw fetch to preserve binary DOCX data
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "bguhckqkpnziykpbwbeu";
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw";
      const { data: { session } } = await supabase.auth.getSession();
      const rawResp = await fetch(`https://${projectId}.supabase.co/functions/v1/template-preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || anonKey}`,
          "apikey": anonKey,
        },
        body: JSON.stringify({ template_id: templateId, proposta_id: proposta.id }),
      });
      if (!rawResp.ok) {
        const errBody = await rawResp.text();
        let detail = "Erro ao gerar DOCX";
        try { detail = JSON.parse(errBody)?.error || detail; } catch { detail = errBody || detail; }
        throw new Error(detail);
      }
      const blob = await rawResp.blob();
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
      <DialogContent className="w-[90vw] max-w-[950px] max-h-[calc(100dvh-2rem)] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Eye className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              Preview: {templateNome}
              {isDocx && <Badge variant="secondary" className="text-[9px]">DOCX</Badge>}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Selecione uma proposta para visualizar o template com dados reais
            </p>
          </div>
          {propostas.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleShuffle}
              disabled={loading || generating}
              className="gap-1.5 text-xs shrink-0"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Sortear outra
            </Button>
          )}
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
                  style={{ height: "calc(85vh - 140px)" }}
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
