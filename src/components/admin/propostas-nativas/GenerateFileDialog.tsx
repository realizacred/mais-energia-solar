import { useState, useEffect, useMemo, useRef } from "react";
import { FileText, Loader2, Upload, X, Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { renderProposal } from "@/services/proposalApi";

interface PropostaTemplate {
  id: string;
  nome: string;
  tipo: string;
  file_url: string | null;
}

interface GenerateFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versaoId: string;
  propostaId: string;
  onGenerated: (html: string | null) => void;
}

/** Helper to call template-preview and get raw DOCX blob */
async function fetchDocxBlob(templateId: string, propostaId: string): Promise<Blob> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "bguhckqkpnziykpbwbeu";
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw";
  const { data: { session } } = await supabase.auth.getSession();

  const rawResp = await fetch(`https://${projectId}.supabase.co/functions/v1/template-preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session?.access_token || anonKey}`,
      "apikey": anonKey,
      "x-client-timeout": "120",
    },
    body: JSON.stringify({ template_id: templateId, proposta_id: propostaId }),
  });

  if (!rawResp.ok) {
    const errBody = await rawResp.text();
    let errorMsg = "Erro ao gerar DOCX";
    try { errorMsg = JSON.parse(errBody)?.error || errorMsg; } catch { errorMsg = errBody || errorMsg; }
    throw new Error(errorMsg);
  }

  return rawResp.blob();
}

/** Convert a Blob to base64 string */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Trigger browser file download from a Blob */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function GenerateFileDialog({
  open,
  onOpenChange,
  versaoId,
  propostaId,
  onGenerated,
}: GenerateFileDialogProps) {
  const [templates, setTemplates] = useState<PropostaTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState("template");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setSelectedTemplate("");
      setUploadFile(null);
      return;
    }
    loadTemplates();
  }, [open]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    const { data } = await supabase
      .from("proposta_templates")
      .select("id, nome, tipo, file_url")
      .eq("ativo", true)
      .order("ordem", { ascending: true });

    const tpls = (data || []) as PropostaTemplate[];
    setTemplates(tpls);
    setLoadingTemplates(false);

    if (tpls.length > 0) {
      setSelectedTemplate(tpls[0].id);
    }
  };

  const webTemplates = useMemo(() => templates.filter(t => t.tipo === "html"), [templates]);
  const docTemplates = useMemo(() => templates.filter(t => t.tipo === "docx"), [templates]);

  const selectedTpl = templates.find(t => t.id === selectedTemplate);
  const isDocx = selectedTpl?.tipo === "docx";

  /** Generate and download DOCX */
  const handleGenerateDocx = async () => {
    if (!selectedTemplate) {
      toast({ title: "Selecione um template", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      if (isDocx) {
        const docxBlob = await fetchDocxBlob(selectedTemplate, propostaId);
        const safeName = (selectedTpl?.nome || "doc").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/_+/g, "_").substring(0, 60);
        const filename = `Proposta_${safeName}_${new Date().toISOString().split("T")[0]}.docx`;
        downloadBlob(docxBlob, filename);
        toast({ title: "DOCX gerado com sucesso!", description: "Download iniciado." });
        onGenerated(null);
      } else {
        const result = await renderProposal(versaoId);
        toast({ title: "Proposta renderizada!" });
        onGenerated(result.html);
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error("[GenerateFile]", err);
      toast({ title: "Erro ao gerar", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  /** Generate DOCX then convert to PDF via Gotenberg */
  const handleGeneratePdf = async () => {
    if (!selectedTemplate || !isDocx) return;

    setGeneratingPdf(true);
    try {
      // Step 1: Generate DOCX
      toast({ title: "Gerando DOCX..." });
      const docxBlob = await fetchDocxBlob(selectedTemplate, propostaId);

      // Step 2: Convert to base64
      toast({ title: "Convertendo para PDF..." });
      const docxBase64 = await blobToBase64(docxBlob);
      const safeName = (selectedTpl?.nome || "doc").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/_+/g, "_").substring(0, 60);
      const filename = `Proposta_${safeName}_${new Date().toISOString().split("T")[0]}.docx`;

      // Step 3: Call docx-to-pdf edge function
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "bguhckqkpnziykpbwbeu";
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/docx-to-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || anonKey}`,
          "apikey": anonKey,
          "x-client-timeout": "120",
        },
        body: JSON.stringify({ docxBase64, filename }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        let errorMsg = "Erro ao converter para PDF";
        try { errorMsg = JSON.parse(errBody)?.error || errorMsg; } catch { errorMsg = errBody || errorMsg; }
        throw new Error(errorMsg);
      }

      const { pdf: pdfBase64 } = await resp.json();

      // Step 4: Download PDF
      const pdfBinary = atob(pdfBase64);
      const pdfBytes = new Uint8Array(pdfBinary.length);
      for (let i = 0; i < pdfBinary.length; i++) {
        pdfBytes[i] = pdfBinary.charCodeAt(i);
      }
      const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
      const pdfFilename = filename.replace(/\.docx$/i, ".pdf");
      downloadBlob(pdfBlob, pdfFilename);

      toast({ title: "PDF gerado com sucesso!", description: "Download iniciado." });
      onGenerated(null);
      onOpenChange(false);
    } catch (err: any) {
      console.error("[GenerateFile PDF]", err);
      toast({ title: "Erro ao gerar PDF", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleUploadGenerate = async () => {
    if (!uploadFile) {
      toast({ title: "Selecione um arquivo", variant: "destructive" });
      return;
    }
    toast({ title: "Upload de arquivo DOCX", description: "Funcionalidade em desenvolvimento.", variant: "default" });
  };

  const isProcessing = generating || generatingPdf;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Gerar Proposta
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="template" className="flex-1 text-xs">Escolher um template</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 text-xs">Fazer upload de um arquivo doc</TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {loadingTemplates ? (
                    <SelectItem value="_loading" disabled>Carregando...</SelectItem>
                  ) : (
                    <>
                      <SelectGroup>
                        <SelectLabel className="text-xs font-bold">Template Web</SelectLabel>
                        {webTemplates.length > 0 ? (
                          webTemplates.map(t => (
                            <SelectItem key={t.id} value={t.id} className="text-sm">{t.nome}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="_no_web" disabled className="text-xs text-muted-foreground">Nenhum template</SelectItem>
                        )}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel className="text-xs font-bold">Template Doc</SelectLabel>
                        {docTemplates.length > 0 ? (
                          docTemplates.map(t => (
                            <SelectItem key={t.id} value={t.id} className="text-sm">{t.nome}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="_no_doc" disabled className="text-xs text-muted-foreground">Nenhum template</SelectItem>
                        )}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">
                {uploadFile ? uploadFile.name : "Nenhum arquivo selecionado"}
              </p>
              <input
                ref={uploadRef}
                type="file"
                accept=".docx,.doc"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              <Button variant="outline"
                type="button"
                size="sm"
                onClick={() => uploadRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                Importar
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Fechar
          </Button>

          {activeTab === "upload" ? (
            <Button
              onClick={handleUploadGenerate}
              disabled={!uploadFile || isProcessing}
              className="gap-1.5"
            >
              {generating && <Loader2 className="h-4 w-4 animate-spin" />}
              Gerar
            </Button>
          ) : isDocx ? (
            <>
              <Button
                variant="outline"
                onClick={handleGeneratePdf}
                disabled={!selectedTemplate || isProcessing}
                className="gap-1.5"
              >
                {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                PDF
              </Button>
              <Button
                onClick={handleGenerateDocx}
                disabled={!selectedTemplate || isProcessing}
                className="gap-1.5"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                DOCX
              </Button>
            </>
          ) : (
            <Button
              onClick={handleGenerateDocx}
              disabled={!selectedTemplate || isProcessing}
              className="gap-1.5"
            >
              {generating && <Loader2 className="h-4 w-4 animate-spin" />}
              Gerar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
