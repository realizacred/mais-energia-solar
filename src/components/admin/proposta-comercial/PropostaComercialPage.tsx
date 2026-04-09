import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Variable, FileText, Mail, Settings, BarChart3, FlaskConical, FolderOpen } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { VariaveisDisponiveisPage } from "./VariaveisDisponiveisPage";
import { ModelosPropostaUnified } from "@/components/admin/propostas-nativas/ModelosPropostaUnified";
import { TemplatesTab as DocumentTemplatesTab } from "@/components/admin/documentos/TemplatesTab";
import { EmailTemplatesPage } from "./EmailTemplatesPage";
import { PropostaConfigPage } from "./PropostaConfigPage";
import { ProposalChartsManager } from "./ProposalChartsManager";
import { VariableTester } from "./VariableTester";

const COMMERCIAL_TABS = ["variaveis", "testador", "modelos-proposta", "modelos-documento", "modelos-email", "configuracoes", "graficos"] as const;

export function PropostaComercialPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = COMMERCIAL_TABS.includes((requestedTab || "") as (typeof COMMERCIAL_TABS)[number])
    ? (requestedTab as (typeof COMMERCIAL_TABS)[number])
    : "variaveis";

  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const nextParams = new URLSearchParams(searchParams);
          if (value === "variaveis") {
            nextParams.delete("tab");
          } else {
            nextParams.set("tab", value);
          }
          setSearchParams(nextParams, { replace: true });
        }}
      >
        <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
          <TabsTrigger value="variaveis" className="gap-1.5 text-xs sm:text-sm shrink-0 whitespace-nowrap">
            <Variable className="h-4 w-4" />
            <span className="hidden sm:inline">Variáveis Disponíveis</span>
            <span className="sm:hidden">Variáveis</span>
          </TabsTrigger>
          <TabsTrigger value="testador" className="gap-1.5 text-xs sm:text-sm shrink-0 whitespace-nowrap">
            <FlaskConical className="h-4 w-4" />
            <span className="hidden sm:inline">Testador</span>
            <span className="sm:hidden">Testar</span>
          </TabsTrigger>
          <TabsTrigger value="modelos-proposta" className="gap-1.5 text-xs sm:text-sm shrink-0 whitespace-nowrap">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Modelos de Proposta</span>
            <span className="sm:hidden">Propostas</span>
          </TabsTrigger>
          <TabsTrigger value="modelos-documento" className="gap-1.5 text-xs sm:text-sm shrink-0 whitespace-nowrap">
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Modelos de Documento</span>
            <span className="sm:hidden">Documentos</span>
          </TabsTrigger>
          <TabsTrigger value="modelos-email" className="gap-1.5 text-xs sm:text-sm shrink-0 whitespace-nowrap">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Modelos de E-mail</span>
            <span className="sm:hidden">E-mails</span>
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-1.5 text-xs sm:text-sm shrink-0 whitespace-nowrap">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configurações</span>
            <span className="sm:hidden">Config</span>
          </TabsTrigger>
          <TabsTrigger value="graficos" className="gap-1.5 text-xs sm:text-sm shrink-0 whitespace-nowrap">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Gráficos</span>
            <span className="sm:hidden">Gráficos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="variaveis">
          <VariaveisDisponiveisPage />
        </TabsContent>
        <TabsContent value="testador">
          <VariableTester />
        </TabsContent>
        <TabsContent value="modelos-proposta">
          <ModelosPropostaUnified />
        </TabsContent>
        <TabsContent value="modelos-documento">
          <DocumentTemplatesTab />
        </TabsContent>
        <TabsContent value="modelos-email">
          <EmailTemplatesPage />
        </TabsContent>
        <TabsContent value="configuracoes">
          <PropostaConfigPage />
        </TabsContent>
        <TabsContent value="graficos">
          <ProposalChartsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
