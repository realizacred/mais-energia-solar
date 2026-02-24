import { useState } from "react";
import { ReceiptText, FileUp, Search, Settings2, FileText, Plus, Webhook } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FiscalWizard } from "./FiscalWizard";
import { FiscalEmissao } from "./FiscalEmissao";
import { FiscalLogs } from "./FiscalLogs";

// ── Tab: XMLs Fornecedores (Entrada) ───────────────────────
function XmlsEntradaTab() {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith(".xml") || f.type === "text/xml"
    );
    if (files.length === 0) {
      toast.error("Apenas arquivos XML são aceitos.");
      return;
    }
    toast.info(`${files.length} XML(s) recebido(s) — importação em breve.`);
  };

  return (
    <SectionCard icon={FileUp} title="XMLs de Compra (Entrada)" description="Importe XMLs de notas de compra de kits solares para controle fiscal">
      <div className="space-y-4">
        <div
          id="fiscal-xml-dropzone"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors cursor-pointer ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}
        >
          <FileUp className="h-10 w-10 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Arraste os arquivos XML aqui</p>
            <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar — apenas .xml</p>
          </div>
          <Badge variant="outline" className="text-xs">NF-e / NFS-e</Badge>
        </div>
        <EmptyState icon={FileUp} title="Nenhum XML importado" description="Arraste seus XMLs de compra de kits solares para iniciar o controle de entrada fiscal." />
      </div>
    </SectionCard>
  );
}

// ── Page ────────────────────────────────────────────────────
export function FiscalPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={ReceiptText}
        title="Gestão Fiscal"
        description="Emissão de NFS-e, configuração fiscal e controle de XMLs"
        helpText="Notas de serviço são integradas ao Asaas. Configure o módulo fiscal no Wizard antes de emitir."
      />

      <Tabs defaultValue="emissao" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="emissao" className="gap-1.5">
            <ReceiptText className="h-4 w-4" />
            <span className="hidden sm:inline">Emissão NFS-e</span>
            <span className="sm:hidden">NFS-e</span>
          </TabsTrigger>
          <TabsTrigger value="configuracao" className="gap-1.5">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Configuração</span>
            <span className="sm:hidden">Config</span>
          </TabsTrigger>
          <TabsTrigger value="xmls" className="gap-1.5">
            <FileUp className="h-4 w-4" />
            <span className="hidden sm:inline">XMLs Entrada</span>
            <span className="sm:hidden">XMLs</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Logs</span>
            <span className="sm:hidden">Logs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="emissao">
          <FiscalEmissao />
        </TabsContent>
        <TabsContent value="configuracao">
          <FiscalWizard />
        </TabsContent>
        <TabsContent value="xmls">
          <XmlsEntradaTab />
        </TabsContent>
        <TabsContent value="logs">
          <FiscalLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FiscalPage;
