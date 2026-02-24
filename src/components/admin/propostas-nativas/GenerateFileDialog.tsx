import { useState, useEffect, useMemo, useRef } from "react";
import { FileText, Loader2, Upload, Zap, X } from "lucide-react";
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

    // Auto-select first template
    if (tpls.length > 0) {
      setSelectedTemplate(tpls[0].id);
    }
  };

  const webTemplates = useMemo(() => templates.filter(t => t.tipo === "html"), [templates]);
  const docTemplates = useMemo(() => templates.filter(t => t.tipo === "docx"), [templates]);

  const selectedTpl = templates.find(t => t.id === selectedTemplate);
  const isDocx = selectedTpl?.tipo === "docx";

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({ title: "Selecione um template", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      if (isDocx) {
        // DOCX: call edge function
        const response = await supabase.functions.invoke("template-preview", {
          body: { template_id: selectedTemplate, proposta_id: propostaId },
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
        a.download = `proposta_${selectedTpl?.nome?.replace(/[^a-zA-Z0-9]/g, "_") || "doc"}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({ title: "DOCX gerado com sucesso!", description: "Download iniciado." });
        onGenerated(null);
      } else {
        // HTML: render proposal
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

  const handleUploadGenerate = async () => {
    if (!uploadFile) {
      toast({ title: "Selecione um arquivo", variant: "destructive" });
      return;
    }
    toast({ title: "Upload de arquivo DOCX", description: "Funcionalidade em desenvolvimento.", variant: "default" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
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
              <Button
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            onClick={activeTab === "upload" ? handleUploadGenerate : handleGenerate}
            disabled={
              activeTab === "upload"
                ? !uploadFile || generating
                : !selectedTemplate || generating
            }
            className="gap-1.5"
          >
            {generating && <Loader2 className="h-4 w-4 animate-spin" />}
            Gerar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
