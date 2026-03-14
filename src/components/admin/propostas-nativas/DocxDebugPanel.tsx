/**
 * DocxDebugPanel — Admin panel to trigger forensic debug mode
 * and view/download debug reports from DOCX→PDF pipeline.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Bug, Download, FileText, Play, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface DebugSummary {
  total_merges: number;
  structure_preserved: boolean | null;
  fonts_in_template: string[];
  fonts_in_affected_blocks: string[];
  gotenberg_response_time_ms: number | null;
  pdf_size_bytes: number | null;
}

interface DebugResult {
  success: boolean;
  output_docx_path: string | null;
  output_pdf_path: string | null;
  generation_status: string;
  generation_error: string | null;
  missing_vars: string[];
  debug_report_path?: string;
  debug_summary?: DebugSummary;
}

export function DocxDebugPanel() {
  const { tenantId } = useTenantId();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedProposta, setSelectedProposta] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [fullReport, setFullReport] = useState<any>(null);

  // Fetch templates
  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ["debug-templates", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("proposta_templates")
        .select("id, nome, tipo")
        .eq("tipo", "docx")
        .order("nome");
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!tenantId,
  });

  // Fetch propostas
  const { data: propostas, isLoading: loadingPropostas } = useQuery({
    queryKey: ["debug-propostas", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("propostas_nativas")
        .select("id, titulo, codigo, status")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!tenantId,
  });

  const handleRunDebug = async () => {
    if (!selectedTemplate || !selectedProposta) {
      toast({ title: "Selecione template e proposta", variant: "destructive" });
      return;
    }

    setRunning(true);
    setResult(null);
    setFullReport(null);

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "bguhckqkpnziykpbwbeu";
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      const rawResp = await fetch(`https://${projectId}.supabase.co/functions/v1/template-preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${session?.access_token || anonKey}`,
          "apikey": anonKey,
          "x-client-timeout": "120",
        },
        body: JSON.stringify({
          template_id: selectedTemplate,
          proposta_id: selectedProposta,
          response_format: "json",
          debug_docx_pdf: true,
        }),
      });

      if (!rawResp.ok) {
        const errBody = await rawResp.text();
        throw new Error(errBody);
      }

      const data: DebugResult = await rawResp.json();
      setResult(data);

      // Download full debug report from storage
      if (data.debug_report_path) {
        const { data: reportData } = await supabase.storage
          .from("proposta-documentos")
          .download(data.debug_report_path);
        if (reportData) {
          const text = await reportData.text();
          setFullReport(JSON.parse(text));
        }
      }

      toast({ title: "Debug concluído", description: `Status: ${data.generation_status}` });
    } catch (err: any) {
      console.error("[DocxDebugPanel]", err);
      toast({ title: "Erro no debug", description: err.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const handleDownloadReport = () => {
    if (!fullReport) return;
    const blob = new Blob([JSON.stringify(fullReport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debug_forensic_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bug className="w-4 h-4 text-primary" />
          </div>
          Debug Forense DOCX→PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Template DOCX</Label>
            {loadingTemplates ? <Skeleton className="h-9 w-full" /> : (
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {templates?.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Proposta</Label>
            {loadingPropostas ? <Skeleton className="h-9 w-full" /> : (
              <Select value={selectedProposta} onValueChange={setSelectedProposta}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {propostas?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo || p.titulo} ({p.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <Button
          onClick={handleRunDebug}
          disabled={running || !selectedTemplate || !selectedProposta}
          className="w-full gap-2"
        >
          {running ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Gerando com debug...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Gerar PDF com Debug Forense
            </>
          )}
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-3 border-t border-border pt-3">
            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={
                result.generation_status === "ready"
                  ? "bg-success/10 text-success border-success/20"
                  : result.generation_status === "docx_only"
                    ? "bg-warning/10 text-warning border-warning/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
              }>
                {result.generation_status === "ready" ? <CheckCircle className="w-3 h-3 mr-1" /> :
                 result.generation_status === "docx_only" ? <AlertTriangle className="w-3 h-3 mr-1" /> :
                 <XCircle className="w-3 h-3 mr-1" />}
                {result.generation_status}
              </Badge>
              {result.missing_vars.length > 0 && (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                  {result.missing_vars.length} vars ausentes
                </Badge>
              )}
            </div>

            {/* Debug Summary */}
            {result.debug_summary && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Merges:</span>{" "}
                  <span className="font-mono font-bold text-foreground">{result.debug_summary.total_merges}</span>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Estrutura:</span>{" "}
                  {result.debug_summary.structure_preserved
                    ? <span className="text-success font-bold">Preservada</span>
                    : <span className="text-destructive font-bold">ALTERADA</span>
                  }
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Gotenberg:</span>{" "}
                  <span className="font-mono text-foreground">{result.debug_summary.gotenberg_response_time_ms ?? "N/A"}ms</span>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">PDF:</span>{" "}
                  <span className="font-mono text-foreground">
                    {result.debug_summary.pdf_size_bytes
                      ? `${(result.debug_summary.pdf_size_bytes / 1024).toFixed(0)} KB`
                      : "N/A"}
                  </span>
                </div>
              </div>
            )}

            {/* Fonts */}
            {result.debug_summary?.fonts_in_template?.length ? (
              <div className="text-xs">
                <span className="text-muted-foreground">Fontes no template:</span>{" "}
                <span className="font-mono text-foreground">{result.debug_summary.fonts_in_template.join(", ")}</span>
              </div>
            ) : null}

            {/* Missing vars */}
            {result.missing_vars.length > 0 && (
              <div className="text-xs">
                <span className="text-muted-foreground">Variáveis ausentes:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.missing_vars.slice(0, 30).map(v => (
                    <Badge key={v} variant="outline" className="text-[10px] font-mono">{v}</Badge>
                  ))}
                  {result.missing_vars.length > 30 && (
                    <Badge variant="outline" className="text-[10px]">+{result.missing_vars.length - 30}</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Full report */}
            {fullReport && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={handleDownloadReport}>
                    <Download className="h-3.5 w-3.5" />
                    Baixar Relatório Completo
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {fullReport.totalMerges} merges, {fullReport.totalVarsProvided} vars, {fullReport.placeholdersMissing?.length || 0} ausentes
                  </span>
                </div>

                {/* Merge events preview */}
                {fullReport.mergeEvents?.length > 0 && (
                  <div className="text-xs">
                    <p className="font-medium text-muted-foreground mb-1">Merges de runs fragmentados:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1 rounded border border-border p-2 bg-muted/30">
                      {fullReport.mergeEvents.map((evt: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 font-mono">
                          <Badge variant="outline" className="text-[9px] shrink-0">{evt.location}</Badge>
                          <span className="text-muted-foreground">{evt.file}:p{evt.paragraphIndex}</span>
                          <span className="text-foreground">{evt.placeholdersMerged.join(", ")}</span>
                          <span className="text-muted-foreground">({evt.runsBeforeCount}→{evt.runsAfterCount} runs)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Variable map sample */}
                {fullReport.variableMap && (
                  <div className="text-xs">
                    <p className="font-medium text-muted-foreground mb-1">
                      Mapa de variáveis ({Object.keys(fullReport.variableMap).length} chaves):
                    </p>
                    <div className="max-h-48 overflow-y-auto rounded border border-border p-2 bg-muted/30 font-mono">
                      {Object.entries(fullReport.variableMap as Record<string, string>)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .slice(0, 100)
                        .map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-primary shrink-0">{k}:</span>
                            <span className="text-foreground truncate">{String(v).substring(0, 80)}</span>
                          </div>
                        ))}
                      {Object.keys(fullReport.variableMap).length > 100 && (
                        <div className="text-muted-foreground mt-1">
                          +{Object.keys(fullReport.variableMap).length - 100} mais (baixe o relatório completo)
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
