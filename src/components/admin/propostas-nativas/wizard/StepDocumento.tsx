import { useState, useEffect } from "react";
import { FileText, Sun, Zap, Plus, Loader2, Globe, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "./types";

interface PropostaTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  grupo: string;
  categoria: string;
  tipo: string;
  thumbnail_url: string | null;
}

interface StepDocumentoProps {
  clienteNome: string;
  potenciaKwp: number;
  numUcs: number;
  precoFinal: number;
  templateSelecionado: string;
  onTemplateSelecionado: (id: string) => void;
  generating: boolean;
  rendering: boolean;
  result: any;
  htmlPreview: string | null;
  onGenerate: () => void;
  onNewVersion: () => void;
  onViewDetail: () => void;
}

export function StepDocumento({
  clienteNome, potenciaKwp, numUcs, precoFinal,
  templateSelecionado, onTemplateSelecionado,
  generating, rendering, result, htmlPreview,
  onGenerate, onNewVersion, onViewDetail,
}: StepDocumentoProps) {
  const [templates, setTemplates] = useState<PropostaTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [tipoFiltro, setTipoFiltro] = useState<"html" | "docx">("html");

  const filteredTemplates = templates.filter(t => t.tipo === tipoFiltro);

  useEffect(() => {
    setLoadingTemplates(true);
    supabase
      .from("proposta_templates")
      .select("id, nome, descricao, grupo, categoria, tipo, thumbnail_url")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .then(({ data }) => {
        const tpls = (data || []) as PropostaTemplate[];
        setTemplates(tpls);
        // Auto-select first template matching current filter
        const matching = tpls.filter(t => t.tipo === tipoFiltro);
        if (matching.length > 0 && !templateSelecionado) {
          onTemplateSelecionado(matching[0].id);
        }
        setLoadingTemplates(false);
      });
  }, []);

  if (!result) {
    return (
      <div className="space-y-6">
        <h3 className="text-base font-bold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Gerar Proposta
        </h3>

        {/* Tipo Toggle */}
        <div className="space-y-3">
          <Label>Tipo de Modelo</Label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTipoFiltro("html");
                // Auto-select first of new filter
                const match = templates.find(t => t.tipo === "html");
                if (match) onTemplateSelecionado(match.id);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                tipoFiltro === "html"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-border/70"
              )}
            >
              <Globe className="h-4 w-4" />
              WEB
              <Badge variant="secondary" className="text-[9px] ml-1">
                {templates.filter(t => t.tipo === "html").length}
              </Badge>
            </button>
            <button
              onClick={() => {
                setTipoFiltro("docx");
                const match = templates.find(t => t.tipo === "docx");
                if (match) onTemplateSelecionado(match.id);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                tipoFiltro === "docx"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-border/70"
              )}
            >
              <FileDown className="h-4 w-4" />
              DOCX
              <Badge variant="secondary" className="text-[9px] ml-1">
                {templates.filter(t => t.tipo === "docx").length}
              </Badge>
            </button>
          </div>
        </div>

        {/* Template Selection */}
        <div className="space-y-2">
          <Label>Template</Label>
          {loadingTemplates ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => onTemplateSelecionado(t.id)}
                  className={cn(
                    "p-4 rounded-xl border-2 text-center transition-all",
                    templateSelecionado === t.id
                      ? "border-primary bg-primary/5"
                      : "border-border/40 hover:border-border/70"
                  )}
                >
                  {t.thumbnail_url ? (
                    <img src={t.thumbnail_url} alt={t.nome} className="h-10 w-10 mx-auto mb-2 rounded object-cover" />
                  ) : (
                    <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  )}
                  <p className="text-sm font-medium">{t.nome}</p>
                  {t.descricao && <p className="text-[10px] text-muted-foreground mt-0.5">{t.descricao}</p>}
                  <Badge variant="outline" className="text-[9px] mt-1">
                    {t.grupo}
                  </Badge>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto opacity-20 mb-2" />
              <p className="text-sm">Nenhum template {tipoFiltro.toUpperCase()} cadastrado</p>
              <p className="text-xs mt-1">Cadastre em Proposta Comercial → Modelos de Proposta</p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cliente</p>
            <p className="text-sm font-semibold truncate">{clienteNome}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Potência</p>
            <p className="text-sm font-semibold">{potenciaKwp} kWp</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">UCs</p>
            <p className="text-sm font-semibold">{numUcs}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Investimento</p>
            <p className="text-sm font-semibold">{formatBRL(precoFinal)}</p>
          </div>
        </div>

        {/* Generate Button */}
        <div className="text-center">
          <Button size="lg" className="gap-2 min-w-[200px]" onClick={onGenerate} disabled={generating}>
            {generating ? <Sun className="h-5 w-5 animate-spin" style={{ animationDuration: "2s" }} /> : <Zap className="h-5 w-5" />}
            {generating ? "Gerando..." : "Gerar PDF"}
          </Button>
        </div>

        {generating && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Sun className="h-12 w-12 text-primary animate-spin" style={{ animationDuration: "2s" }} />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Gerando proposta comercial...</p>
          </div>
        )}
      </div>
    );
  }

  // Result view
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/15 text-center">
          <p className="text-xs text-muted-foreground">Investimento</p>
          <p className="text-lg font-bold text-primary">{formatBRL(result.valor_total)}</p>
        </div>
        <div className="p-4 rounded-xl bg-success/5 border border-success/15 text-center">
          <p className="text-xs text-muted-foreground">Economia/mês</p>
          <p className="text-lg font-bold text-success">{formatBRL(result.economia_mensal)}</p>
        </div>
        <div className="p-4 rounded-xl bg-info/5 border border-info/15 text-center">
          <p className="text-xs text-muted-foreground">Payback</p>
          <p className="text-lg font-bold text-info">{result.payback_meses} meses</p>
        </div>
      </div>

      {rendering ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Sun className="h-12 w-12 text-primary animate-spin" style={{ animationDuration: "2s" }} />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Renderizando proposta...</p>
        </div>
      ) : htmlPreview ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Pré-visualização</p>
          <div className="border rounded-xl overflow-hidden bg-white shadow-sm" style={{ maxHeight: 600, overflow: "auto" }}>
            <iframe srcDoc={htmlPreview} title="Proposta Preview" className="w-full border-0" style={{ height: 800, pointerEvents: "none" }} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 justify-center pt-4">
        <Button onClick={onViewDetail} className="gap-2">Ver Detalhes</Button>
        <Button variant="outline" onClick={onNewVersion} className="gap-2"><Plus className="h-4 w-4" /> Nova Versão</Button>
        <Button variant="ghost" onClick={onNewVersion}>Voltar e Editar</Button>
      </div>
    </div>
  );
}
