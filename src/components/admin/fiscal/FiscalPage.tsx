import { useState } from "react";
import { ReceiptText, FileUp, Search, ExternalLink, Copy, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ── Tab: Emissões (Saída) ──────────────────────────────────
function EmissoesTab() {
  const [search, setSearch] = useState("");

  return (
    <SectionCard
      icon={ReceiptText}
      title="Notas Fiscais de Serviço"
      description="Notas emitidas vinculadas aos recebimentos e cobranças do Asaas"
      actions={
        <Button id="btn-tirar-nota" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Tirar Nota
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, número ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        <EmptyState
          icon={ReceiptText}
          title="Nenhuma nota fiscal emitida"
          description="As notas de serviço aparecerão aqui após serem emitidas. Conecte um provedor fiscal nas Configurações para habilitar a emissão automática."
        />
      </div>
    </SectionCard>
  );
}

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
    <SectionCard
      icon={FileUp}
      title="XMLs de Compra (Entrada)"
      description="Importe XMLs de notas de compra de kits solares para controle fiscal"
    >
      <div className="space-y-4">
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`
            flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10
            transition-colors cursor-pointer
            ${isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-muted/30"
            }
          `}
        >
          <FileUp className="h-10 w-10 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Arraste os arquivos XML aqui
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ou clique para selecionar — apenas .xml
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            NF-e / NFS-e
          </Badge>
        </div>

        <EmptyState
          icon={FileUp}
          title="Nenhum XML importado"
          description="Arraste seus XMLs de compra de kits solares para iniciar o controle de entrada fiscal."
        />
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
        description="Emissão de notas de serviço e importação de XMLs de fornecedores"
        helpText="As notas de serviço são vinculadas automaticamente aos recebimentos confirmados via Webhook do Asaas. Os XMLs de entrada servem para controle de compras de kits."
      />

      <Tabs defaultValue="emissoes" className="w-full">
        <TabsList>
          <TabsTrigger value="emissoes" className="gap-1.5">
            <ReceiptText className="h-4 w-4" />
            Emissões (Saída)
          </TabsTrigger>
          <TabsTrigger value="xmls" className="gap-1.5">
            <FileUp className="h-4 w-4" />
            XMLs Fornecedores (Entrada)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="emissoes">
          <EmissoesTab />
        </TabsContent>

        <TabsContent value="xmls">
          <XmlsEntradaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FiscalPage;
